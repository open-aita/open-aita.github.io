#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  ROOT, AitaOperationError, describeRepository, getTaskRegistry, getTask, readJson,
  queryEntity, plan, apply, semanticDiff, sourceRevision,
} from '../packages/operations-core/index.mjs';
import { verifyRepository, testRecipes } from '../packages/verification/index.mjs';

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const cleanArgs = args.filter((arg) => arg !== '--json' && arg !== '--non-interactive');

function option(name) {
  const index = cleanArgs.indexOf(name);
  return index >= 0 ? cleanArgs[index + 1] : null;
}

function has(name) { return cleanArgs.includes(name); }

function emit(value, human = null) {
  if (jsonMode) process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  else if (human) process.stdout.write(`${human}\n`);
  else process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return `AITA deterministic maintenance CLI\n\n` +
  `  aita describe --json\n` +
  `  aita task list --json\n` +
  `  aita task schema <operation-id> --json\n` +
  `  aita task plan <operation-id> --input request.json --output plan.json --json\n` +
  `  aita task apply <plan.json> [--dry-run] --json\n` +
  `  aita query entity <permanent-id> --json\n` +
  `  aita diff --semantic [plan-id] --json\n` +
  `  aita verify [--changed] --json\n` +
  `  aita recipe test --json\n` +
  `  aita ui list --json\n` +
  `  aita ui inspect <component> --json\n` +
  `  aita preview create --changed --json\n` +
  `  aita rollback inspect <release-id> --json`;
}

async function readInput(file) {
  if (!file) throw new AitaOperationError('AITA_INPUT_REQUIRED', '缺少 --input <request.json>');
  const absolute = path.resolve(process.cwd(), file);
  const text = await fs.readFile(absolute, 'utf8');
  if (!file.toLowerCase().endsWith('.json')) {
    throw new AitaOperationError('AITA_INPUT_FORMAT_UNSUPPORTED', '离线 CLI 以 JSON 作为可执行输入；生产适配器可在进入 Operations Core 前转换 YAML', { path: file });
  }
  try { return JSON.parse(text); }
  catch (error) { throw new AitaOperationError('AITA_INPUT_JSON_INVALID', `输入 JSON 无法解析：${file}`, { cause: error.message }); }
}

