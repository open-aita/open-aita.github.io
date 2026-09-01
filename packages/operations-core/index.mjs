import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(MODULE_DIR, '../..');
const CONTENT_DIR = path.join(ROOT, 'content');
const HISTORY_DIR = path.join(ROOT, '.aita', 'history');

export class AitaOperationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AitaOperationError';
    this.code = code;
    this.details = details;
  }
}

export async function readJson(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  try {
    return JSON.parse(await fs.readFile(absolutePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new AitaOperationError('AITA_FILE_NOT_FOUND', `文件不存在：${relativePath}`, { path: relativePath });
    }
    if (error instanceof SyntaxError) {
      throw new AitaOperationError('AITA_JSON_INVALID', `JSON 无法解析：${relativePath}`, { path: relativePath, cause: error.message });
    }
    throw error;
  }
}

export async function writeJsonAtomic(relativePath, value) {
  const absolutePath = path.join(ROOT, relativePath);
  const directory = path.dirname(absolutePath);
  await fs.mkdir(directory, { recursive: true });
  const temporaryPath = `${absolutePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try {
    await fs.rename(temporaryPath, absolutePath);
  } catch (error) {
    if (['EEXIST', 'EPERM', 'EACCES'].includes(error?.code)) {
      await fs.rm(absolutePath, { force: true });
      await fs.rename(temporaryPath, absolutePath);
    } else {
      await fs.rm(temporaryPath, { force: true });
      throw error;
    }
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function listFiles(directory, predicate = () => true) {
  const output = [];
  async function walk(current) {
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (predicate(absolute)) output.push(absolute);
    }
  }
  await walk(directory);
  return output;
}

export async function sourceRevision() {
  const files = [
    ...(await listFiles(CONTENT_DIR, (file) => file.endsWith('.json'))),
    ...(await listFiles(path.join(ROOT, 'plugins'), (file) => file.endsWith('chapter.manifest.json'))),
    path.join(ROOT, 'agent', 'task-registry.json'),
    path.join(ROOT, 'agent', 'component-registry.json'),
  ].sort();
  const hash = createHash('sha256');
  for (const file of files) {
    const relative = path.relative(ROOT, file).replaceAll(path.sep, '/');
    hash.update(relative);
    hash.update('\0');
    hash.update(await fs.readFile(file));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

export async function getTaskRegistry() {
  return readJson('agent/task-registry.json');
}

export async function getTask(operationId) {
  const registry = await getTaskRegistry();
  const task = registry.tasks.find((item) => item.id === operationId);
  if (!task) {
    throw new AitaOperationError('AITA_OPERATION_UNKNOWN', `未知 Operation：${operationId}`, {
      operationId,
      suggestedAction: 'run-task-list',
    });
  }
  return task;
}

function typeMatches(value, expected) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((type) => {
    if (type === 'null') return value === null;
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    if (type === 'integer') return Number.isInteger(value);
    return typeof value === type;
  });
}

function validateNode(schema, value, pointer, errors) {
  if (!schema || typeof schema !== 'object') return;
  if ('const' in schema && value !== schema.const) {
    errors.push({ pointer, message: `必须等于 ${JSON.stringify(schema.const)}` });
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({ pointer, message: `必须属于枚举：${schema.enum.join(', ')}` });
    return;
  }
  if (schema.type && !typeMatches(value, schema.type)) {
    errors.push({ pointer, message: `类型应为 ${Array.isArray(schema.type) ? schema.type.join('|') : schema.type}` });
    return;
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push({ pointer, message: `长度不得小于 ${schema.minLength}` });
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push({ pointer, message: `不符合格式 ${schema.pattern}` });
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push({ pointer, message: `至少包含 ${schema.minItems} 项` });
    if (schema.items) value.forEach((item, index) => validateNode(schema.items, item, `${pointer}/${index}`, errors));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) errors.push({ pointer, message: `至少包含 ${schema.minProperties} 个字段` });
    for (const required of schema.required ?? []) {
      if (!(required in value)) errors.push({ pointer: `${pointer}/${required}`, message: '缺少必填字段' });
    }
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) validateNode(schema.properties[key], child, `${pointer}/${key}`, errors);
      else if (schema.additionalProperties === false) errors.push({ pointer: `${pointer}/${key}`, message: '不允许的字段' });
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validateNode(schema.additionalProperties, child, `${pointer}/${key}`, errors);
    }
  }
}

export async function validateOperationInput(task, input) {
  const schema = await readJson(task.inputSchema);
  const errors = [];
  validateNode(schema, input, '$', errors);
  if (errors.length) {
    throw new AitaOperationError('AITA_OPERATION_INPUT_INVALID', `Operation 输入不符合 Schema：${task.id}`, {
      operationId: task.id,
      schema: task.inputSchema,
      errors,
    });
  }
  return { ok: true, schema: task.inputSchema };
}

export async function listContentCollections() {
  const files = (await fs.readdir(CONTENT_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
  const collections = [];
  for (const file of files) {
    collections.push({ name: file.slice(0, -5), path: `content/${file}`, data: await readJson(`content/${file}`) });
  }
  return collections;
}

export async function queryEntity(entityId) {
  for (const collection of await listContentCollections()) {
    if (!Array.isArray(collection.data)) continue;
    const entity = collection.data.find((item) => item && item.id === entityId);
    if (entity) {
      return {
        ok: true,
        entityId,
        collection: collection.name,
        sourcePath: collection.path,
        entity,
      };
    }
  }
  throw new AitaOperationError('AITA_ENTITY_NOT_FOUND', `未找到实体：${entityId}`, {
    entityId,
    suggestedAction: 'check-permanent-id',
  });
}

function setByPath(object, dottedPath, value) {
  const keys = dottedPath.split('.').filter(Boolean);
  if (!keys.length) throw new AitaOperationError('AITA_SETTING_PATH_INVALID', '设置路径为空');
  let cursor = object;
  for (const key of keys.slice(0, -1)) {
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys.at(-1)] = value;
}

function affectedRoutesFor(task, input) {
  const pluginBase = {
    home: '/', about: '/about', research: '/research', outputs: '/outputs', achievements: '/achievements',
    partners: '/partners', activities: '/activities', join: '/join',
  }[task.plugin] ?? '/';
  const routes = new Set([pluginBase]);
  if (task.plugin === 'research' && input.slug) routes.add(`/research/${input.slug}`);
  if (task.plugin === 'outputs' && input.slug) routes.add(`/outputs/${input.slug}`);
  if (task.plugin === 'activities' && input.slug) routes.add(`/activities/${input.slug}`);
  if (task.plugin === 'partners' && input.slug) routes.add(`/partners/${input.slug}`);
  return [...routes];
}

function plannedChange(task, input) {
  const mode = task.target.mode;
  const entityId = input.id ?? null;
  if (mode === 'create') return { type: 'create-entity', entityId, fields: Object.keys(input).sort() };
  if (mode === 'upsert') return { type: 'upsert-entity', entityId, fields: Object.keys(input).sort() };
  if (mode === 'update') return { type: 'update-entity', entityId, fields: Object.keys(input.patch ?? {}).sort() };
  if (mode === 'archive') return { type: 'archive-entity', entityId, fields: ['status', 'archiveReason', 'evidenceRefs'] };
  if (mode === 'status') return { type: 'update-status', entityId, fields: ['status', 'evidenceRefs', 'verifiedAt'] };
  if (mode === 'set') return { type: 'update-setting', settingPath: task.target.path ?? input.key, fields: [task.target.path ?? input.key] };
  if (mode === 'upsert-nested') return { type: 'upsert-setting-entry', entityId, settingPath: task.target.path, fields: Object.keys(input).sort() };
  throw new AitaOperationError('AITA_OPERATION_MODE_UNSUPPORTED', `不支持的 Operation 模式：${mode}`, { operationId: task.id, mode });
}

async function assertPlanPreconditions(task, input) {
  const mode = task.target.mode;
  if (['update', 'archive', 'status'].includes(mode)) await queryEntity(input.id);
  if (mode === 'create') {
    try {
      await queryEntity(input.id);
      throw new AitaOperationError('AITA_ENTITY_ALREADY_EXISTS', `实体已存在：${input.id}`, { entityId: input.id });
    } catch (error) {
      if (error instanceof AitaOperationError && error.code === 'AITA_ENTITY_NOT_FOUND') return;
      throw error;
    }
  }
}

export async function plan(operationId, input, context = {}) {
  const task = await getTask(operationId);
  await validateOperationInput(task, input);
  await assertPlanPreconditions(task, input);
  const baseRevision = context.baseRevision ?? await sourceRevision();
  const change = plannedChange(task, input);
  const payload = {
    schemaVersion: 'aita.change-plan/v1',
    operation: task.id,
    operationVersion: task.version,
    baseRevision,
    risk: task.risk,
    preconditions: [
      'operation input matches JSON Schema',
      'base revision remains unchanged',
      'all writes stay inside allowed paths',
      ...(input.evidenceRefs ? ['required evidence references are present'] : []),
    ],
    changes: [change],
    affectedRoutes: affectedRoutesFor(task, input),
    affectedPaths: task.allowedWritePaths,
    requiredChecks: task.requiredChecks,
    allowedWritePaths: task.allowedWritePaths,
    input: stableValue(input),
  };
  const planId = `plan-${sha256(stableStringify(payload)).slice(0, 16)}`;
  const unsigned = { ...payload, planId };
  const planHash = sha256(stableStringify(unsigned));
  return { ...unsigned, planHash };
}

function verifyPlanHash(changePlan) {
  const { planHash, ...unsigned } = changePlan;
  const expected = sha256(stableStringify(unsigned));
  if (!planHash || planHash !== expected) {
    throw new AitaOperationError('AITA_PLAN_TAMPERED', 'Change Plan 哈希不匹配，计划可能已被修改', { expected, actual: planHash ?? null });
  }
}

function entityIndex(items, id) {
  return items.findIndex((item) => item && item.id === id);
}

export async function apply(changePlan, context = {}) {
  verifyPlanHash(changePlan);
  const task = await getTask(changePlan.operation);
  if (task.version !== changePlan.operationVersion) {
    throw new AitaOperationError('AITA_OPERATION_VERSION_MISMATCH', 'Operation 版本与计划不一致', {
      planned: changePlan.operationVersion,
      current: task.version,
    });
  }
  if (stableStringify(task.allowedWritePaths) !== stableStringify(changePlan.allowedWritePaths)) {
    throw new AitaOperationError('AITA_PLAN_WRITE_SCOPE_MISMATCH', '计划写入范围与当前 Operation 不一致');
  }
  await fs.mkdir(HISTORY_DIR, { recursive: true });
  const historyPath = path.join(HISTORY_DIR, `${changePlan.planId}.json`);
  try {
    const existing = JSON.parse(await fs.readFile(historyPath, 'utf8'));
    return { ok: true, alreadyApplied: true, planId: changePlan.planId, history: existing, nextActions: ['run-semantic-diff', 'run-verify'] };
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const currentRevision = await sourceRevision();
  if (currentRevision !== changePlan.baseRevision) {
    throw new AitaOperationError('AITA_PLAN_BASE_REVISION_MISMATCH', '仓库基线已变化，旧 Plan 已失效', {
      plannedRevision: changePlan.baseRevision,
      currentRevision,
      suggestedAction: 'regenerate-plan',
    });
  }
  if (context.dryRun) {
    return { ok: true, dryRun: true, planId: changePlan.planId, validatedRevision: currentRevision, nextActions: ['apply-plan'] };
  }

  const relativePath = task.allowedWritePaths[0];
  let document = await readJson(relativePath);
  const beforeDocument = structuredClone(document);
  const mode = task.target.mode;
  const input = changePlan.input;
  let before = null;
  let after = null;

  if (mode === 'set') {
    if (Array.isArray(document) || !document || typeof document !== 'object') throw new AitaOperationError('AITA_TARGET_SHAPE_INVALID', `${relativePath} 不是设置对象`);
    const targetPath = task.target.path ?? input.key;
    const value = task.target.path === 'featuredContentIds' ? input.entityIds
      : task.target.path === 'about.overview' ? { value: input.overview, evidenceRefs: input.evidenceRefs ?? [] }
      : input.value;
    before = structuredClone(document);
    setByPath(document, targetPath, value);
    after = structuredClone(document);
  } else if (mode === 'upsert-nested') {
    if (Array.isArray(document) || !document || typeof document !== 'object') throw new AitaOperationError('AITA_TARGET_SHAPE_INVALID', `${relativePath} 不是设置对象`);
    const keys = task.target.path.split('.');
    let cursor = document;
    for (const key of keys.slice(0, -1)) cursor = cursor[key] ??= {};
    const finalKey = keys.at(-1);
    const entries = Array.isArray(cursor[finalKey]) ? cursor[finalKey] : [];
    const index = entityIndex(entries, input.id);
    before = index >= 0 ? structuredClone(entries[index]) : null;
    if (index >= 0) entries[index] = { ...entries[index], ...input };
    else entries.push(input);
    cursor[finalKey] = entries;
    after = structuredClone(index >= 0 ? entries[index] : entries.at(-1));
  } else {
    if (!Array.isArray(document)) throw new AitaOperationError('AITA_TARGET_SHAPE_INVALID', `${relativePath} 不是实体数组`);
    const index = entityIndex(document, input.id);
    if (mode === 'create') {
      if (index >= 0) throw new AitaOperationError('AITA_ENTITY_ALREADY_EXISTS', `实体已存在：${input.id}`, { entityId: input.id });
      document.push(input);
      after = structuredClone(input);
    } else if (mode === 'upsert') {
      before = index >= 0 ? structuredClone(document[index]) : null;
      if (index >= 0) document[index] = { ...document[index], ...input };
      else document.push(input);
      after = structuredClone(index >= 0 ? document[index] : document.at(-1));
    } else {
      if (index < 0) throw new AitaOperationError('AITA_ENTITY_NOT_FOUND', `未找到实体：${input.id}`, { entityId: input.id });
      before = structuredClone(document[index]);
      if (mode === 'update') document[index] = { ...document[index], ...input.patch, ...(input.evidenceRefs ? { evidenceRefs: input.evidenceRefs } : {}) };
      else if (mode === 'archive') document[index] = { ...document[index], status: 'archived', archiveReason: input.reason, evidenceRefs: input.evidenceRefs };
      else if (mode === 'status') document[index] = { ...document[index], status: input.status, evidenceRefs: input.evidenceRefs, verifiedAt: input.verifiedAt };
      after = structuredClone(document[index]);
    }
  }

  await writeJsonAtomic(relativePath, document);
  const newRevision = await sourceRevision();
  const history = {
    schemaVersion: 'aita.apply-history/v1',
    planId: changePlan.planId,
    operation: changePlan.operation,
    risk: changePlan.risk,
    sourcePath: relativePath,
    baseRevision: changePlan.baseRevision,
    resultRevision: newRevision,
    before,
    after,
    documentChanged: stableStringify(beforeDocument) !== stableStringify(document),
    affectedRoutes: changePlan.affectedRoutes,
    requiredChecks: changePlan.requiredChecks,
  };
  await fs.writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  return {
    ok: true,
    alreadyApplied: false,
    planId: changePlan.planId,
    baseRevision: changePlan.baseRevision,
    resultRevision: newRevision,
    sourcePath: relativePath,
    nextActions: ['rebuild-static-artifact', 'run-semantic-diff', 'run-verify'],
  };
}

function changedFields(before, after) {
  if (before === null && after && typeof after === 'object') return Object.keys(after).sort();
  if (after === null && before && typeof before === 'object') return Object.keys(before).sort();
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => stableStringify(before[key]) !== stableStringify(after[key])).sort();
}

export async function semanticDiff(planId = null) {
  let files = [];
  try {
    files = (await fs.readdir(HISTORY_DIR)).filter((file) => file.endsWith('.json')).sort();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (!files.length) {
    return { ok: true, changes: [], message: '没有已应用的 Change Plan', nextActions: ['create-plan'] };
  }
  const target = planId ? `${planId}.json` : files.at(-1);
  if (!files.includes(target)) throw new AitaOperationError('AITA_HISTORY_NOT_FOUND', `未找到 Apply 历史：${planId}`, { planId });
  const history = JSON.parse(await fs.readFile(path.join(HISTORY_DIR, target), 'utf8'));
  return {
    ok: true,
    planId: history.planId,
    operation: history.operation,
    risk: history.risk,
    entityChange: {
      entityId: history.after?.id ?? history.before?.id ?? null,
      type: history.before === null ? 'created' : history.after === null ? 'removed' : 'updated',
      fields: changedFields(history.before, history.after),
    },
    pageChanges: history.affectedRoutes,
    sourcePath: history.sourcePath,
    checksRequired: history.requiredChecks,
    revisions: { before: history.baseRevision, after: history.resultRevision },
  };
}

export async function describeRepository() {
  const manifest = await readJson('agent/manifest.json');
  const tasks = await getTaskRegistry();
  const components = await readJson('agent/component-registry.json');
  const collections = await listContentCollections();
  const entityCounts = Object.fromEntries(collections.map((collection) => [collection.name, Array.isArray(collection.data) ? collection.data.length : 1]));
  return {
    ok: true,
    ...manifest,
    currentRevision: await sourceRevision(),
    operationCount: tasks.tasks.length,
    componentCount: Object.keys(components.components).length,
    entityCounts,
    nextActions: ['task-list', 'ui-list', 'verify'],
  };
}
