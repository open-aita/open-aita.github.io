import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { ROOT, readJson, listContentCollections, getTaskRegistry, getTask, validateOperationInput, plan as createPlan } from '../operations-core/index.mjs';

function result(id, ok, details = {}) {
  return { id, status: ok ? 'passed' : 'failed', ...details };
}

function error(code, message, details = {}) {
  return { code, message, ...details };
}

async function exists(relativePath) {
  try { await fs.access(path.join(ROOT, relativePath)); return true; }
  catch { return false; }
}

function collectReferences(value, references, pointer = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectReferences(item, references, `${pointer}/${index}`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childPointer = `${pointer}/${key}`;
    if ((key.endsWith('Ids') || key === 'evidenceRefs') && Array.isArray(child)) {
      for (const id of child) if (typeof id === 'string') references.push({ id, pointer: childPointer });
    }
    collectReferences(child, references, childPointer);
  }
}

function localRuntimeRefs(html) {
  const refs = [];
  const regex = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(regex)) {
    const value = match[1].trim();
    if (!value || value.startsWith('#') || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(value)) continue;
    refs.push(value.split(/[?#]/, 1)[0]);
  }
  return [...new Set(refs)];
}

function cssRuntimeRefs(css) {
  const refs = [];
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    const value = match[1].trim();
    if (!value || /^(?:https?:|data:|#|%23)/i.test(value)) continue;
    refs.push(value);
  }
  return [...new Set(refs)];
}

export async function verifyRepository({ changed = false, includeRecipes = true } = {}) {
  const checks = [];
  const errors = [];
  const warnings = [];

  const requiredFiles = [
    'index.html', 'assets/css/styles.css', 'assets/js/main.js', 'AGENTS.md',
    'agent/manifest.json', 'agent/task-registry.json', 'agent/component-registry.json',
    'content/settings.json', 'docs/AITA官网技术架构设计_v2_Agent-Native.md',
  ];
  const missing = [];
  for (const file of requiredFiles) if (!(await exists(file))) missing.push(file);
  checks.push(result('repository-layout', missing.length === 0, { missing }));
  if (missing.length) errors.push(error('AITA_REPOSITORY_REQUIRED_FILE_MISSING', '缺少必需文件', { paths: missing }));

  const expectedPlugins = ['home','about','research','outputs','achievements','partners','activities','join'];
  const pluginDir = path.join(ROOT, 'plugins');
  const pluginEntries = (await fs.readdir(pluginDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const manifests = [];
  for (const pluginId of pluginEntries) {
    try { manifests.push(await readJson(`plugins/${pluginId}/chapter.manifest.json`)); }
    catch (caught) { errors.push(error(caught.code ?? 'AITA_PLUGIN_MANIFEST_INVALID', caught.message, caught.details)); }
  }
  const manifestIds = manifests.map((item) => item.id).sort();
  const pluginSetOk = JSON.stringify(manifestIds) === JSON.stringify([...expectedPlugins].sort()) && !pluginEntries.includes('people');
  checks.push(result('chapter-contract', pluginSetOk, { expected: expectedPlugins, actual: manifestIds }));
  if (!pluginSetOk) errors.push(error('AITA_PLUGIN_SET_INVALID', '章节插件集合必须恰好包含八个 v2 插件，且不得存在 people 插件', { actual: manifestIds }));
  const routeBases = manifests.map((item) => item.routeBase);
  if (new Set(routeBases).size !== routeBases.length) errors.push(error('AITA_PLUGIN_ROUTE_CONFLICT', '插件 routeBase 冲突', { routeBases }));
  for (const manifest of manifests) {
    if (manifest.renderer !== 'astro') errors.push(error('AITA_PLUGIN_RENDERER_INVALID', `插件 ${manifest.id} 首版 renderer 必须为 astro`));
    if (manifest.performance?.contentPageInitialJsKb !== 0) errors.push(error('AITA_PLUGIN_JS_BUDGET_INVALID', `插件 ${manifest.id} 普通内容页 JS 预算必须为 0 KB`));
  }

  const collections = await listContentCollections();
  const allIds = new Map();
  const references = [];
  const duplicateIds = [];
  const peopleEntities = [];
  const evidenceMissing = [];
  for (const collection of collections) {
    if (!Array.isArray(collection.data)) continue;
    for (let index = 0; index < collection.data.length; index += 1) {
      const entity = collection.data[index];
      if (!entity || typeof entity !== 'object') continue;
      if (typeof entity.id === 'string') {
        if (allIds.has(entity.id)) duplicateIds.push({ id: entity.id, first: allIds.get(entity.id), second: `${collection.path}#${index}` });
        else allIds.set(entity.id, `${collection.path}#${index}`);
        if (entity.id.startsWith('person:') || entity.type === 'person') peopleEntities.push(entity.id);
      }
      if (!['redirects','news','evidence'].includes(collection.name) && entity.id && (!Array.isArray(entity.evidenceRefs) || entity.evidenceRefs.length === 0)) {
        evidenceMissing.push({ id: entity.id, path: collection.path });
      }
      collectReferences(entity, references, `${collection.path}#${index}`);
    }
  }
  const unresolved = references.filter(({ id }) => !allIds.has(id));
  checks.push(result('content-identity', duplicateIds.length === 0 && peopleEntities.length === 0, { duplicateIds, peopleEntities }));
  checks.push(result('entity-relations', unresolved.length === 0, { unresolved }));
  checks.push(result('evidence', evidenceMissing.length === 0, { missing: evidenceMissing }));
  if (duplicateIds.length) errors.push(error('AITA_CONTENT_DUPLICATE_ID', '发现重复永久 ID', { duplicateIds }));
  if (peopleEntities.length || await exists('content/people.json')) errors.push(error('AITA_PEOPLE_DOMAIN_FORBIDDEN', 'v2 禁止人员实体集合', { peopleEntities }));
  if (unresolved.length) errors.push(error('AITA_CONTENT_REFERENCE_UNRESOLVED', '存在无法解析的实体引用', { unresolved }));
  if (evidenceMissing.length) errors.push(error('AITA_CONTENT_EVIDENCE_REQUIRED', '重要公开事实缺少 Evidence', { entities: evidenceMissing }));

  const byName = Object.fromEntries(collections.map((item) => [item.name, item.data]));
  const countSummary = {
    listedPartners: (byName.organizations ?? []).filter((item) => item.listedPartner).length,
    allOrganizations: (byName.organizations ?? []).length,
    projects: (byName.projects ?? []).length,
    papers: (byName.outputs ?? []).filter((item) => item.type === 'paper').length,
    ipRecords: (byName.outputs ?? []).filter((item) => ['patent','softwareCopyright'].includes(item.type)).length,
    nationalInnovationProjects: (byName.achievements ?? []).filter((item) => item.type === 'nationalInnovationProject').length,
    provincialInnovationProjects: (byName.achievements ?? []).filter((item) => item.type === 'provincialInnovationProject').length,
    competitionRecords: (byName.achievements ?? []).filter((item) => item.type === 'competition').length,
    events: (byName.events ?? []).length,
  };
  const expectedCounts = { listedPartners:33, projects:16, papers:7, ipRecords:12, nationalInnovationProjects:6, provincialInnovationProjects:5, competitionRecords:77, events:7 };
  const countMismatches = Object.entries(expectedCounts).filter(([key, expected]) => countSummary[key] !== expected).map(([key, expected]) => ({ key, expected, actual: countSummary[key] }));
  checks.push(result('source-material-counts', countMismatches.length === 0, { counts: countSummary, mismatches: countMismatches }));
  if (countMismatches.length) errors.push(error('AITA_CONTENT_COUNT_MISMATCH', '结构化内容数量与资料迁移基线不一致', { countMismatches }));

  const taskRegistry = await getTaskRegistry();
  const operationIds = taskRegistry.tasks.map((task) => task.id);
  const duplicateOperations = operationIds.filter((id, index) => operationIds.indexOf(id) !== index);
  const forbiddenOperations = operationIds.filter((id) => /(?:^|\.)(?:people|person)(?:\.|$)/i.test(id));
  const schemasMissing = [];
  for (const task of taskRegistry.tasks) if (!(await exists(task.inputSchema))) schemasMissing.push(task.inputSchema);
  const declaredOperations = new Set(manifests.flatMap((manifest) => manifest.operations ?? []));
  const undeclaredTasks = operationIds.filter((id) => !declaredOperations.has(id) && !id.startsWith('media.') && !id.startsWith('site.') && !id.startsWith('redirect.'));
  const agentContractOk = duplicateOperations.length === 0 && forbiddenOperations.length === 0 && schemasMissing.length === 0 && undeclaredTasks.length === 0;
  checks.push(result('agent-contract', agentContractOk, { operationCount: operationIds.length, duplicateOperations, forbiddenOperations, schemasMissing, undeclaredTasks }));
  if (!agentContractOk) errors.push(error('AITA_AGENT_CONTRACT_INVALID', 'Agent Operation 注册表或 Schema 不完整', { duplicateOperations, forbiddenOperations, schemasMissing, undeclaredTasks }));

  const componentRegistry = await readJson('agent/component-registry.json');
  const componentSchemaMissing = [];
  for (const component of Object.values(componentRegistry.components ?? {})) if (!(await exists(component.propsSchema))) componentSchemaMissing.push(component.propsSchema);
  checks.push(result('component-registry', componentSchemaMissing.length === 0, { componentCount: Object.keys(componentRegistry.components ?? {}).length, missingSchemas: componentSchemaMissing }));
  if (componentSchemaMissing.length) errors.push(error('AITA_COMPONENT_SCHEMA_MISSING', '组件 props Schema 缺失', { paths: componentSchemaMissing }));

  const html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
  const css = await fs.readFile(path.join(ROOT, 'assets/css/styles.css'), 'utf8');
  const js = await fs.readFile(path.join(ROOT, 'assets/js/main.js'), 'utf8');
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateHtmlIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const anchors = [...html.matchAll(/\bhref=["']#([^"']+)["']/gi)].map((match) => match[1]).filter(Boolean);
  const brokenAnchors = [...new Set(anchors.filter((id) => !ids.includes(id)))];
  const requiredAnchors = ['top','about','research','projects','outputs','achievements','network','activities','join'];
  const missingAnchors = requiredAnchors.filter((id) => !ids.includes(id));
  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const imagesWithoutAlt = imgTags.filter((tag) => !/\balt=["'][^"']*["']/i.test(tag));
  const accessibilityOk = /<html\b[^>]*\blang=["']zh-CN["']/i.test(html) && /class=["'][^"']*skip-link/i.test(html) && imagesWithoutAlt.length === 0;
  checks.push(result('html-structure', duplicateHtmlIds.length === 0 && brokenAnchors.length === 0 && missingAnchors.length === 0, { duplicateHtmlIds, brokenAnchors, missingAnchors }));
  checks.push(result('accessibility-baseline', accessibilityOk, { imagesWithoutAlt: imagesWithoutAlt.length }));
  if (duplicateHtmlIds.length) errors.push(error('AITA_HTML_DUPLICATE_ID', 'HTML 存在重复 ID', { duplicateHtmlIds }));
  if (brokenAnchors.length || missingAnchors.length) errors.push(error('AITA_HTML_ANCHOR_INVALID', 'HTML 锚点不完整', { brokenAnchors, missingAnchors }));
  if (!accessibilityOk) errors.push(error('AITA_ACCESSIBILITY_BASELINE_FAILED', '无障碍基础约束未通过', { imagesWithoutAlt: imagesWithoutAlt.length }));
  if (/data-plugin=["']people["']|id=["']people["']|href=["'][^"']*\/people/i.test(html)) errors.push(error('AITA_PEOPLE_UI_FORBIDDEN', '页面中仍存在人员章节或人员路由'));

  const refs = localRuntimeRefs(html);
  const missingAssets = [];
  for (const ref of refs) {
    const normalized = ref.replace(/^\.\//, '');
    if (!(await exists(normalized))) missingAssets.push(ref);
  }
  for (const ref of cssRuntimeRefs(css)) {
    const normalized = path.posix.normalize(path.posix.join('assets/css', ref));
    if (!(await exists(normalized))) missingAssets.push(ref);
  }
  const remoteRuntime = /<script\b[^>]*\bsrc=["']https?:/i.test(html) || /<link\b[^>]*\bhref=["']https?:/i.test(html) || /@import\s+(?:url\()?\s*["']?https?:/i.test(css) || /url\(\s*["']?https?:/i.test(css);
  const networkApis = /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(js);
  checks.push(result('offline-runtime', missingAssets.length === 0 && !remoteRuntime && !networkApis, { missingAssets, remoteRuntime, networkApis }));
  if (missingAssets.length || remoteRuntime || networkApis) errors.push(error('AITA_OFFLINE_RUNTIME_INVALID', '离线运行依赖不完整或包含远程运行时资源', { missingAssets, remoteRuntime, networkApis }));

  const cssGzipKb = gzipSync(Buffer.from(css)).byteLength / 1024;
  const jsGzipKb = gzipSync(Buffer.from(js)).byteLength / 1024;
  const performanceOk = cssGzipKb <= 35 && jsGzipKb <= 10;
  checks.push(result('performance-budget', performanceOk, { cssGzipKb: Number(cssGzipKb.toFixed(2)), baseJsGzipKb: Number(jsGzipKb.toFixed(2)), limits: { cssGzipKb:35, baseJsGzipKb:10 } }));
  if (!performanceOk) errors.push(error('AITA_PERFORMANCE_BUDGET_EXCEEDED', '静态 Demo 超出 CSS 或基础 JS 预算', { cssGzipKb, jsGzipKb }));

  const mediaErrors = [];
  for (const media of byName['media-assets'] ?? []) {
    for (const key of ['path','fallbackPath']) {
      if (media[key] && !(await exists(media[key]))) mediaErrors.push({ id: media.id, field: key, path: media[key] });
    }
    if (!media.alt?.zh || !(media.width > 0) || !(media.height > 0)) mediaErrors.push({ id: media.id, reason: 'metadata-incomplete' });
  }
  checks.push(result('media-metadata', mediaErrors.length === 0, { errors: mediaErrors }));
  if (mediaErrors.length) errors.push(error('AITA_MEDIA_METADATA_INVALID', '媒体路径或元数据不完整', { mediaErrors }));

  if (includeRecipes) {
    const recipeResult = await testRecipes();
    checks.push(result('recipe-tests', recipeResult.ok, { total: recipeResult.total, passed: recipeResult.passed, failures: recipeResult.failures }));
    if (!recipeResult.ok) errors.push(error('AITA_RECIPE_TEST_FAILED', '一个或多个可执行 Recipe 失败', { failures: recipeResult.failures }));
  }

  if (changed) warnings.push({ code:'AITA_CHANGED_SCOPE_DEMO', message:'离线包没有 Git 工作树，changed-scope 使用完整规范源检查。' });
  return {
    ok: errors.length === 0,
    scope: changed ? 'changed-compatible-full-check' : 'full',
    summary: { passed: checks.filter((item) => item.status === 'passed').length, failed: checks.filter((item) => item.status === 'failed').length, errorCount: errors.length, warningCount: warnings.length },
    checks,
    errors,
    warnings,
    nextActions: errors.length ? ['fix-errors', 'run-verify-again'] : ['review-preview', 'package-immutable-artifact'],
  };
}

function hasEvidence(input) {
  return Array.isArray(input.evidenceRefs) && input.evidenceRefs.length > 0;
}

export async function testRecipes() {
  const base = path.join(ROOT, 'agent', 'recipes');
  const entries = (await fs.readdir(base, { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a,b) => a.name.localeCompare(b.name));
  const failures = [];
  for (const entry of entries) {
    try {
      const request = JSON.parse(await fs.readFile(path.join(base, entry.name, 'request.json'), 'utf8'));
      const assertions = JSON.parse(await fs.readFile(path.join(base, entry.name, 'assertions.json'), 'utf8'));
      const task = await getTask(assertions.operation);
      await validateOperationInput(task, request);
      const changePlan = await createPlan(assertions.operation, request);
      const change = changePlan.changes[0];
      const errors = [];
      if (changePlan.operation !== assertions.operation) errors.push('operation mismatch');
      if (change.type !== assertions.changeType) errors.push(`change type ${change.type} != ${assertions.changeType}`);
      if (assertions.mustRequireEvidence && !hasEvidence(request)) errors.push('evidence missing');
      for (const check of assertions.requiredChecksInclude ?? []) if (!changePlan.requiredChecks.includes(check)) errors.push(`required check missing: ${check}`);
      for (const prefix of assertions.affectedPathsExclude ?? []) if (changePlan.affectedPaths.some((item) => item.startsWith(prefix))) errors.push(`forbidden path affected: ${prefix}`);
      if (errors.length) failures.push({ recipe: entry.name, errors });
    } catch (caught) {
      failures.push({ recipe: entry.name, errors: [caught.message], code: caught.code ?? null });
    }
  }
  return { ok: failures.length === 0, total: entries.length, passed: entries.length - failures.length, failures };
}