async function main() {
  const [command, subcommand, third] = cleanArgs;
  if (!command || ['help','--help','-h'].includes(command)) {
    emit({ ok: true, usage: usage() }, usage());
    return;
  }

  if (command === 'describe') {
    const result = await describeRepository();
    emit(result, `AITA Agent-Native Demo\nRevision: ${result.currentRevision}\nPlugins: ${result.plugins.join(', ')}\nOperations: ${result.operationCount}\nComponents: ${result.componentCount}`);
    return;
  }

  if (command === 'task' && subcommand === 'list') {
    const registry = await getTaskRegistry();
    emit({ ok: true, schemaVersion: registry.schemaVersion, tasks: registry.tasks.map(({ id, version, plugin, risk, description, inputSchema }) => ({ id, version, plugin, risk, description, inputSchema })) }, registry.tasks.map((task) => `${task.id}\t${task.risk}\t${task.description}`).join('\n'));
    return;
  }

  if (command === 'task' && subcommand === 'schema') {
    if (!third) throw new AitaOperationError('AITA_OPERATION_REQUIRED', '缺少 Operation ID');
    const task = await getTask(third);
    const schema = await readJson(task.inputSchema);
    emit({ ok: true, operation: task.id, version: task.version, risk: task.risk, schemaPath: task.inputSchema, schema });
    return;
  }

  if (command === 'task' && subcommand === 'plan') {
    if (!third) throw new AitaOperationError('AITA_OPERATION_REQUIRED', '缺少 Operation ID');
    const input = await readInput(option('--input'));
    const baseRevision = option('--base-revision') ?? undefined;
    const changePlan = await plan(third, input, { baseRevision });
    const output = option('--output');
    if (output) {
      const absolute = path.resolve(process.cwd(), output);
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, `${JSON.stringify(changePlan, null, 2)}\n`, 'utf8');
    }
    emit({ ok: true, plan: changePlan, output: output ?? null, nextActions: ['review-plan','task-apply'] }, `Plan ${changePlan.planId}\nRisk: ${changePlan.risk}\nWrites: ${changePlan.allowedWritePaths.join(', ')}${output ? `\nSaved: ${output}` : ''}`);
    return;
  }

  if (command === 'task' && subcommand === 'apply') {
    if (!third) throw new AitaOperationError('AITA_PLAN_REQUIRED', '缺少 Change Plan 文件路径');
    const changePlan = JSON.parse(await fs.readFile(path.resolve(process.cwd(), third), 'utf8'));
    const result = await apply(changePlan, { dryRun: has('--dry-run') });
    emit(result, `${result.dryRun ? 'Dry-run validated' : result.alreadyApplied ? 'Plan already applied' : 'Plan applied'}: ${result.planId}`);
    return;
  }

  if (command === 'query' && subcommand === 'entity') {
    if (!third) throw new AitaOperationError('AITA_ENTITY_ID_REQUIRED', '缺少永久实体 ID');
    emit(await queryEntity(third));
    return;
  }

  if (command === 'diff' && (subcommand === '--semantic' || cleanArgs.includes('--semantic'))) {
    const possiblePlanId = subcommand === '--semantic' ? third : subcommand;
    emit(await semanticDiff(possiblePlanId && !possiblePlanId.startsWith('--') ? possiblePlanId : null));
    return;
  }

  if (command === 'verify') {
    const result = await verifyRepository({ changed: has('--changed'), includeRecipes: true });
    emit(result, result.ok ? `Verification passed: ${result.summary.passed} checks` : `Verification failed: ${result.summary.errorCount} errors`);
    if (!result.ok) process.exitCode = 5;
    return;
  }

  if (command === 'recipe' && subcommand === 'test') {
    const result = await testRecipes();
    emit(result, result.ok ? `Recipe tests passed: ${result.passed}/${result.total}` : `Recipe tests failed: ${result.failures.length}`);
    if (!result.ok) process.exitCode = 5;
    return;
  }

  if (command === 'ui' && subcommand === 'list') {
    const registry = await readJson('agent/component-registry.json');
    const components = Object.entries(registry.components).map(([name, value]) => ({ name, purpose: value.purpose, variants: value.allowedVariants, clientJavaScriptKb: value.clientJavaScriptKb }));
    emit({ ok: true, components }, components.map((component) => `${component.name}\t${component.clientJavaScriptKb} KB\t${component.purpose}`).join('\n'));
    return;
  }

  if (command === 'ui' && subcommand === 'inspect') {
    if (!third) throw new AitaOperationError('AITA_COMPONENT_REQUIRED', '缺少组件名称');
    const registry = await readJson('agent/component-registry.json');
    const component = registry.components[third];
    if (!component) throw new AitaOperationError('AITA_COMPONENT_UNKNOWN', `未知组件：${third}`);
    emit({ ok: true, name: third, component, propsSchema: await readJson(component.propsSchema) });
    return;
  }

  if (command === 'ui' && subcommand === 'validate') {
    const result = await verifyRepository({ changed: has('--changed'), includeRecipes: false });
    const uiChecks = result.checks.filter((check) => ['component-registry','accessibility-baseline','performance-budget','html-structure'].includes(check.id));
    const ok = uiChecks.every((check) => check.status === 'passed');
    emit({ ok, checks: uiChecks });
    if (!ok) process.exitCode = 5;
    return;
  }

  if (command === 'preview' && subcommand === 'create') {
    const finalPreview = path.join(ROOT, 'preview', 'final');
    const available = await fs.access(finalPreview).then(() => true).catch(() => false);
    emit({ ok: available, mode: 'offline-prebuilt-preview', path: 'preview/final/', sourceRevision: await sourceRevision(), changedRequested: has('--changed'), nextActions: available ? ['review-screenshots'] : ['run-visual-capture'] });
    if (!available) process.exitCode = 5;
    return;
  }

  if (command === 'rollback' && subcommand === 'inspect') {
    if (!third) throw new AitaOperationError('AITA_RELEASE_ID_REQUIRED', '缺少 release ID');
    const release = await readJson('release.manifest.json');
    emit({ ok: release.releaseId === third, requestedReleaseId: third, release, rollbackUnit: 'complete-immutable-artifact' });
    return;
  }

  throw new AitaOperationError('AITA_CLI_USAGE', `无法识别命令：${cleanArgs.join(' ')}`, { usage: usage() });
}

main().catch((caught) => {
  const payload = {
    ok: false,
    error: {
      code: caught.code ?? 'AITA_INTERNAL_ERROR',
      message: caught.message ?? String(caught),
      ...(caught.details ? { details: caught.details } : {}),
    },
    nextActions: caught.code === 'AITA_CLI_USAGE' ? ['run-help'] : ['inspect-error','retry-after-fix'],
  };
  if (jsonMode) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else {
    process.stderr.write(`[${payload.error.code}] ${payload.error.message}\n`);
    if (payload.error.details?.usage) process.stderr.write(`${payload.error.details.usage}\n`);
  }
  process.exitCode = caught.code === 'AITA_CLI_USAGE' ? 2 : 3;
});
