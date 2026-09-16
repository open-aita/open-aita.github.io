// Shared by the static detail panel and its browser enhancement.
export function formatPosition(p) {
  if (p?.lon == null || p.lat == null) return p?.group === 'native' ? 'NON-GEOGRAPHIC / DISTRIBUTED' : 'LOCATION NOT PROVIDED';
  const decimals = p.precisionKind === 'approx' ? 2 : 5;
  return `${Math.abs(p.lat).toFixed(decimals)}°${p.lat >= 0 ? 'N' : 'S'} / ${Math.abs(p.lon).toFixed(decimals)}°${p.lon >= 0 ? 'E' : 'W'} · ${p.precisionKind === 'approx' ? 'APPROX.' : 'WGS84'}`;
}
export function displayMode(p) {
  return p?.group === 'native' ? 'NETWORK-NATIVE SIGNAL' : p?.lon == null ? 'LOCATION NOT PROVIDED' : 'GEOGRAPHIC ANCHOR / SHORT LEADER';
}
