import { formatPosition, displayMode } from './presentation.js';
import { createFlare } from './flare.js';
/* Network Atlas: local point-cloud data and interaction.
   Location data: user-supplied AITA_Network_Address_Verified_v2.html.
   Precision describes the supplied location basis, not independent address verification. */
export function mount(root) {
  'use strict';

  const CLOUDS = {"main":{"bounds":[-12,15,191.5,80],"size":[2442,780],"count":24359},"gba":{"bounds":[110.45,20.85,117.75,24.5],"size":[1360,680],"count":10042}};

  const partners = JSON.parse(root.querySelector('[data-network-data]').textContent);

  const byId = new Map(partners.map(p => [p.id, p]));
  const state = { filter: 'ALL', query: '', lockedId: partners.find(p => p.id === 'org:010')?.id ?? partners[0]?.id ?? null, hoverId: null };
  const cloudImages = {};
  const cloudReady = {};
  // Where each beacon actually sits in its layer, filled in by the overlay renders. The flare
  // ends on these, not on the geographic anchor, so the arcs land on the markers a reader sees.
  const beaconPoints = { main: new Map(), gba: new Map() }; let loading = false;
  const scriptBase = new URL("/assets/images/partners/", location.href);
  const borderSource = new URL('/assets/geo/gba-borders.json', location.href).href;
  const drawRects = {}; let borders = null;

  const $ = (sel, scope=root) => scope.querySelector(sel);
  const $$ = (sel, scope=root) => [...scope.querySelectorAll(sel)];
  const activeId = () => state.hoverId || state.lockedId;

  // The detail panel cycles on its own so the section reads as a live atlas instead of a
  // directory that needs clicking. It walks the research institutes and universities only,
  // narrowed by whatever filter or search is active.
  const ROTATE_INTERVAL = 3300; const ROTATE_CATEGORIES = new Set(['ACADEMIC','INSTITUTE']);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const rotation = { enabled: !reducedMotion.matches, holding: false, visible: false, timer: 0 };
  const flare = createFlare(reducedMotion); let flareGeneration = 0;
  const FLARE_DELAY = 260;   // let the scroll settle before the burst starts
  // Which pool members have had their turn since the last full lap.
  const rotationSeen = new Set();

  function rotationPool() {
    const listed = partners.filter(matches);
    const institutes = listed.filter(p => ROTATE_CATEGORIES.has(p.category));
    // Cycling a single entry is not a rotation; when the filter leaves fewer than two,
    // show everything it left.
    return institutes.length > 1 ? institutes : listed;
  }
  const rotationRunning = () => rotation.enabled && rotation.visible && !rotation.holding && !state.hoverId && !document.hidden;

  function stopRotation() { clearTimeout(rotation.timer); rotation.timer = 0; }

  function scheduleRotation() {
    stopRotation(); if (rotationRunning()) rotation.timer = setTimeout(advanceRotation, ROTATE_INTERVAL);
  }

  function advanceRotation() {
    rotation.timer = 0;
    if (rotationRunning()) {
      const pool = rotationPool(); const index = pool.findIndex(p => p.id === state.lockedId);
      if (pool.length > 1) {
        state.lockedId = pool[(index + 1) % pool.length].id; updateUI(); noteVisited(pool);
      }
    }
    scheduleRotation();
  }

  function noteVisited(pool) {
    if (!pool.length) return; rotationSeen.add(state.lockedId);
    if (!pool.every(p => rotationSeen.has(p.id))) return; rotationSeen.clear(); onRotationCycle();
  }

  function setRotation(enabled) {
    rotation.enabled = enabled; updateUI(); scheduleRotation();
  }

  function updateRotationToggle() {
    const button = $('#rotation-toggle'); if (!button) return;
    const mode = rotation.enabled ? 'auto' : 'hold';
    // Runs on every hover, so leave the button alone once it already says the right thing.
    if (!button.hidden && button.dataset.mode === mode) return; button.hidden = false;
    button.textContent = rotation.enabled ? 'AUTO' : 'HOLD'; button.dataset.mode = mode;
    button.setAttribute('aria-pressed', String(rotation.enabled));
    button.setAttribute('aria-label', rotation.enabled ? '暂停合作单位自动轮询' : '在各科研机构、院校之间自动轮询');
  }

  // The main cloud is exported on the point grid's own resolution, which on a phone is 3.5x the
  // pixels the map can draw, and that resample is the one part of the chapter's first render a
  // phone notices. The half cut is the same drawing at half the grid; pick by what the map will
  // actually draw, so a narrow or low-density screen takes it and a wide one keeps the full grid.
  const HALF_GRID = CLOUDS.main.size[0] / 2;
  function cloudFile(key) {
    if (key !== 'main') return `network-${key}.webp`;
    const frame = $('#main-map-frame'); const [dataW, dataH] = CLOUDS.main.size;
    const drawn = frame ? Math.min(frame.clientWidth, frame.clientHeight * dataW / dataH) : 0;
    // A frame that has not been laid out reads as zero; the full grid is the safe answer there.
    const need = drawn * Math.min(window.devicePixelRatio || 1, 2);
    return need > 0 && need <= HALF_GRID ? 'network-main-half.webp' : `network-${key}.webp`;
  }

  function loadCloudImages() {
    if (loading) return; loading = true;
    Object.keys(CLOUDS).forEach(key => {
      const image = new Image(); image.decoding = 'async'; image.fetchPriority = 'low';
      image.src = new URL(`${cloudFile(key)}?v=20260905-2`, scriptBase).href;
      cloudReady[key] = image.decode().then(() => {
        cloudImages[key] = image; if (started) renderCloud($(key === 'main' ? '#main-map' : '#gba-map'), key);
      }).catch(error => {
        console.warn(`Network ${key} background could not load:`, error);
      });
    });
  }

  function fitRect(containerW, containerH, dataW, dataH) {
    const dataAspect = dataW / dataH; const boxAspect = containerW / containerH;
    if (boxAspect > dataAspect) {
      const h = containerH, w = h * dataAspect;
      return {x:(containerW-w)/2, y:0, width:w, height:h};
    }
    const w = containerW, h = w / dataAspect;
    return {x:0, y:(containerH-h)/2, width:w, height:h};
  }

  function coverRect(containerW, containerH, dataW, dataH, focusX, focusY) {
    const dataAspect = dataW / dataH; const boxAspect = containerW / containerH;
    if (boxAspect > dataAspect) {
      const w = containerW, h = w / dataAspect;
      return {x:0, y:(containerH-h)*focusY, width:w, height:h};
    }
    const h = containerH, w = h * dataAspect;
    return {x:(containerW-w)*focusX, y:0, width:w, height:h};
  }

  function renderCloud(canvas, key) {
    const cloud = CLOUDS[key]; const image = cloudImages[key]; const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW*dpr); canvas.height = Math.round(cssH*dpr);
    const ctx = canvas.getContext('2d', {alpha:true}); ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,cssW,cssH); const rect = key === 'gba'
      ? (cssW >= 760
          ? coverRect(cssW,cssH,cloud.size[0],cloud.size[1],.60,.50)
          : {x:0, y:0, width:cssW, height:cssH})
      : fitRect(cssW,cssH,cloud.size[0],cloud.size[1]);
    drawRects[key] = rect; // The retained source/browser export tool owns the point loops and glow pass.
    // One bitmap blit replaces 32,431 per-point paths during first scroll.
    if (image) {
      ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height); canvas.classList.add('is-ready');
    }
  }

  function loadBorders() {
    fetch(borderSource)
      .then(response => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
      .then(data => {
        borders = data; if (started) renderBorders();
      })
      .catch(error => console.warn('Network city outlines could not load:', error));
  }

  // The detail bitmap is a scatter of points with the coastline in it and nothing else: no reader
  // can tell where one city stops. These are the real prefecture outlines, drawn in the cloud's
  // own pixel grid and placed by viewBox, so a resize only rewrites one attribute.
  function renderBorders() {
    const panel = $('#gba-panel'); const svg = $('#gba-borders'); const rect = drawRects.gba;
    if (!panel || !svg || !borders || !rect) return; const [gridW, gridH] = borders.grid;
    const scaleX = rect.width / gridW, scaleY = rect.height / gridH;
    // The layer covers the panel, but the bitmap was blitted into `rect` — on a wide panel a crop
    // of the cloud that starts left of the panel. Point the viewBox at that same part of the grid
    // so every outline falls on the pixels the cloud was drawn to.
    const viewX = -rect.x / scaleX, viewY = -rect.y / scaleY;
    svg.setAttribute('viewBox', `${viewX} ${viewY} ${panel.clientWidth / scaleX} ${panel.clientHeight / scaleY}`);
    svg.setAttribute('preserveAspectRatio', 'none'); if (svg.childElementCount) return;
    const [lon0, lat0, lon1, lat1] = borders.frame;
    const gx = lon => ((lon - lon0) / (lon1 - lon0) * gridW).toFixed(1);
    const gy = lat => ((lat1 - lat) / (lat1 - lat0) * gridH).toFixed(1);
    const fragment = document.createDocumentFragment();
    for (const city of borders.cities) {
      const d = city.paths.map(path => {
        let line = '';
        for (let i = 0; i < path.length; i += 2) line += `${i ? 'L' : 'M'}${gx(path[i])} ${gy(path[i + 1])}`;
        return line;
      }).join('');
      const shape = svgEl('g', { class: 'city-shape', 'data-city-en': city.en });
      shape.append(svgEl('path', { class: 'city-border', d })); fragment.append(shape);
    }
    svg.append(fragment);
  }

  function project(key, lon, lat) {
    const cloud = CLOUDS[key]; const rect = drawRects[key]; const [lon0,lat0,lon1,lat1] = cloud.bounds;
    return {
      x: rect.x + ((lon-lon0)/(lon1-lon0))*rect.width, y: rect.y + ((lat1-lat)/(lat1-lat0))*rect.height
    };
  }

  // One burst per map. Fired the first time each map is properly in view, and again every time
  // the panel has walked the whole institute and university pool. Each leaves from the anchor
  // its map is actually about: the continental map from the Greater Bay Area, the regional
  // detail from the Jieyang campus.
  const flares = [
    { target: '#main-map-frame', layer: '#main-flare', key: 'main',
      mine: p => p.group === 'main', origin: () => project('main',113.72,22.72) },
    { target: '#gba-panel', layer: '#gba-flare', key: 'gba',
      mine: p => p.group === 'gba' && p.id !== 'org:029',
      origin: () => { const hq = byId.get('org:029'); return hq?.lon == null ? null : project('gba',hq.lon,hq.lat); } },
  ];

  function onScreen(selector) {
    const el = $(selector); if (!el) return false; const box = el.getBoundingClientRect();
    return Math.min(box.bottom, innerHeight) - Math.max(box.top, 0) > box.height * .5;
  }

  function fireFlares(specs) {
    for (const spec of specs) {
      const layer = $(spec.layer); const origin = drawRects[spec.key] && spec.origin();
      if (!layer || !origin) continue; const points = partners
        .filter(p => spec.mine(p) && matches(p))
        .map(p => beaconPoints[spec.key].get(p.id))
        .filter(Boolean);
      const quiet = flare.fire(layer, origin, points); const generation = flareGeneration;
      if (quiet) setTimeout(() => { if (generation === flareGeneration) flare.clearLayer(layer); }, quiet);
    }
  }

  // Runs from the flare observer, which is registered after the section observer that starts
  // rendering, so the projection and the decoded bitmaps are already in place by then.
  function launchFlare(spec) {
    if (spec.fired || !drawRects[spec.key] || !cloudReady[spec.key]) return false; spec.fired = true;
    const frame = $(spec.target);
    // A phone shows this map about 350px wide; the arcs would overlap into a single smear.
    if (!frame || frame.clientWidth < 720 || reducedMotion.matches || document.hidden) return true;
    if (!spec.origin()) return true; const generation = flareGeneration;
    cloudReady[spec.key].then(() => {
      if (document.hidden || generation !== flareGeneration) return; fireFlares([spec]);
    }); return true;
  }

  // The panel walking the whole pool is the cue to shoot again — the map answers the directory.
  // Setting the panel to HOLD stops this too, because it stops the walk.
  function onRotationCycle() {
    if (reducedMotion.matches || document.hidden) return;
    fireFlares(flares.filter(spec => spec.fired && onScreen(spec.target)));
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg',tag);
    for (const [k,v] of Object.entries(attrs)) el.setAttribute(k,String(v)); return el;
  }

  function createLineGroup(svg, p, anchor, end, city=false) {
    const kind = p.precisionKind || 'regional';
    const g = svgEl('g', {'class':`line-group is-${kind}`, 'data-partner-id':p.id});
    const dx = end.x-anchor.x, dy = end.y-anchor.y; const length = Math.hypot(dx,dy) || 1;
    const bend = city ? Math.min(12,length*.12) : 0;
    const path = `M ${anchor.x} ${anchor.y} Q ${(anchor.x+end.x)/2-bend*dy/length} ${(anchor.y+end.y)/2+bend*dx/length} ${end.x} ${end.y}`;
    const line = svgEl('path', {d:path,'class':`signal-line${city?' signal-line-city':''}`});
    const halo = svgEl('circle', {cx:anchor.x,cy:anchor.y,r:4.4,'class':'signal-anchor-halo'});
    const dot = svgEl('circle', {cx:anchor.x,cy:anchor.y,r:2,'class':'signal-anchor'});
    g.append(line,halo,dot); svg.append(g);
  }

  function createBeacon(layer, p, end, micro=false) {
    const b = document.createElement('button'); b.type = 'button';
    b.className = `beacon${micro?' beacon--micro':''}`; b.dataset.partnerId = p.id;
    b.dataset.family = p.family; b.dataset.shape = p.shape; b.dataset.precisionKind = p.precisionKind;
    b.dataset.labelAlign = p.align || 'right';
    b.style.left = `${end.x}px`; b.style.top = `${end.y}px`;
    b.title = `${p.name}\n${p.address}`;
    b.setAttribute('aria-label', `${p.number} ${p.name}，${p.anchor}，${p.precision}`);
    b.innerHTML = '<span class="beacon-core" aria-hidden="true"></span><span class="beacon-number"></span>';
    b.querySelector('.beacon-number').textContent = p.number;
    if (!micro && !p.hideLabel) {
      const label = document.createElement('span'); label.className = 'beacon-label';
      label.textContent = p.label || p.anchor; b.append(label);
    }
    bindPartnerEvents(b,p.id); layer.append(b);
  }

  function renderMainOverlay() {
    const frame = $('#main-map-frame'); const svg = $('#main-lines'); const layer = $('#main-beacons');
    svg.replaceChildren(); layer.replaceChildren();
    svg.setAttribute('viewBox',`0 0 ${frame.clientWidth} ${frame.clientHeight}`);
    const scale = frame.clientWidth / CLOUDS.main.size[0]; beaconPoints.main.clear();
    partners.filter(p=>p.group==='main').forEach(p => {
      const anchor = project('main',p.lon,p.lat);
      const end = {x:anchor.x+p.dx*scale, y:anchor.y+p.dy*scale}; beaconPoints.main.set(p.id, end);
      createLineGroup(svg,p,anchor,end,false); createBeacon(layer,p,end,false);
    });

    // Regional cluster and headquarters must not share a geographic anchor.
    const gbaAnchor = project('main',113.72,22.72);
    const clusterEnd = {x:gbaAnchor.x-38*scale,y:gbaAnchor.y-82*scale};
    const pseudo = {id:'GBA'}; createLineGroup(svg,pseudo,gbaAnchor,clusterEnd,false);
    const button = document.createElement('button');
    button.type='button'; button.className='cluster-beacon'; button.id='gba-cluster-beacon';
    button.style.left=`${clusterEnd.x}px`; button.style.top=`${clusterEnd.y}px`;
    const regionalCount = partners.filter(p => p.group === 'gba').length;
    const hqCount = partners.filter(p => p.city === '揭阳').length;
    button.setAttribute('aria-label',`查看粤港澳大湾区与广东工业大学揭阳校区的 ${regionalCount} 个合作信号`);
    button.innerHTML=`<span class="cluster-beacon-ring" aria-hidden="true"></span><span class="cluster-beacon-label">GREATER BAY AREA<small>+ ${String(hqCount).padStart(2,'0')} JIEYANG HQ / OPEN DETAIL ↘</small></span>`;
    const hq = byId.get('org:029');
    if (hq) {
    const hqAnchor = project('main',hq.lon,hq.lat);
    const hqEnd = {x:hqAnchor.x+24*scale,y:hqAnchor.y+26*scale};
    createLineGroup(svg,{id:'HQ',precisionKind:'host'},hqAnchor,hqEnd);
    const hqLabel = document.createElement('span'); hqLabel.className = 'hq-anchor-label';
    hqLabel.style.left = `${hqEnd.x}px`; hqLabel.style.top = `${hqEnd.y}px`;
    hqLabel.innerHTML = `AITA HQ / ${String(hqCount).padStart(2,'0')}<small>JIEYANG CAMPUS</small>`;
    layer.append(hqLabel);
    }
    button.addEventListener('click',()=>{ state.lockedId=partners.find(p=>p.group==='gba' && p.city!=='揭阳' && matches(p))?.id || null; state.hoverId=null; setRotation(false); $('#gba-panel').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'}); });
    layer.append(button);
  }

  function renderGbaOverlay() {
    const panel = $('#gba-panel'); const svg = $('#gba-lines'); const layer = $('#gba-beacons');
    svg.replaceChildren(); layer.replaceChildren();
    svg.setAttribute('viewBox',`0 0 ${panel.clientWidth} ${panel.clientHeight}`); const placed = [];
    beaconPoints.gba.clear();
    partners.filter(p=>p.group==='gba').forEach(p => {
      const anchor = project('gba',p.lon,p.lat);
      // Keep the reference's label direction, not its distant perimeter position.
      // A small, deterministic search runs only on render/resize, never per frame.
      const angle = Math.atan2(p.display[1]*panel.clientHeight-anchor.y,p.display[0]*panel.clientWidth-anchor.x);
      const preferred = {x:anchor.x+72*Math.cos(angle),y:anchor.y+72*Math.sin(angle)};
      let end, bestScore = Infinity;
      for (const radius of [34,58,82,106,130]) {
        for (let step=0;step<24;step++) {
          const a = angle+step*Math.PI/12;
          const point = {x:anchor.x+radius*Math.cos(a),y:anchor.y+radius*Math.sin(a)};
          if (point.x<20 || point.x>panel.clientWidth-38 || point.y<78 || point.y>panel.clientHeight-42) continue;
          const overlaps = placed.filter(pt=>Math.abs(pt.x-point.x)<38 && Math.abs(pt.y-point.y)<30).length;
          const score = overlaps*1e6+(point.x-preferred.x)**2+(point.y-preferred.y)**2;
          if (score<bestScore) {bestScore=score;end=point;}
        }
      }
      end ||= anchor; placed.push(end); beaconPoints.gba.set(p.id, end);
      createLineGroup(svg,p,anchor,end,true); createBeacon(layer,p,end,true);
    });
    const cities = {
      GUANGZHOU: {...project('gba',113.313,23.132),dx:-12,dy:-132},
      SHENZHEN: {...project('gba',114.025,22.598),dx:24,dy:128},
      'HONG KONG': {...project('gba',114.194,22.365),dx:72,dy:80},
      ...(byId.has('org:029') ? { JIEYANG: {...project('gba',byId.get('org:029').lon,byId.get('org:029').lat),dx:-18,dy:-102} } : {})
    };
    for (const [city,pt] of Object.entries(cities)) {
      const el = panel.querySelector(`[data-city-label="${city}"]`); if (!el) continue;
      const x=Math.max(70,Math.min(panel.clientWidth-92,pt.x+pt.dx));
      const y=Math.max(58,Math.min(panel.clientHeight-44,pt.y+pt.dy));
      el.style.left=`${x}px`; el.style.top=`${y}px`;
    }
  }

  function bindPartnerEvents(el,id) {
    el.addEventListener('pointerenter',()=>{ state.hoverId=id; updateUI(); });
    el.addEventListener('pointerleave',()=>{ state.hoverId=null; updateUI(); });
    el.addEventListener('focus',()=>{ state.hoverId=id; updateUI(); });
    el.addEventListener('blur',()=>{ state.hoverId=null; updateUI(); });
    el.addEventListener('click',()=>{ state.lockedId=id; state.hoverId=null; setRotation(false); });
  }

  function matches(p) {
    if (!p) return false; const typeOK = state.filter==='ALL' || p.family===state.filter;
    const q = state.query.trim().toLowerCase();
    const queryOK = !q || `${p.number} ${p.name} ${p.anchor} ${p.city} ${p.category} ${p.address} ${p.pinBasis}`.toLowerCase().includes(q);
    return typeOK && queryOK;
  }


  function updateSelection() {
    const id = activeId(); const p = byId.get(id); $('#locate-index').disabled = !p;
    if (!p) {
      $('#selection-status').textContent = `00 / ${partners.length}`;
      $('#selection-code').textContent = 'NO MATCH'; $('#selection-name').textContent = '未找到匹配的合作单位';
      ['anchor', 'map', 'position', 'address', 'basis', 'precision', 'category', 'display'].forEach(field => {
        $('#selection-' + field).textContent = '—';
      }); $('#selection-note').textContent = '调整类别或搜索关键词，或点击 RESET 恢复完整名录。'; return;
    }
    $('#selection-status').textContent = `${p.number} / ${partners.length}`;
    $('#selection-code').textContent = `NODE:${p.number} / ${p.category}`;
    $('#selection-name').textContent = p.name; $('#selection-anchor').textContent = p.anchor;
    $('#selection-map').textContent = p.map; $('#selection-position').textContent = formatPosition(p);
    $('#selection-address').textContent = p.address; $('#selection-basis').textContent = p.pinBasis;
    $('#selection-precision').textContent = p.precision; $('#selection-category').textContent = p.category;
    $('#selection-display').textContent = displayMode(p);
    // The note line only speaks up when nothing matches, to point back at the controls.
    $('#selection-note').textContent = '';
  }

  function updateUI() {
    const id = activeId(); const pActive = byId.get(id);
    // Beacons and index rows are both selectable buttons for a partner; they take
    // the same active/filtered state from the current selection.
    const syncSelectable = selector => $$(selector).forEach(el => {
      const p=byId.get(el.dataset.partnerId); el.classList.toggle('is-active',el.dataset.partnerId===id);
      el.classList.toggle('is-filtered',!matches(p)); el.disabled = !matches(p);
      el.setAttribute('aria-pressed', String(el.dataset.partnerId === id));
    }); syncSelectable('.beacon[data-partner-id]');
    $$('.line-group[data-partner-id]').forEach(el => {
      const pid=el.dataset.partnerId; if (pid==='GBA' || pid==='HQ') return; const p=byId.get(pid);
      el.classList.toggle('is-active',pid===id); el.classList.toggle('is-filtered',!matches(p));
    }); const gbaVisible = partners.some(p=>p.group==='gba' && p.city!=='揭阳' && matches(p));
    const gbaActive = pActive?.group==='gba' && pActive.city!=='揭阳'; const cluster=$('#gba-cluster-beacon');
    if(cluster){
      cluster.classList.toggle('is-active',gbaActive); cluster.classList.toggle('is-filtered',!gbaVisible);
      cluster.disabled = !gbaVisible;
    }
    const clusterLine=$('.line-group[data-partner-id="GBA"]');
    if(clusterLine){ clusterLine.classList.toggle('is-related',gbaActive); clusterLine.classList.toggle('is-filtered',!gbaVisible); }
    const hqLine=$('.line-group[data-partner-id="HQ"]');
    if(hqLine){
      hqLine.classList.toggle('is-related',pActive?.city==='揭阳');
      hqLine.classList.toggle('is-filtered',!partners.some(p=>p.city==='揭阳' && matches(p)));
    }
    syncSelectable('.partner-index-item'); const visible=partners.filter(matches).length;
    $('#search-count').textContent=`${String(visible).padStart(2,'0')} / ${partners.length}`;
    $('#index-empty').classList.toggle('is-visible',visible===0); updateSelection(); updateRotationToggle();
  }

  function buildIndex() {
    $$('.partner-index-item').forEach(item => bindPartnerEvents(item, item.dataset.partnerId));
  }

  function setFilter(value) {
    state.filter=value; state.hoverId=null; rotationSeen.clear();
    $$('.filter-button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.networkFilter===value)));
    if (!state.lockedId || !matches(byId.get(state.lockedId))) state.lockedId = partners.find(matches)?.id || null;
    updateUI(); scheduleRotation();
  }

  // The first render lands while the reader is still scrolling toward the section. As one task it
  // carried two canvas backing stores, two bitmap blits and ~290 nodes, which is a visible stall
  // on a phone. One step per frame bounds what any single frame has to do; the drawing still
  // happens in the same order, so the finished picture is the same one.
  let renderStages = []; let stageFrame = 0;
  const runStage = () => {
    stageFrame = 0; const step = renderStages.shift(); if (!step) return;
    step(); if (renderStages.length) stageFrame = requestAnimationFrame(runStage);
  };
  function renderAll() {
    // A re-render means the projection moved, so retract anything still in flight.
    flareGeneration += 1; flare.clear();
    renderStages = [
      () => renderCloud($('#main-map'), 'main'), () => renderCloud($('#gba-map'), 'gba'),
      renderBorders, renderMainOverlay, renderGbaOverlay, updateUI,
    ];
    if (!stageFrame) stageFrame = requestAnimationFrame(runStage);
  }

  buildIndex();
  $$('.filter-button').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.networkFilter)));
  $('#partner-search').addEventListener('input', e => {
    state.query = e.target.value; state.hoverId = null; rotationSeen.clear();
    if (!state.lockedId || !matches(byId.get(state.lockedId))) {
      state.lockedId = partners.find(matches)?.id || null;
    }
    updateUI(); scheduleRotation();
  });
  $('#locate-index').addEventListener('click',()=>{ const el=$(`.partner-index-item[data-partner-id="${activeId()}"]`); if(el) el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'}); });
  function resetSelection() {
    state.lockedId = partners.find(p => p.id === 'org:010')?.id ?? partners[0]?.id ?? null; state.query = '';
    $('#partner-search').value = ''; rotation.enabled = !reducedMotion.matches; setFilter('ALL');
  }
  $('#clear-selection').addEventListener('click', resetSelection);
  root.addEventListener('keydown',e=>{ if(e.key==='Escape') resetSelection(); });
  $('#rotation-toggle').addEventListener('click', () => setRotation(!rotation.enabled));
  reducedMotion.addEventListener('change', () => setRotation(!reducedMotion.matches));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopRotation(); else scheduleRotation(); });
  // Reading the panel holds it. The pointer resting on a control does not, so the toggle
  // below never looks stuck while the cursor is still on it.
  const selectionPanel = $('.selection-panel');
  selectionPanel.addEventListener('pointerover', event => {
    rotation.holding = !(event.target instanceof Element && event.target.closest('button, a, input'));
    if (rotation.holding) stopRotation(); else scheduleRotation();
  });
  selectionPanel.addEventListener('pointerout', event => {
    if (event.relatedTarget && selectionPanel.contains(event.relatedTarget)) return; rotation.holding = false;
    scheduleRotation();
  });

  // The cloud is static: draw only near the viewport and after an actual resize.
  let started = false; let resizeTimer = 0;
  const scheduleRender = () => {
    if (!started) return; clearTimeout(resizeTimer); resizeTimer = setTimeout(renderAll, 90);
  };
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(scheduleRender); ro.observe($('#main-map-frame'));
    ro.observe($('#gba-panel'));
  } else {
    window.addEventListener('resize', scheduleRender);
  }
  updateUI();
  const startRendering = () => {
    if (started) return; started = true; loadCloudImages(); loadBorders(); renderAll();
  }; // Fetch at low priority after the first page load; draw only near the viewport.
  if (document.readyState === 'complete') { loadCloudImages(); loadBorders(); }
  else window.addEventListener('load', () => { loadCloudImages(); loadBorders(); }, { once: true });
  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return; startRendering(); observer.disconnect();
    }, { rootMargin: '400px' }); observer.observe(root);
    // Only cycle while the panel is actually on screen; off-screen it would burn through
    // the pool the reader never sees.
    const visibilityObserver = new IntersectionObserver(entries => {
      rotation.visible = entries.some(entry => entry.isIntersecting);
      if (rotation.visible) scheduleRotation(); else stopRotation();
    }, { threshold: 0 }); visibilityObserver.observe($('.selection-panel'));
    // Fires only once the map is genuinely in view — a burst at the first sliver of the frame
    // is over before the reader has scrolled to it — and a beat after the page-level reveal
    // (margin -8%, threshold .08), so the heading settles first and the map answers it.
    const flareObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const spec = flares.find(item => item.target === `#${entry.target.id}`);
        if (!spec || spec.fired || spec.pending) continue; spec.pending = true;
        setTimeout(() => {
          spec.pending = false; if (launchFlare(spec)) flareObserver.unobserve(entry.target);
        }, FLARE_DELAY);
      }
    }, { threshold: .8, rootMargin: '0px 0px -8%' });
    flares.forEach(spec => { const el = $(spec.target); if (el) flareObserver.observe(el); });
  } else {
    rotation.visible = true; startRendering();
  }
}
