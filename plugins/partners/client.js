import { formatPosition, displayMode, locationNote } from './presentation.js';
/* Network Atlas: local point-cloud data and interaction.
   Location data: user-supplied AITA_Network_Address_Verified_v2.html.
   Precision describes the supplied location basis, not independent address verification. */
export function mount(root) {
  'use strict';

  if (!root) return;

  const CLOUDS = {"main":{"bounds":[-12,15,147,80],"size":[1908,780],"count":22389},"gba":{"bounds":[110.45,20.85,117.75,24.5],"size":[1360,680],"count":10042}};

  const partners = JSON.parse(root.querySelector('[data-network-data]').textContent);

  const byId = new Map(partners.map(p => [p.id, p]));
  const state = { filter: 'ALL', query: '', lockedId: partners.find(p => p.id === 'org:010')?.id ?? partners[0]?.id ?? null, hoverId: null };
  const cloudImages = {};
  let loading = false;
  const scriptBase = new URL("/assets/images/", location.href);
  const drawRects = {};

  const $ = (sel, scope=root) => scope.querySelector(sel);
  const $$ = (sel, scope=root) => [...scope.querySelectorAll(sel)];
  const activeId = () => state.hoverId || state.lockedId;

  function loadCloudImages() {
    if (loading) return;
    loading = true;
    Object.keys(CLOUDS).forEach(key => {
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = 'low';
      image.src = new URL(`network-${key}.webp?v=20260905-2`, scriptBase).href;
      image.decode().then(() => {
        cloudImages[key] = image;
        if (started) renderCloud($(key === 'main' ? '#main-map' : '#gba-map'), key);
      }).catch(error => {
        console.warn(`Network ${key} background could not load:`, error);
      });
    });
  }

  function fitRect(containerW, containerH, dataW, dataH) {
    const dataAspect = dataW / dataH;
    const boxAspect = containerW / containerH;
    if (boxAspect > dataAspect) {
      const h = containerH, w = h * dataAspect;
      return {x:(containerW-w)/2, y:0, width:w, height:h};
    }
    const w = containerW, h = w / dataAspect;
    return {x:0, y:(containerH-h)/2, width:w, height:h};
  }

  function coverRect(containerW, containerH, dataW, dataH, focusX=.5, focusY=.5) {
    const dataAspect = dataW / dataH;
    const boxAspect = containerW / containerH;
    if (boxAspect > dataAspect) {
      const w = containerW, h = w / dataAspect;
      return {x:0, y:(containerH-h)*focusY, width:w, height:h};
    }
    const h = containerH, w = h * dataAspect;
    return {x:(containerW-w)*focusX, y:0, width:w, height:h};
  }

  function renderCloud(canvas, key) {
    const cloud = CLOUDS[key];
    const image = cloudImages[key];
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW*dpr);
    canvas.height = Math.round(cssH*dpr);
    const ctx = canvas.getContext('2d', {alpha:true});
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,cssW,cssH);
    const rect = key === 'gba'
      ? (cssW >= 760
          ? coverRect(cssW,cssH,cloud.size[0],cloud.size[1],.60,.50)
          : {x:0, y:0, width:cssW, height:cssH})
      : fitRect(cssW,cssH,cloud.size[0],cloud.size[1]);
    drawRects[key] = rect;
    // The retained source/browser export tool owns the point loops and glow pass.
    // One bitmap blit replaces 32,431 per-point paths during first scroll.
    if (image) {
      ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
      canvas.classList.add('is-ready');
    }
    return rect;
  }

  function project(key, lon, lat) {
    const cloud = CLOUDS[key];
    const rect = drawRects[key];
    const [lon0,lat0,lon1,lat1] = cloud.bounds;
    return {
      x: rect.x + ((lon-lon0)/(lon1-lon0))*rect.width,
      y: rect.y + ((lat1-lat)/(lat1-lat0))*rect.height
    };
  }

  function svgEl(tag, attrs={}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg',tag);
    for (const [k,v] of Object.entries(attrs)) el.setAttribute(k,String(v));
    return el;
  }

  function createLineGroup(svg, p, anchor, end, city=false) {
    const kind = p.precisionKind || 'regional';
    const g = svgEl('g', {'class':`line-group is-${kind}`, 'data-partner-id':p.id});
    const dx = end.x-anchor.x, dy = end.y-anchor.y;
    const length = Math.hypot(dx,dy) || 1;
    const bend = city ? Math.min(12,length*.12) : 0;
    const path = `M ${anchor.x} ${anchor.y} Q ${(anchor.x+end.x)/2-bend*dy/length} ${(anchor.y+end.y)/2+bend*dx/length} ${end.x} ${end.y}`;
    const line = svgEl('path', {d:path,'class':`signal-line${city?' signal-line-city':''}`});
    const halo = svgEl('circle', {cx:anchor.x,cy:anchor.y,r:4.4,'class':'signal-anchor-halo'});
    const dot = svgEl('circle', {cx:anchor.x,cy:anchor.y,r:2,'class':'signal-anchor'});
    g.append(line,halo,dot); svg.append(g);
  }

  function createBeacon(layer, p, end, micro=false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `beacon${micro?' beacon--micro':''}`;
    b.dataset.partnerId = p.id;
    b.dataset.shape = p.shape;
    b.dataset.precisionKind = p.precisionKind;
    b.dataset.labelAlign = p.align || 'right';
    b.style.left = `${end.x}px`; b.style.top = `${end.y}px`;
    b.title = `${p.name}\n${p.address}`;
    b.setAttribute('aria-label', `${p.number} ${p.name}，${p.anchor}，${p.precision}`);
    b.innerHTML = '<span class="beacon-core" aria-hidden="true"></span><span class="beacon-number"></span>';
    b.querySelector('.beacon-number').textContent = p.number;
    if (!micro) {
      const label = document.createElement('span');
      label.className = 'beacon-label';
      label.textContent = p.label || p.anchor;
      b.append(label);
    }
    bindPartnerEvents(b,p.id);
    layer.append(b);
  }

  function renderMainOverlay() {
    const frame = $('#main-map-frame');
    const svg = $('#main-lines');
    const layer = $('#main-beacons');
    svg.replaceChildren(); layer.replaceChildren();
    svg.setAttribute('viewBox',`0 0 ${frame.clientWidth} ${frame.clientHeight}`);
    const scale = frame.clientWidth / 1908;
    partners.filter(p=>p.group==='main').forEach(p => {
      const anchor = project('main',p.lon,p.lat);
      const end = {x:anchor.x+p.dx*scale, y:anchor.y+p.dy*scale};
      createLineGroup(svg,p,anchor,end,false);
      createBeacon(layer,p,end,false);
    });

    // Regional cluster and headquarters must not share a geographic anchor.
    const gbaAnchor = project('main',113.72,22.72);
    const clusterEnd = {x:gbaAnchor.x-38*scale,y:gbaAnchor.y-82*scale};
    const pseudo = {id:'GBA'};
    createLineGroup(svg,pseudo,gbaAnchor,clusterEnd,false);
    const button = document.createElement('button');
    button.type='button'; button.className='cluster-beacon'; button.id='gba-cluster-beacon';
    button.style.left=`${clusterEnd.x}px`; button.style.top=`${clusterEnd.y}px`;
    const regionalCount = partners.filter(p => p.group === 'gba').length;
    const hqCount = partners.filter(p => p.city === '揭阳').length;
    button.setAttribute('aria-label',`查看粤港澳大湾区与广东工业大学揭阳校区的 ${regionalCount} 个合作信号`);
    button.innerHTML=`<span class="cluster-beacon-ring" aria-hidden="true"></span><span class="cluster-beacon-count">${regionalCount-hqCount}</span><span class="cluster-beacon-label">GREATER BAY AREA<small>+ ${String(hqCount).padStart(2,'0')} JIEYANG HQ / OPEN DETAIL ↘</small></span>`;
    const hq = byId.get('org:029');
    if (hq) {
    const hqAnchor = project('main',hq.lon,hq.lat);
    const hqEnd = {x:hqAnchor.x+24*scale,y:hqAnchor.y+26*scale};
    createLineGroup(svg,{id:'HQ',precisionKind:'host'},hqAnchor,hqEnd);
    const hqLabel = document.createElement('span');
    hqLabel.className = 'hq-anchor-label';
    hqLabel.style.left = `${hqEnd.x}px`; hqLabel.style.top = `${hqEnd.y}px`;
    hqLabel.innerHTML = `AITA HQ / ${String(hqCount).padStart(2,'0')}<small>JIEYANG CAMPUS</small>`;
    layer.append(hqLabel);
    }
    button.addEventListener('click',()=>{ state.lockedId=partners.find(p=>p.group==='gba' && p.city!=='揭阳' && matches(p))?.id || null; state.hoverId=null; updateUI(); $('#gba-panel').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'}); });
    layer.append(button);
  }

  function renderGbaOverlay() {
    const panel = $('#gba-panel');
    const svg = $('#gba-lines');
    const layer = $('#gba-beacons');
    svg.replaceChildren(); layer.replaceChildren();
    svg.setAttribute('viewBox',`0 0 ${panel.clientWidth} ${panel.clientHeight}`);
    const placed = [];
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
      end ||= anchor;
      placed.push(end);
      createLineGroup(svg,p,anchor,end,true);
      createBeacon(layer,p,end,true);
    });
    const cities = {
      GUANGZHOU: {...project('gba',113.313,23.132),dx:-12,dy:-132},
      SHENZHEN: {...project('gba',114.025,22.598),dx:24,dy:128},
      'HONG KONG': {...project('gba',114.194,22.365),dx:72,dy:80},
      ...(byId.has('org:029') ? { JIEYANG: {...project('gba',byId.get('org:029').lon,byId.get('org:029').lat),dx:-18,dy:-102} } : {})
    };
    for (const [city,pt] of Object.entries(cities)) {
      const el = panel.querySelector(`[data-city-label="${city}"]`);
      if (!el) continue;
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
    el.addEventListener('click',()=>{ state.lockedId=id; state.hoverId=null; updateUI(); });
  }

  function matches(p) {
    if (!p) return false;
    const typeOK = state.filter==='ALL' || p.family===state.filter;
    const q = state.query.trim().toLowerCase();
    const queryOK = !q || `${p.number} ${p.name} ${p.anchor} ${p.city} ${p.category} ${p.address} ${p.pinBasis}`.toLowerCase().includes(q);
    return typeOK && queryOK;
  }


  function updateSelection() {
    const id = activeId();
    const p = byId.get(id);
    $('#locate-index').disabled = !p;
    if (!p) {
      $('#selection-status').textContent = `00 / ${partners.length}`;
      $('#selection-code').textContent = 'NO MATCH';
      $('#selection-name').textContent = '未找到匹配的合作单位';
      ['anchor', 'map', 'position', 'address', 'basis', 'precision', 'category', 'display'].forEach(field => {
        $('#selection-' + field).textContent = '—';
      });
      $('#selection-note').textContent = '调整类别或搜索关键词，或点击 RESET 恢复完整名录。';
      return;
    }
    $('#selection-status').textContent = `${p.number} / ${partners.length}`;
    $('#selection-code').textContent = `NODE:${p.number} / ${p.category}`;
    $('#selection-name').textContent = p.name;
    $('#selection-anchor').textContent = p.anchor;
    $('#selection-map').textContent = p.map;
    $('#selection-position').textContent = formatPosition(p);
    $('#selection-address').textContent = p.address;
    $('#selection-basis').textContent = p.pinBasis;
    $('#selection-precision').textContent = p.precision;
    $('#selection-category').textContent = p.category;
    $('#selection-display').textContent = displayMode(p);
    $('#selection-note').textContent = locationNote(p);
  }

  function updateUI() {
    const id = activeId();
    const pActive = byId.get(id);
    $$('.beacon[data-partner-id]').forEach(el => {
      const p=byId.get(el.dataset.partnerId);
      el.classList.toggle('is-active',el.dataset.partnerId===id);
      el.classList.toggle('is-filtered',!matches(p));
      el.disabled = !matches(p);
      el.setAttribute('aria-pressed', String(el.dataset.partnerId === id));
    });
    $$('.line-group[data-partner-id]').forEach(el => {
      const pid=el.dataset.partnerId;
      if (pid==='GBA' || pid==='HQ') return;
      const p=byId.get(pid);
      el.classList.toggle('is-active',pid===id);
      el.classList.toggle('is-filtered',!matches(p));
    });
    const gbaVisible = partners.some(p=>p.group==='gba' && p.city!=='揭阳' && matches(p));
    const gbaActive = pActive?.group==='gba' && pActive.city!=='揭阳';
    const cluster=$('#gba-cluster-beacon');
    if(cluster){
      cluster.classList.toggle('is-active',gbaActive);
      cluster.classList.toggle('is-filtered',!gbaVisible);
      cluster.disabled = !gbaVisible;
    }
    const clusterLine=$('.line-group[data-partner-id="GBA"]');
    if(clusterLine){ clusterLine.classList.toggle('is-related',gbaActive); clusterLine.classList.toggle('is-filtered',!gbaVisible); }
    const hqLine=$('.line-group[data-partner-id="HQ"]');
    if(hqLine){
      hqLine.classList.toggle('is-related',pActive?.city==='揭阳');
      hqLine.classList.toggle('is-filtered',!partners.some(p=>p.city==='揭阳' && matches(p)));
    }
    $$('.partner-index-item').forEach(el => {
      const p=byId.get(el.dataset.partnerId);
      el.classList.toggle('is-active',el.dataset.partnerId===id);
      el.classList.toggle('is-filtered',!matches(p));
      el.disabled = !matches(p);
      el.setAttribute('aria-pressed', String(el.dataset.partnerId === id));
    });
    const native=$('.network-native');
    if (native) {
    native.classList.toggle('is-active',id===native.dataset.partnerId);
    native.style.opacity=matches(byId.get(native.dataset.partnerId))?'1':'.12';
    native.disabled = !matches(byId.get(native.dataset.partnerId));
    native.setAttribute('aria-pressed', String(id === native.dataset.partnerId));
    }
    const visible=partners.filter(matches).length;
    $('#search-count').textContent=`${String(visible).padStart(2,'0')} / ${partners.length}`;
    $('#index-empty').classList.toggle('is-visible',visible===0);
    updateSelection();
  }

  function buildIndex() {
    $$('.partner-index-item').forEach(item => bindPartnerEvents(item, item.dataset.partnerId));
  }

  function setFilter(value) {
    state.filter=value;
    state.hoverId=null;
    $$('.filter-button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.networkFilter===value)));
    if (!state.lockedId || !matches(byId.get(state.lockedId))) state.lockedId = partners.find(matches)?.id || null;
    updateUI();
  }

  function renderAll() {
    renderCloud($('#main-map'),'main');
    renderCloud($('#gba-map'),'gba');
    renderMainOverlay();
    renderGbaOverlay();
    updateUI();
  }

  buildIndex();
  $$('.filter-button').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.networkFilter)));
  $('#partner-search').addEventListener('input', e => {
    state.query = e.target.value;
    state.hoverId = null;
    if (!state.lockedId || !matches(byId.get(state.lockedId))) {
      state.lockedId = partners.find(matches)?.id || null;
    }
    updateUI();
  });
  $('#locate-index').addEventListener('click',()=>{ const el=$(`.partner-index-item[data-partner-id="${activeId()}"]`); if(el) el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'}); });
  function resetSelection() {
    state.lockedId = partners.find(p => p.id === 'org:010')?.id ?? partners[0]?.id ?? null;
    state.query = '';
    $('#partner-search').value = '';
    setFilter('ALL');
  }
  $('#clear-selection').addEventListener('click', resetSelection);
  $('.network-native')?.addEventListener('pointerenter',()=>{state.hoverId=$('.network-native').dataset.partnerId;updateUI();});
  $('.network-native')?.addEventListener('pointerleave',()=>{state.hoverId=null;updateUI();});
  $('.network-native')?.addEventListener('focus',()=>{state.hoverId=$('.network-native').dataset.partnerId;updateUI();});
  $('.network-native')?.addEventListener('blur',()=>{state.hoverId=null;updateUI();});
  $('.network-native')?.addEventListener('click',()=>{state.lockedId=$('.network-native').dataset.partnerId;state.hoverId=null;updateUI();});
  root.addEventListener('keydown',e=>{ if(e.key==='Escape') resetSelection(); });

  // The cloud is static: draw only near the viewport and after an actual resize.
  let started = false;
  let resizeTimer = 0;
  const scheduleRender = () => {
    if (!started) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderAll, 90);
  };
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(scheduleRender);
    ro.observe($('#main-map-frame'));
    ro.observe($('#gba-panel'));
  } else {
    window.addEventListener('resize', scheduleRender);
  }
  updateUI();
  const startRendering = () => {
    if (started) return;
    started = true;
    loadCloudImages();
    renderAll();
  };
  // Fetch at low priority after the first page load; draw only near the viewport.
  if (document.readyState === 'complete') loadCloudImages();
  else window.addEventListener('load', loadCloudImages, { once: true });
  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      startRendering();
      observer.disconnect();
    }, { rootMargin: '400px' });
    observer.observe(root);
  } else {
    startRendering();
  }
}
