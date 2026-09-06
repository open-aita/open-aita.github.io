const text = { type: 'string', minLength: 1 };
const strings = { type: 'array', items: text };
const ids = prefix => ({ type: 'array', uniqueItems: true, items: { type: 'string', pattern: `^${prefix}:` } });
const date = { type: 'string', format: 'date' };
const url = { type: ['string', 'null'], format: 'uri', pattern: '^https?://' };
const local = { type: 'object', minProperties: 1, properties: { zh: text, en: text }, additionalProperties: false };
const refs = { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', pattern: '^evidence:' } };
const enumeration = (...values) => ({ enum: values });
const array = items => ({ type: 'array', items });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const contributor = object({ displayName: text, role: text, order: { type: 'integer', minimum: 1 }, externalUrl: url }, ['displayName', 'role', 'order']);
const entity = (prefix, fields, required) => object({
  id: { type: 'string', pattern: `^${prefix}:[a-zA-Z0-9][a-zA-Z0-9_-]*$` },
  title: local, slug: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$' },
  contributors: array(contributor), evidenceRefs: refs, verifiedAt: date, maintainer: text,
  ...fields,
}, ['id', 'evidenceRefs', ...required]);

const definitions = {
  project: entity('project', {
    status: enumeration('unspecified', 'draft', 'active', 'completed', 'deployed', 'archived'),
    statusLabel: text, category: enumeration('medical', 'multimodal', 'systems', 'agents'),
    organizationIds: ids('org'), unresolvedOrganizationLabels: strings,
    archiveReason: text, summary: local,
  }, ['title', 'slug', 'status', 'category', 'organizationIds']),
  organization: entity('org', {
    name: local, category: text, listedPartner: { type: 'boolean' }, featured: { type: 'boolean' },
    shortName: text, mapName: text, stripCategory: text, mapCategory: text, mapFamily: text, url,
    mapLocation: object({ address: text, pinBasis: text, precision: text, precisionKind: text,
      lon: { type: ['number', 'null'] }, lat: { type: ['number', 'null'] } }),
  }, ['name', 'category', 'listedPartner']),
  output: entity('output', {
    type: enumeration('paper', 'patent', 'softwareCopyright', 'openSystem', 'openSource'),
    citation: text, year: { type: ['integer', 'null'], minimum: 1900 },
    status: enumeration('draft', 'recorded', 'preprint', 'accepted', 'published', 'authorized', 'registered', 'archived'),
    statusLabel: text, labels: strings, url, sourceTitle: text, summary: local,
    display: object({ venue: text, linkLabel: text }, []),
  }, ['title', 'type', 'status']),
  achievement: entity('achievement', {
    type: enumeration('nationalInnovationProject', 'provincialInnovationProject', 'competition', 'award', 'grant'), level: text,
  }, ['title', 'type']),
  event: entity('event', {
    kind: text, mediaAssetIds: ids('media'), summary: local, date: { ...date, type: ['string', 'null'] },
    display: object({ title: text, caption: text, label: text, variant: text }, ['title']),
  }, ['title', 'kind', 'mediaAssetIds']),
  news: entity('news', {
    summary: local, relatedEntityIds: strings, status: enumeration('draft', 'published', 'archived'), date,
  }, ['title']),
  recruitment: entity('recruitment', {
    status: enumeration('draft', 'open', 'closed', 'archived'), summary: local,
    contactEmail: { type: ['string', 'null'], format: 'email' }, formUrl: url,
  }, ['title', 'status', 'summary', 'contactEmail', 'formUrl']),
  media: entity('media', {
    path: { type: 'string', pattern: '^assets/[^?#]+$' }, fallbackPath: { type: 'string', pattern: '^assets/[^?#]+$' },
    alt: local, source: text, width: { type: 'integer', minimum: 1 }, height: { type: 'integer', minimum: 1 },
    copyrightStatus: text, contentHash: text,
    focalPoint: object({ x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } }),
  }, ['path', 'alt', 'source', 'width', 'height']),
  evidence: object({ id: { type: 'string', pattern: '^evidence:' }, type: text, title: text, path: text, verifiedAt: date }),
  redirect: object({ id: { type: 'string', pattern: '^redirect:' }, from: { type: 'string', pattern: '^/' }, to: { type: 'string', pattern: '^/' }, statusCode: enumeration(301, 308) }),
  direction: object({ id: { type: 'string', pattern: '^direction:[a-zA-Z0-9_-]+$' }, title: local, summary: local, topics: strings, visual: enumeration('tokens','medical','chaos','agents'), evidenceRefs: refs }, ['id', 'title', 'summary', 'evidenceRefs']),
  settings: object({
    schemaVersion: text,
    brand: object({ name: text, displayName: text, slogan: text, tagline: text, logo: text }),
    locale: enumeration('zh-CN'), defaultLanguage: enumeration('zh'), supportedLanguages: strings,
    contentNotes: strings,
    evidenceRefs: refs, hero: object({ lead: text, stack: text }),
    about: object({ overview: object({ value: local, evidenceRefs: refs }), directions: array({ $ref: '#/$defs/direction' }) }),
    meta: object({ title: text, description: text }),
  }, ['schemaVersion', 'brand', 'locale', 'hero', 'about', 'meta', 'evidenceRefs']),
  paths: object({ evidenceRefs: refs, sourceSections: strings,
    careers: array(object({ organization: text, role: text })),
    furtherStudy: array(object({ organization: text, note: { type: ['string', 'null'] }, memberCount: { type: 'integer', minimum: 1 } })),
  }),
};
const collectionTypes = {
  projects: 'project', organizations: 'organization', outputs: 'output', achievements: 'achievement',
  events: 'event', news: 'news', recruitment: 'recruitment', 'media-assets': 'media', evidence: 'evidence', redirects: 'redirect',
};
export const contentSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://aita.local/schemas/content',
  ...object({
    ...Object.fromEntries(Object.entries(collectionTypes).map(([name, type]) => [name, array({ $ref: `#/$defs/${type}` })])),
    settings: { $ref: '#/$defs/settings' }, 'member-paths': { $ref: '#/$defs/paths' },
  }),
  $defs: definitions,
};
