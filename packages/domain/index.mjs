import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { contentSchema } from './schema.mjs';

// One executable schema source is shared by the CLI, verifier and Astro loader.
export { contentSchema };
// Operation inputs reuse the same field definitions that validate the final content.
export function operationSchema(task) {
  const collection = contentSchema.properties[task.target.collection];
  const reference = collection.items?.$ref ?? collection.$ref;
  const definition = contentSchema.$defs[reference.split('/').at(-1)];
  const fields = definition.properties;
  const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
  let schema;
  switch (task.target.mode) {
    case 'create': case 'upsert': schema = definition; break;
    case 'update': {
      const { id, ...editable } = fields;
      schema = object({ id, patch: { ...object(editable, []), minProperties: 1 }, evidenceRefs: fields.evidenceRefs }, ['id','patch']);
      break;
    }
    case 'archive': schema = object({ id: fields.id, reason: fields.archiveReason, evidenceRefs: fields.evidenceRefs }); break;
    case 'status': schema = object({ id: fields.id, status: fields.status, evidenceRefs: fields.evidenceRefs, verifiedAt: fields.verifiedAt }); break;
    case 'upsert-nested': schema = contentSchema.$defs.direction; break;
    case 'set': schema = task.target.path === 'about.overview'
      ? object({ overview: fields.about.properties.overview.properties.value, evidenceRefs: fields.evidenceRefs })
      : object({ key: { type: 'string', minLength: 1 }, value: {} }); break;
    default: throw new Error(`Unsupported operation mode: ${task.target.mode}`);
  }
  return { ...schema, $defs: contentSchema.$defs, title: task.id };
}
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(contentSchema);
const cache = new Map();

export function validateSchema(schema, value) {
  const key = JSON.stringify(schema);
  if (!cache.has(key)) cache.set(key, ajv.compile(schema));
  const validate = cache.get(key);
  validate(value);
  return (validate.errors ?? []).map(({ instancePath, message, params }) => ({ pointer: instancePath || '/', message, ...params }));
}

export function validateContent(collections) {
  const errors = validateSchema(contentSchema, collections);
  const ids = new Set();
  const refs = [];
  function walk(value, pointer) {
    if (Array.isArray(value)) { value.forEach((item, i) => walk(item, `${pointer}/${i}`)); return; }
    if (!value || typeof value !== 'object') return;
    if (typeof value.id === 'string') {
      if (ids.has(value.id)) errors.push({ pointer, message: `Duplicate permanent ID: ${value.id}` });
      if (value.id.startsWith('person:')) errors.push({ pointer, message: 'Person entities are not part of this site' });
      ids.add(value.id);
    }
    for (const [key, child] of Object.entries(value)) {
      if ((key.endsWith('Ids') || key === 'evidenceRefs') && Array.isArray(child)) child.forEach(id => refs.push({ id, pointer: `${pointer}/${key}` }));
      if (key.endsWith('Id') && typeof child === 'string') refs.push({ id: child, pointer: `${pointer}/${key}` });
      walk(child, `${pointer}/${key}`);
    }
  }
  walk(collections, '');
  for (const ref of refs) if (!ids.has(ref.id)) errors.push({ pointer: ref.pointer, message: `Unresolved reference: ${ref.id}` });
  for (const [name, items] of Object.entries(collections)) {
    if (!Array.isArray(items)) continue;
    const slugs = new Set();
    for (const item of items) if (item.slug) {
      if (slugs.has(item.slug)) errors.push({ pointer: `/${name}`, message: `Duplicate slug: ${item.slug}` });
      slugs.add(item.slug);
    }
  }
  return errors;
}
