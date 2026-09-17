/* Builds apps/site/public/assets/geo/gba-borders.json — the city outlines drawn over the
   Network section's Greater Bay Area detail figure.

   The detail figure is a point cloud (see export.html); it carries no inland borders, so the
   reader cannot tell where one city ends and the next begins. The outlines below are the real
   prefecture boundaries, clipped to the cloud's frame and simplified to the cloud's own pixel
   scale so they cost nothing visible in fidelity.

   Source: DataV.GeoAtlas administrative boundaries (https://geo.datav.aliyun.com/areas_v3/bound/).
   The downloads are committed under geo-source/ next to this file, so the build reproduces
   offline; --refresh re-fetches them.
   Run: node tools/artwork/build-gba-borders.mjs [--refresh] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = path.join(ROOT, 'tools/artwork/geo-source');
const OUT = path.join(ROOT, 'apps/site/public/assets/geo/gba-borders.json');

// The cloud this layer is registered against. Keep in step with network-cloud-source.json's
// `gba` entry: the client maps these degrees through the same rect the bitmap is drawn into.
const FRAME = [110.45, 20.85, 117.75, 24.5]; const GRID = [1360, 680];
// The cloud is 1360px across 7.3° — 186px per degree — and the panel shows a crop of it at
// roughly two thirds that. 0.005° is about one cloud pixel, so simplifying this far costs
// nothing the reader can see and keeps the file an order of magnitude below the bitmap.
const TOLERANCE = 0.005;
// Rings are kept past the frame edge so a border that leaves and re-enters stays continuous.
const MARGIN = 0.12; const MIN_EXTENT = 0.006;   // ≈1 cloud pixel: below this a ring is a speck, not a shape

const PROVINCES = [
  { adcode: '440000', full: true },   // 广东省 — prefecture-level cities
  { adcode: '810000', full: false },  // 香港特别行政区 — one outline; districts would be sub-pixel
  { adcode: '820000', full: false },  // 澳门特别行政区
];

const EN = {
  '440100': 'GUANGZHOU', '440200': 'SHAOGUAN', '440300': 'SHENZHEN', '440400': 'ZHUHAI',
  '440500': 'SHANTOU', '440600': 'FOSHAN', '440700': 'JIANGMEN', '440800': 'ZHANJIANG',
  '440900': 'MAOMING', '441200': 'ZHAOQING', '441300': 'HUIZHOU', '441400': 'MEIZHOU',
  '441500': 'SHANWEI', '441600': 'HEYUAN', '441700': 'YANGJIANG', '441800': 'QINGYUAN',
  '441900': 'DONGGUAN', '442000': 'ZHONGSHAN', '445100': 'CHAOZHOU', '445200': 'JIEYANG',
  '445300': 'YUNFU', '810000': 'HONG KONG', '820000': 'MACAU',
};

const refresh = process.argv.includes('--refresh');

async function source({ adcode, full }) {
  const file = path.join(SOURCE, `${adcode}${full ? '_full' : ''}.json`);
  if (refresh || !fs.existsSync(file)) {
    const url = `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}${full ? '_full' : ''}.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} → ${response.status}`);
    fs.mkdirSync(SOURCE, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    console.log(`fetched ${path.basename(file)}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const rings = feature => {
  const { type, coordinates } = feature.geometry;
  const polygons = type === 'MultiPolygon' ? coordinates : [coordinates]; return polygons.flat(1);
};

const inFrame = ([lon, lat]) =>
  lon >= FRAME[0] - MARGIN && lon <= FRAME[2] + MARGIN && lat >= FRAME[1] - MARGIN && lat <= FRAME[3] + MARGIN;

// Strokes, never fills, so a border may simply stop where it leaves the frame: cut the ring into
// the runs that are actually on screen instead of clipping the polygon into a closed shape.
function visibleRuns(ring) {
  const count = ring.length; const runs = []; let run = null;
  for (let i = 0; i < count; i++) {
    const a = ring[i], b = ring[(i + 1) % count];
    if (inFrame(a) || inFrame(b)) {
      if (!run) { run = [a]; runs.push(run); }
      run.push(b);
    } else run = null;
  }
  // The wrap-around edge joins the last run back onto the first.
  if (runs.length > 1 && run && run[run.length - 1][0] === runs[0][0][0] && run[run.length - 1][1] === runs[0][0][1]) {
    runs[0] = run.concat(runs[0].slice(1)); runs.pop();
  }
  return runs;
}

function simplify(points, tolerance) {
  if (points.length < 3) return points; const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1; const stack = [[0, points.length - 1]];
  // A closed ring ends where it starts, which would anchor the recursion on a zero-length
  // baseline: every distance measures 0 and the whole ring collapses to its two ends.
  const last = points.length - 1;
  if (points[0][0] === points[last][0] && points[0][1] === points[last][1]) {
    let farthest = 0, anchor = 0;
    for (let i = 1; i < last; i++) {
      const distance = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]);
      if (distance > farthest) { farthest = distance; anchor = i; }
    }
    keep[anchor] = 1; stack.push([0, anchor], [anchor, last]);
  }
  while (stack.length) {
    const [first, last] = stack.pop(); if (last - first < 2) continue;
    const [x1, y1] = points[first], [x2, y2] = points[last]; const dx = x2 - x1, dy = y2 - y1;
    const norm = Math.hypot(dx, dy) || 1; let index = -1, farthest = tolerance;
    for (let i = first + 1; i < last; i++) {
      const [x, y] = points[i]; const distance = Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm;
      if (distance > farthest) { farthest = distance; index = i; }
    }
    if (index < 0) continue; keep[index] = 1; stack.push([first, index], [index, last]);
  }
  return points.filter((_, i) => keep[i]);
}

const extent = points => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
};

const round3 = value => Math.round(value * 1000) / 1000;

const cities = []; let rawPoints = 0, builtPoints = 0;
for (const province of PROVINCES) {
  const collection = await source(province);
  for (const feature of collection.features) {
    const { adcode, name, center } = feature.properties; const paths = [];
    for (const ring of rings(feature)) {
      rawPoints += ring.length;
      for (const run of visibleRuns(ring)) {
        const line = simplify(run, TOLERANCE); if (line.length < 2 || extent(line) < MIN_EXTENT) continue;
        const flat = [];
        for (const [lon, lat] of line) {
          const x = round3(lon), y = round3(lat);
          if (flat.length >= 2 && flat[flat.length - 2] === x && flat[flat.length - 1] === y) continue;
          flat.push(x, y);
        }
        if (flat.length >= 4) { paths.push(flat); builtPoints += flat.length / 2; }
      }
    }
    if (!paths.length) continue; const zh = name.replace(/(市|特别行政区|自治区|省)$/, '');
    cities.push({
      id: adcode, zh, en: EN[adcode] ?? zh.toUpperCase(),
      center: center ? [round3(center[0]), round3(center[1])] : null, paths,
    });
  }
}

cities.sort((a, b) => Number(a.id) - Number(b.id));
const output = {
  source: 'DataV.GeoAtlas administrative boundaries / https://geo.datav.aliyun.com/areas_v3/bound/',
  retrieved: new Date().toISOString().slice(0, 10),
  note: 'Prefecture-level outlines for the Network detail figure, clipped to the cloud frame and simplified. Paths are flat [lon,lat,...] degree runs; the page strokes them as a dot chain, never filled.',
  frame: FRAME, grid: GRID, tolerance: TOLERANCE, cities,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true }); const json = JSON.stringify(output);
fs.writeFileSync(OUT, json + '\n'); const gz = (await import('node:zlib')).gzipSync(Buffer.from(json));
console.log(`\n${path.relative(ROOT, OUT)}`);
console.log(`  ${cities.length} cities, ${cities.reduce((n, c) => n + c.paths.length, 0)} runs`);
console.log(`  source points ${rawPoints} → ${builtPoints} (${(builtPoints / rawPoints * 100).toFixed(1)}%)`);
console.log(`  ${(json.length / 1024).toFixed(1)} KB raw / ${(gz.length / 1024).toFixed(1)} KB gzip`);
