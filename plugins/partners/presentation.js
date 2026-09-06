// Shared by the static detail panel and its browser enhancement.
export function formatPosition(p) {
  if (p?.lon == null || p.lat == null) return p?.group === 'native' ? 'NON-GEOGRAPHIC / DISTRIBUTED' : 'LOCATION NOT PROVIDED';
  const decimals = p.precisionKind === 'approx' ? 2 : 5;
  return `${Math.abs(p.lat).toFixed(decimals)}°${p.lat >= 0 ? 'N' : 'S'} / ${Math.abs(p.lon).toFixed(decimals)}°${p.lon >= 0 ? 'E' : 'W'} · ${p.precisionKind === 'approx' ? 'APPROX.' : 'WGS84'}`;
}
export function displayMode(p) {
  return p?.group === 'native' ? 'NETWORK-NATIVE SIGNAL' : p?.lon == null ? 'LOCATION NOT PROVIDED' : 'GEOGRAPHIC ANCHOR / SHORT LEADER';
}
export function locationNote(p) {
  if (p?.group === 'native') return '分布式开源社区不强制绑定单一城市，在地图之外以 network-native 信号呈现。';
  if (p?.lon == null) return '未提供定位资料；名录保留机构信息，地图暂不显示地理位置。';
  if (p.precisionKind === 'approx') return '定位资料未确认办公楼宇，虚线仅表示城市或省级近似位置，不代表企业地址。';
  if (p.precisionKind === 'host') return '定位资料仅指向所属校区，不代表独立楼宇；信号头就近避让，线条起点保留校园锚点。';
  return '位置按提供的地址定位资料展示；信号头就近避让，线条起点保留地理锚点，不等同于具体合作场所。';
}
