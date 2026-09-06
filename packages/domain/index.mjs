import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { contentSchema } from './schema.mjs';

// One executable schema source is shared by the CLI, verifier and Astro loader.
export { contentSchema };
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

export function validatePatch(collection, patch) {
  const definition = contentSchema.properties[collection]?.items;
  if (!definition) return [{ pointer: '/patch', message: `Collection does not support entity patches: ${collection}` }];
  const entity = contentSchema.$defs[definition.$ref.split('/').at(-1)];
  const errors = validateSchema({ ...entity, $defs: contentSchema.$defs, required: [] }, patch);
  if (Object.hasOwn(patch, 'id')) errors.push({ pointer: '/id', message: 'Permanent IDs cannot be changed by an update' });
  return errors;
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
