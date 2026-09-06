import layout from './map-layout.json' with { type: 'json' };

/** @param {ReturnType<import('../../packages/content-loader-git/index.mjs').loadContent>['organizations']} organizations */
export function networkPartners(organizations) {
  const byId = new Map(organizations.map(org => [org.id, org]));
  for (const item of layout) if (!byId.has(item.organizationId)) throw new Error(`Unknown map organization: ${item.organizationId}`);
  return organizations.filter(org => org.listedPartner).map((org, index) => ({
    group: 'unlocated', map: 'UNLOCATED', city: '地点未提供', anchor: 'UNLOCATED', shape: 'community',
    ...(layout.find(item => item.organizationId === org.id) ?? {}),
    id: org.id, number: String(index + 1).padStart(2, '0'), name: org.mapName ?? org.name.zh,
    category: org.mapCategory ?? org.category.toUpperCase(), family: org.mapFamily ?? 'OTHER',
    precision: 'UNSPECIFIED', precisionKind: 'unspecified', lon: null, lat: null,
    address: '地址未提供', pinBasis: '未提供定位资料', ...org.mapLocation,
  }));
}
