import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateContent, operationSchema, validateSchema } from '../domain/index.mjs';
import { ROOT, readJson, listContentCollections, getTaskRegistry, chapterManifests } from '../operations-core/index.mjs';
import { inspectArtifact, filesUnder } from './artifact.mjs';

export async function verifyRepository({ changed = false, includeRecipes = true } = {}) {
  const checks = [];
  const errors = [];
  const check = (id, issues, details = {}) => {
    checks.push({ id, status: issues.length ? 'failed' : 'passed', ...details, issues });
    errors.push(...issues.map(message => ({ code: id, message })));
  };
  const exists = file => fs.access(path.join(ROOT,file)).then(()=>true,()=>false);
  const required = ['apps/site/src/pages/index.astro','apps/site/astro.config.mjs','packages/domain/schema.mjs','packages/design-system/tokens.css','AGENTS.md','README.md'];
  check('repository-layout', (await Promise.all(required.map(async file=>(await exists(file))?null:`Missing ${file}`))).filter(Boolean));
  const collections = Object.fromEntries((await listContentCollections()).map(item=>[item.name,item.data]));
  const contentErrors = validateContent(collections);
  check('content-schema', contentErrors.map(item=>`${item.pointer}: ${item.message}`));
  check('content-inventory', [], { counts: Object.fromEntries(Object.entries(collections).map(([name,data])=>[name,Array.isArray(data)?data.length:1])) });

  const manifests = await chapterManifests();
  const chapterIssues = [];
  const seenIds = new Set(), seenOrders = new Set(), seenAnchors = new Set();
  for (const manifest of manifests) {
    const folder = `plugins/${manifest.id}`;
    if (manifest.apiVersion !== 'aita.chapter/v1' || manifest.entry !== 'Section.astro' || !Number.isInteger(manifest.order) || !/^#[\w-]+$/.test(manifest.demoEntry)) chapterIssues.push(`Invalid chapter manifest: ${manifest.id}`);
    if (seenIds.has(manifest.id) || seenOrders.has(manifest.order) || seenAnchors.has(manifest.demoEntry)) chapterIssues.push(`Duplicate chapter ID, position or anchor: ${manifest.id}`);
    seenIds.add(manifest.id); seenOrders.add(manifest.order); seenAnchors.add(manifest.demoEntry);
    if (!(await exists(`${folder}/${manifest.entry}`)) || !(await exists(`${folder}/styles.css`))) chapterIssues.push(`Missing implementation: ${manifest.id}`);
    for (const collection of manifest.consumes) if (!(collection in collections)) chapterIssues.push(`${manifest.id}: Unknown collection ${collection}`);
    const sources = (await filesUnder(path.join(ROOT,folder))).filter(file=>file.endsWith('.astro'));
    for (const file of sources) {
      const source = await fs.readFile(file,'utf8');
      const consumed = [...source.matchAll(/\bcontent(?:\.([\w]+)|\[['"]([^'"]+)['"]\])/g)].map(m=>m[1]??m[2]);
      for (const name of new Set(consumed)) if (!manifest.consumes.includes(name)) chapterIssues.push(`${manifest.id}: Undeclared content dependency ${name}`);
    }
  }
  if (await exists('index.html')) chapterIssues.push('Legacy root index.html duplicates the Astro entry');
  check('chapter-contract', chapterIssues, { chapters: manifests.map(m=>({id:m.id,entry:`plugins/${m.id}/${m.entry}`,anchor:m.demoEntry,order:m.order})) });

  const tasks = (await getTaskRegistry()).tasks;
  const taskIssues = [];
  const declared = new Set(manifests.flatMap(m=>m.operations));
  for (const task of tasks) {
    if (!declared.has(task.id) && !['site','media','redirect'].includes(task.plugin)) taskIssues.push(`Undeclared operation ${task.id}`);
    if (!task.allowedWritePaths.every(file=>file===`content/${task.target.collection}.json`)) taskIssues.push(`Invalid write scope ${task.id}`);
    try { validateSchema(operationSchema(task), {}); } catch(error) { taskIssues.push(`${task.id}: ${error.message}`); }
  }
  if (new Set(tasks.map(t=>t.id)).size!==tasks.length) taskIssues.push('Duplicate operation IDs');
  for (const id of declared) if (!tasks.some(t=>t.id===id)) taskIssues.push(`Manifest declares missing operation ${id}`);
  check('agent-contract', taskIssues, { operationCount: tasks.length, schemaSource: 'packages/domain/schema.mjs' });

  const components = (await readJson('agent/component-registry.json')).components;
  const componentIssues = [];
  for (const [name,component] of Object.entries(components)) {
    if (!(await exists(component.source))) componentIssues.push(`${name}: implementation missing`);
    else if (!(await fs.readFile(path.join(ROOT,component.source),'utf8')).includes('interface Props')) componentIssues.push(`${name}: typed Props missing`);
  }
  check('component-registry', componentIssues, { components: Object.keys(components), propValidation: 'npm run check compiles the actual Astro Props' });
  const evidenceIssues = [];
  for (const item of collections.evidence) if (!(await exists(item.path.split('#')[0]))) evidenceIssues.push(`${item.id}: source file missing`);
  check('evidence-files', evidenceIssues);
  const mediaIssues = [];
  for (const item of collections['media-assets']) for (const key of ['path','fallbackPath']) if (item[key] && !(await exists(`apps/site/public/${item[key]}`))) mediaIssues.push(`${item.id}: missing ${item[key]}`);
  check('media-files', mediaIssues);

  const artifact = await inspectArtifact(ROOT, manifests);
  checks.push(...artifact.checks);
  errors.push(...artifact.errors.map(message=>({code:'artifact',message})));
  if (includeRecipes) {
    const recipes = await testRecipes();
    check('recipe-tests', recipes.failures.map(f=>`${f.recipe}: ${f.errors.join('; ')}`), { total: recipes.total, passed: recipes.passed });
  }
  return { ok: errors.length===0, scope: 'full', changedRequested: changed,
    summary: {passed:checks.filter(c=>c.status==='passed').length,failed:checks.filter(c=>c.status==='failed').length,errorCount:errors.length},
    checks, errors, nextActions: errors.length?['fix-errors','rebuild','verify']:['review-current-preview'] };
}

function hasEvidence(input) {
  return Array.isArray(input.evidenceRefs) && input.evidenceRefs.length > 0;
}

export async function testRecipes() {
  const base = path.join(ROOT, 'agent', 'recipes');
  const entries = (await fs.readdir(base, { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a,b) => a.name.localeCompare(b.name));
  const failures = [];
  const work = path.join(ROOT, '.work');
  await fs.mkdir(work, { recursive: true });
  const fixture = await fs.mkdtemp(path.join(work, 'recipes-'));
  try {
    for (const name of ['content', 'agent', 'plugins', 'packages/operations-core', 'packages/domain']) {
      await fs.cp(path.join(ROOT, name), path.join(fixture, name), { recursive: true });
    }
    const operations = await import(pathToFileURL(path.join(fixture, 'packages/operations-core/index.mjs')).href);
  for (const entry of entries) {
    try {
      const request = JSON.parse(await fs.readFile(path.join(base, entry.name, 'request.json'), 'utf8'));
      const assertions = JSON.parse(await fs.readFile(path.join(base, entry.name, 'assertions.json'), 'utf8'));
      const task = await operations.getTask(assertions.operation);
      await operations.validateOperationInput(task, request);
      const changePlan = await operations.plan(assertions.operation, request);
      const change = changePlan.changes[0];
      const errors = [];
      if (changePlan.operation !== assertions.operation) errors.push('operation mismatch');
      if (change.type !== assertions.changeType) errors.push(`change type ${change.type} != ${assertions.changeType}`);
      if (assertions.mustRequireEvidence && !hasEvidence(request)) errors.push('evidence missing');
      for (const check of assertions.requiredChecksInclude ?? []) if (!changePlan.requiredChecks.includes(check)) errors.push(`required check missing: ${check}`);
      for (const prefix of assertions.affectedPathsExclude ?? []) if (changePlan.affectedPaths.some((item) => item.startsWith(prefix))) errors.push(`forbidden path affected: ${prefix}`);
      const original = await operations.readJson(task.allowedWritePaths[0]);
      const preview = await operations.apply(changePlan, { dryRun: true });
      if (JSON.stringify(original) !== JSON.stringify(await operations.readJson(task.allowedWritePaths[0]))) errors.push('dry-run wrote content');
      const applied = await operations.apply(changePlan);
      const repeated = await operations.apply(changePlan);
      if (!preview.dryRun || !applied.ok || !repeated.alreadyApplied) errors.push('apply / preview / idempotence failed');
      const after = await operations.readJson(applied.sourcePath);
      const actual = Array.isArray(after) ? after.find(item => item.id === request.id) : after;
      if (JSON.stringify(actual) !== JSON.stringify(preview.after)) errors.push('preview differs from persisted result');
      const expected = request.patch ?? (task.target.mode === 'status' ? {status:request.status,verifiedAt:request.verifiedAt} : request);
      for (const [key,value] of Object.entries(expected)) if (operations.stableStringify(actual[key]) !== operations.stableStringify(value)) errors.push(`requested field did not persist: ${key}`);
      if (errors.length) failures.push({ recipe: entry.name, errors });
    } catch (caught) {
      failures.push({ recipe: entry.name, errors: [caught.message], code: caught.code ?? null });
    }
  }
    // The critical failure path: an invalid patch must be rejected before any write.
    const before = await operations.readJson('content/projects.json');
    let rejected = false;
    try { await operations.plan('research.update-project', { id: before[0].id, patch: { title: 42 } }); }
    catch (error) { rejected = error.code === 'AITA_OPERATION_INPUT_INVALID'; }
    if (!rejected || JSON.stringify(before) !== JSON.stringify(await operations.readJson('content/projects.json'))) {
      failures.push({ recipe: 'invalid-update', errors: ['invalid content was not rejected without writes'] });
    }
  } finally {
    if (!fixture.startsWith(`${work}${path.sep}recipes-`)) throw new Error('Unexpected recipe fixture path');
    await fs.rm(fixture, { recursive: true, force: true });
  }
  return { ok: failures.length === 0, total: entries.length + 1, passed: entries.length + 1 - failures.length, failures };
}
