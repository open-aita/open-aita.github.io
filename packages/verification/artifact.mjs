import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

export async function filesUnder(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const files = await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesUnder(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return files.flat();
}

export async function inspectArtifact(root, manifests) {
  const dist = path.join(root, 'dist');
  const files = await filesUnder(dist);
  const buffers = new Map(await Promise.all(files.map(async file => [path.relative(dist, file).split(path.sep).join('/'), await fs.readFile(file)])));
  if (!buffers.has('index.html')) return { ok: false, errors: ['Run npm run build: dist/index.html is missing.'], checks: [] };
  const errors = [];
  const checks = [];
  const check = (id, issues, details = {}) => {
    checks.push({ id, status: issues.length ? 'failed' : 'passed', ...details, issues });
    errors.push(...issues.map(issue => `${id}: ${issue}`));
  };
  const html = buffers.get('index.html').toString();
  // Ignore inert JSON payloads while inspecting markup.
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, tag => tag.slice(0, tag.indexOf('>') + 1) + '</script>');
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const anchors = [...markup.matchAll(/\bhref="#([^"]+)"/g)].map(m => m[1]);
  const duplicates = ids.filter((id,i) => ids.indexOf(id) !== i);
  const absent = [...new Set([...anchors, ...manifests.map(m => m.demoEntry.slice(1))].filter(id => !ids.includes(id)))];
  check('html-structure', [...duplicates.map(id => `Duplicate ID ${id}`), ...absent.map(id => `Missing anchor #${id}`)]);
  const images = [...markup.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]);
  check('accessibility-baseline', [
    ...images.filter(tag=>!/\salt(?:\s|=|\/?>)/i.test(tag)).map(tag=>`Image without alt: ${tag.slice(0,100)}`),
    ...(!/<html\b[^>]*lang="zh-CN"/.test(markup) ? ['Missing document language'] : []),
    ...(!markup.includes('class="skip-link"') ? ['Missing skip link'] : []),
  ]);

  const missing = [];
  const remote = [];
  function reference(from, value, runtime = true) {
    if (!value || /^(?:#|%23|data:|blob:|mailto:|tel:)/.test(value)) return;
    if (/^(?:https?:)?\/\//.test(value)) { if (runtime) remote.push(`${from}: ${value}`); return; }
    const clean = decodeURI(value.split(/[?#]/)[0]);
    const target = path.posix.normalize(clean.startsWith('/') ? clean.slice(1) : path.posix.join(path.posix.dirname(from), clean));
    if (target.startsWith('../') || (!buffers.has(target) && !buffers.has(`${target.replace(/\/$/,'')}/index.html`))) missing.push(`${from}: ${value}`);
  }
  for (const [file, buffer] of buffers) {
    const source = buffer.toString();
    if (file.endsWith('.html')) {
      const parsed = source.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>');
      for (const tag of parsed.matchAll(/<(?:script|link|img|iframe|source|a)\b[^>]*>/gi)) {
        for (const m of tag[0].matchAll(/\b(?:src|href|data-src|data-lightbox)="([^"]+)"/g)) {
          reference(file, m[1], !/^<a\b/i.test(tag[0]) && !/rel="canonical"/.test(tag[0]));
        }
        for (const m of tag[0].matchAll(/\bsrcset="([^"]+)"/g)) for (const item of m[1].split(',')) reference(file, item.trim().split(/\s+/)[0]);
      }
    }
    if (file.endsWith('.css')) for (const m of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) reference(file,m[1]);
    if (/\.m?js$/.test(file)) for (const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']((?:\.\.?\/|\/)[^"']+)["']/g)) reference(file,m[1]);
  }
  check('local-assets', [...new Set([...missing, ...remote.map(ref=>`Remote runtime asset ${ref}`)])], { files: files.length });

  const limits = JSON.parse(await fs.readFile(path.join(root,'config/performance.json'),'utf8'));
  const gzipKb = data => gzipSync(data).length / 1024;
  const total = predicate => [...buffers].filter(([file])=>predicate(file)).reduce((sum,[,buffer])=>sum+gzipKb(buffer),0);
  const inlineJs = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!m[1].includes('application/json')).reduce((sum,m)=>sum+(m[2].trim()?gzipKb(m[2]):0),0);
  const inlineCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].reduce((sum,m)=>sum+gzipKb(m[1]),0);
  const measurements = {
    mainJsGzipKb: total(file=>file.startsWith('_astro/') && /\.m?js$/.test(file)) + inlineJs,
    mainCssGzipKb: total(file=>file.startsWith('_astro/') && file.endsWith('.css')) + inlineCss,
    mainHtmlGzipKb: gzipKb(html),
    aboutEffectGzipKb: total(file=>file.startsWith('effects/about/') || file==='effects/effect-budget.js'),
    outputsEffectGzipKb: total(file=>file.startsWith('effects/outputs/') || file==='effects/effect-budget.js'),
  };
  const exceeded = Object.entries(measurements).filter(([key,value])=>!Number.isFinite(limits[key]) || limits[key]<=0 || value>limits[key]).map(([key,value])=>`${key}: ${value.toFixed(2)}; limit ${limits[key]}`);
  check('performance-budget', exceeded, { measurements: Object.fromEntries(Object.entries(measurements).map(([key,value])=>[key,Number(value.toFixed(2))])), limits,
    accounting: 'All emitted main-page JS chunks (including dynamic imports), inline code and CSS; each iframe includes its HTML, CSS, scene, vendor dependencies and shared budget script. Gzip bytes are summed per resource.' });

  const builtAt = (await fs.stat(path.join(dist,'index.html'))).mtimeMs;
  const sourceDirectories = ['content','plugins','packages/domain','packages/content-loader-git','packages/design-system','packages/kernel','apps/site/src','apps/site/public'];
  const sources = (await Promise.all(sourceDirectories.map(dir=>filesUnder(path.join(root,dir))))).flat();
  sources.push(path.join(root,'apps/site/astro.config.mjs'),path.join(root,'package.json'),path.join(root,'package-lock.json'));
  const newer = [];
  for (const file of sources.filter(file=>!file.endsWith('.md'))) if ((await fs.stat(file)).mtimeMs>builtAt+10) newer.push(path.relative(root,file));
  check('build-freshness', newer.map(file=>`Changed since build: ${file}`));
  return { ok: errors.length===0, checks, errors };
}
