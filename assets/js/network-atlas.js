/* Network Atlas: local point-cloud data and interaction.
   Location data: user-supplied AITA_Network_Address_Verified_v2.html.
   Precision describes the supplied location basis, not independent address verification. */
(() => {
  'use strict';

  const root = document.querySelector('#network');
  if (!root) return;

  const CLOUDS = {"main":{"bounds":[-12,15,147,80],"size":[1908,780],"count":22389},"gba":{"bounds":[110.45,20.85,117.75,24.5],"size":[1360,680],"count":10042}};

  const partners = [
    {"id":"01","name":"清华大学智能产业研究院","category":"ACADEMIC","family":"ACADEMIC","shape":"academic","anchor":"BEIJING · HAIDIAN / CN","city":"北京","group":"main","map":"EURASIA / BEIJING","lon":116.330258,"lat":39.993408,"dx":-70,"dy":-82,"label":"TSINGHUA AIR","align":"left","address":"北京市海淀区清华科技园启迪科技大厦C座12层","pinBasis":"启迪科技大厦 C 座","precision":"BUILDING","precisionKind":"exact"},
    {"id":"02","name":"北京大学","category":"ACADEMIC","family":"ACADEMIC","shape":"academic","anchor":"BEIJING · HAIDIAN / CN","city":"北京","group":"main","map":"EURASIA / BEIJING","lon":116.3058739,"lat":39.986913,"dx":-34,"dy":-116,"label":"PEKING UNIVERSITY","align":"left","address":"北京市海淀区颐和园路5号","pinBasis":"北京大学燕园校区","precision":"CAMPUS","precisionKind":"exact"},
    {"id":"03","name":"英国贝法斯特女王大学","category":"GLOBAL","family":"ACADEMIC","shape":"academic","anchor":"BELFAST / UK","city":"贝尔法斯特","group":"main","map":"EURASIA / EUROPE","lon":-5.9340493,"lat":54.5844087,"dx":-15,"dy":-62,"label":"QUEEN'S BELFAST","align":"right","address":"University Road, Belfast BT7 1NN, United Kingdom","pinBasis":"Queen’s University Belfast main campus","precision":"CAMPUS","precisionKind":"exact"},
    {"id":"04","name":"英国谢菲尔德大学","category":"GLOBAL","family":"ACADEMIC","shape":"academic","anchor":"SHEFFIELD / UK","city":"谢菲尔德","group":"main","map":"EURASIA / EUROPE","lon":-1.4884229,"lat":53.3813502,"dx":26,"dy":-38,"label":"SHEFFIELD","align":"right","address":"Western Bank, Sheffield S10 2TN, United Kingdom","pinBasis":"Firth Court / Western Bank campus","precision":"CAMPUS","precisionKind":"exact"},
    {"id":"05","name":"意大利特伦托大学","category":"GLOBAL","family":"ACADEMIC","shape":"academic","anchor":"TRENTO / IT","city":"特伦托","group":"main","map":"EURASIA / EUROPE","lon":11.12306,"lat":46.06678,"dx":-22,"dy":-62,"label":"UNIVERSITY OF TRENTO","align":"left","address":"Via Calepina 14, 38122 Trento, Italy","pinBasis":"Palazzo Sardagna · University Rectorate","precision":"ADMIN HQ","precisionKind":"exact"},
    {"id":"06","name":"意大利 FBK 研究所","category":"RESEARCH","family":"RESEARCH","shape":"institute","anchor":"POVO · TRENTO / IT","city":"特伦托","group":"main","map":"EURASIA / EUROPE","lon":11.1511194,"lat":46.0677149,"dx":24,"dy":-28,"label":"FBK","align":"right","address":"Via Sommarive 18, 38123 Povo, Trento, Italy","pinBasis":"Fondazione Bruno Kessler · Povo site","precision":"BUILDING","precisionKind":"exact"},
    {"id":"07","name":"中国科学院自动化研究所","category":"INSTITUTE","family":"RESEARCH","shape":"institute","anchor":"BEIJING · HAIDIAN / CN","city":"北京","group":"main","map":"EURASIA / BEIJING","lon":116.333305,"lat":39.980196,"dx":30,"dy":-86,"label":"CASIA","align":"right","address":"北京市海淀区中关村东路95号","pinBasis":"中国科学院自动化研究所本部","precision":"BUILDING","precisionKind":"exact"},
    {"id":"08","name":"中国科学院香港创新研究院","category":"INSTITUTE","family":"RESEARCH","shape":"institute","anchor":"PAK SHEK KOK · HK / CN","city":"香港","group":"gba","map":"GBA DETAIL","lon":114.2087402,"lat":22.4267787,"display":[0.945,0.72],"address":"香港新界白石角香港科学园科技大道西17号17W大楼3楼","pinBasis":"Hong Kong Science Park · Building 17W","precision":"BUILDING","precisionKind":"exact"},
    {"id":"09","name":"香港理工大学","category":"ACADEMIC","family":"ACADEMIC","shape":"academic","anchor":"HUNG HOM · HK / CN","city":"香港","group":"gba","map":"GBA DETAIL","lon":114.1795767,"lat":22.3045633,"display":[0.86,0.86],"address":"香港九龙红磡育才道11号","pinBasis":"香港理工大学主校园","precision":"CAMPUS","precisionKind":"exact"},
    {"id":"10","name":"香港科技大学（广州）","category":"ACADEMIC","family":"ACADEMIC","shape":"academic","anchor":"NANSHA · GUANGZHOU / CN","city":"广州","group":"gba","map":"GBA DETAIL","lon":113.47916197,"lat":22.89177704,"display":[0.27,0.86],"address":"广州市南沙区笃学路1号","pinBasis":"香港科技大学（广州）校园","precision":"CAMPUS","precisionKind":"exact"},
    {"id":"11","name":"中国科学院深圳先进技术研究院","category":"INSTITUTE","family":"RESEARCH","shape":"institute","anchor":"XILI · SHENZHEN / CN","city":"深圳","group":"gba","map":"GBA DETAIL","lon":113.9915,"lat":22.5939,"display":[0.57,0.86],"address":"深圳市南山区西丽深圳大学城学苑大道1068号","pinBasis":"中国科学院深圳先进技术研究院本部","precision":"CAMPUS","precisionKind":"exact"},
    {"id":"12","name":"鹏城实验室","category":"INSTITUTE","family":"RESEARCH","shape":"institute","anchor":"SHIBILONG · SHENZHEN / CN","city":"深圳","group":"gba","map":"GBA DETAIL","lon":113.93274632,"lat":22.62891777,"display":[0.66,0.86],"address":"深圳市南山区沙河西路6001号石壁龙园区","pinBasis":"鹏城实验室石壁龙园区东门","precision":"CAMPUS GATE","precisionKind":"exact"},
    {"id":"13","name":"广州人工智能公共算力中心","category":"COMPUTE","family":"OTHER","shape":"compute","anchor":"TIANHE · GUANGZHOU / CN","city":"广州","group":"gba","map":"GBA DETAIL","lon":113.35165,"lat":23.11975,"display":[0.14,0.12],"address":"广州市天河区平云路163号广电平云广场","pinBasis":"平云路163号地址点","precision":"ADDRESS","precisionKind":"exact"},
    {"id":"14","name":"中国石油集团安全环保技术研究院","category":"INDUSTRY","family":"INDUSTRY","shape":"industry","anchor":"CHANGPING · BEIJING / CN","city":"北京","group":"main","map":"EURASIA / BEIJING","lon":116.23755,"lat":40.16825,"dx":74,"dy":-48,"label":"CNPC RISE","align":"right","address":"北京市昌平区黄河北街1号院1号楼","pinBasis":"现行公开通信地址点","precision":"ADDRESS","precisionKind":"exact"},
    {"id":"15","name":"中国移动广州分公司","category":"INDUSTRY","family":"INDUSTRY","shape":"industry","anchor":"TIANHE · GUANGZHOU / CN","city":"广州","group":"gba","map":"GBA DETAIL","lon":113.3376824,"lat":23.1412194,"display":[0.25,0.12],"address":"广州市天河区天河北路610号","pinBasis":"中国移动广州分公司办公点","precision":"BUILDING","precisionKind":"exact"},
    {"id":"16","name":"琶洲实验室","category":"INSTITUTE","family":"RESEARCH","shape":"institute","anchor":"PAZHOU · GUANGZHOU / CN","city":"广州","group":"gba","map":"GBA DETAIL","lon":113.37317,"lat":23.09021,"display":[0.69,0.12],"address":"广州市海珠区琶洲桥头大街248号华新科创岛A区主楼","pinBasis":"琶洲实验室当前公开办公地址","precision":"ADDRESS","precisionKind":"exact"},
    {"id":"17","name":"广东省农业科学院","category":"AGRICULTURE","family":"OTHER","shape":"agriculture","anchor":"TIANHE · GUANGZHOU / CN","city":"广州","group":"gba","map":"GBA DETAIL","lon":113.354146,"lat":23.145383,"display":[0.36,0.12],"address":"广州市天河区金颖路29号","pinBasis":"广东省农业科学院院本部","precision":"CAMPUS","precisionKind":"exact"},
    {"id":"18","name":"中山大学中山眼科中心","category":"MEDICAL","family":"MEDICAL","shape":"medical","anchor":"YUEXIU · GUANGZHOU / CN","city":"广州","group":"gba","map":"GBA DETAIL","lon":113.28744403,"lat":23.13576896,"display":[0.055,0.4],"address":"广州市越秀区先烈南路54号（区庄院区）","pinBasis":"中山眼科中心区庄院区","precision":"HOSPITAL CAMPUS","precisionKind":"exact"},
    {"id":"19","name":"哈尔滨工业大学（深圳）","category":"ACADEMIC","family":"ACADEMIC","shape":"academic","anchor":"UNIVERSITY TOWN · SHENZHEN / CN","city":"深圳","group":"gba","map":"GBA DETAIL","lon":113.96878,"lat":22.586752,"display":[0.48,0.86],"address":"深圳市南山区平山一路（深圳大学城）","pinBasis":"哈尔滨工业大学（深圳）主校园","precision":"CAMPUS","precisionKind":"exact"},
    {"id":"20","name":"南方医科大学","category":"MEDICAL","family":"MEDICAL","shape":"medical","anchor":"BAIYUN · GUANGZHOU / CN","city":"广州","group":"gba","map":"GBA DETAIL","lon":113.334184,"lat":23.182586,"display":[0.47,0.12],"address":"广州市白云区沙太南路1023—1063号","pinBasis":"南方医科大学广州校本部","precision":"CAMPUS","precisionKind":"exact"},
    {"id":"21","name":"华南农业大学","category":"ACADEMIC","family":"ACADEMIC","shape":"academic","anchor":"WUSHAN · GUANGZHOU / CN","city":"广州","group":"gba","map":"GBA DETAIL","lon":113.3536811,"lat":23.1568182,"display":[0.58,0.12],"address":"广州市天河区五山路483号","pinBasis":"华南农业大学主校园","precision":"CAMPUS","precisionKind":"exact"},
    {"id":"22","name":"深圳大学大数据智能信息处理工程实验室","category":"RESEARCH","family":"RESEARCH","shape":"institute","anchor":"NANSHAN · SHENZHEN / CN","city":"深圳","group":"gba","map":"GBA DETAIL","lon":113.932813,"lat":22.53306,"display":[0.39,0.86],"address":"深圳市南山区南海大道3688号深圳大学粤海校区","pinBasis":"实验室所属深圳大学粤海校区；公开材料未给出独立楼宇","precision":"HOST CAMPUS","precisionKind":"host"},
    {"id":"23","name":"深圳市精神卫生中心","category":"MEDICAL","family":"MEDICAL","shape":"medical","anchor":"PINGSHAN · SHENZHEN / CN","city":"深圳","group":"gba","map":"GBA DETAIL","lon":114.30424,"lat":22.66296,"display":[0.76,0.86],"address":"深圳市坪山区振碧路77号（深圳市康宁医院坪山总院）","pinBasis":"机构主院区；合作材料未注明具体分院","precision":"HOSPITAL CAMPUS","precisionKind":"exact"},
    {"id":"24","name":"广州医科大学附属脑科医院","category":"MEDICAL","family":"MEDICAL","shape":"medical","anchor":"LIWAN · GUANGZHOU / CN","city":"广州","group":"gba","map":"GBA DETAIL","lon":113.2394239,"lat":23.0982243,"display":[0.055,0.76],"address":"广州市荔湾区明心路36号（芳村院区）","pinBasis":"广州医科大学附属脑科医院芳村院区","precision":"HOSPITAL CAMPUS","precisionKind":"exact"},
    {"id":"25","name":"广州医科大学附属肿瘤医院","category":"MEDICAL","family":"MEDICAL","shape":"medical","anchor":"YUEXIU · GUANGZHOU / CN","city":"广州","group":"gba","map":"GBA DETAIL","lon":113.293772,"lat":23.14663,"display":[0.055,0.28],"address":"广州市越秀区横枝岗路78号","pinBasis":"广州医科大学附属肿瘤医院院本部","precision":"HOSPITAL CAMPUS","precisionKind":"exact"},
    {"id":"26","name":"广州市中医医院","category":"MEDICAL","family":"MEDICAL","shape":"medical","anchor":"LIWAN · GUANGZHOU / CN","city":"广州","group":"gba","map":"GBA DETAIL","lon":113.243695,"lat":23.109073,"display":[0.055,0.86],"address":"广州市荔湾区珠玑路16号（珠玑院区）","pinBasis":"现广州医科大学附属中医医院珠玑院区","precision":"HOSPITAL CAMPUS","precisionKind":"exact"},
    {"id":"27","name":"广州博睿创新技术有限公司","category":"INDUSTRY","family":"INDUSTRY","shape":"industry","anchor":"GUANGZHOU / CN","city":"广州","group":"gba","map":"GBA DETAIL","lon":113.264385,"lat":23.129112,"display":[0.055,0.52],"address":"办公地址未确认","pinBasis":"广州城市级近似锚点","precision":"CITY-LEVEL","precisionKind":"approx"},
    {"id":"28","name":"江西桑沃科技有限公司","category":"INDUSTRY","family":"INDUSTRY","shape":"industry","anchor":"JIANGXI PROVINCE / CN","city":"江西","group":"main","map":"EURASIA / CHINA","lon":115.857963,"lat":28.682892,"dx":-24,"dy":-56,"label":"JIANGXI · PROVINCIAL","align":"left","address":"办公地址未确认","pinBasis":"江西省级近似锚点（南昌）","precision":"PROVINCE-LEVEL","precisionKind":"approx"},
    {"id":"29","name":"广东工业大学智能感知与控制团队","category":"GDUT","family":"OTHER","shape":"gdut","anchor":"JIEYANG CAMPUS / CN","city":"揭阳","group":"gba","map":"GBA + JIEYANG DETAIL","lon":116.32180503,"lat":22.98282064,"display":[0.93,0.2],"address":"广东省揭阳市惠来县神泉镇大学路1号（广东工业大学揭阳校区）","pinBasis":"所属广东工业大学揭阳校区；未定位独立楼宇","precision":"HOST CAMPUS","precisionKind":"host"},
    {"id":"30","name":"广东工业大学 YC 勇创团队","category":"GDUT","family":"OTHER","shape":"gdut","anchor":"JIEYANG CAMPUS / CN","city":"揭阳","group":"gba","map":"GBA + JIEYANG DETAIL","lon":116.32180503,"lat":22.98282064,"display":[0.93,0.36],"address":"广东省揭阳市惠来县神泉镇大学路1号（广东工业大学揭阳校区）","pinBasis":"所属广东工业大学揭阳校区；未定位独立楼宇","precision":"HOST CAMPUS","precisionKind":"host"},
    {"id":"31","name":"广东工业大学信息物理融合实验室","category":"GDUT","family":"OTHER","shape":"gdut","anchor":"JIEYANG CAMPUS / CN","city":"揭阳","group":"gba","map":"GBA + JIEYANG DETAIL","lon":116.32180503,"lat":22.98282064,"display":[0.93,0.52],"address":"广东省揭阳市惠来县神泉镇大学路1号（广东工业大学揭阳校区）","pinBasis":"所属广东工业大学揭阳校区；未定位独立楼宇","precision":"HOST CAMPUS","precisionKind":"host"},
    {"id":"32","name":"广州微调科技有限公司","category":"INDUSTRY","family":"INDUSTRY","shape":"industry","anchor":"GUANGZHOU / CN","city":"广州","group":"gba","map":"GBA DETAIL","lon":113.264385,"lat":23.129112,"display":[0.055,0.64],"address":"办公地址未确认","pinBasis":"广州城市级近似锚点","precision":"CITY-LEVEL","precisionKind":"approx"},
    {"id":"33","name":"Datawhale","category":"OPEN SOURCE","family":"OTHER","shape":"community","anchor":"DISTRIBUTED","city":"分布式社区","group":"native","map":"NETWORK-NATIVE","lon":null,"lat":null,"address":"分布式开源社区，无单一地理办公点","pinBasis":"非地理节点","precision":"DISTRIBUTED","precisionKind":"distributed"}
  ];

  const byId = new Map(partners.map(p => [p.id, p]));
  const state = { filter: 'ALL', query: '', lockedId: '10', hoverId: null };
  const cloudImages = {};
  const scriptBase = new URL("../images/", document.currentScript.src);
  const drawRects = {};

  const $ = (sel, scope=root) => scope.querySelector(sel);
  const $$ = (sel, scope=root) => [...scope.querySelectorAll(sel)];
  const activeId = () => state.hoverId || state.lockedId;

  async function loadCloudImages() {
    await Promise.all(Object.keys(CLOUDS).map(async key => {
      const image = new Image();
      image.decoding = 'async';
      image.src = new URL(`network-${key}.webp?v=20260905-2`, scriptBase).href;
      try {
        await image.decode();
        cloudImages[key] = image;
      } catch (error) {
        console.warn(`Network ${key} background could not load:`, error);
      }
    }));
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
    if (image) ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
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
    b.setAttribute('aria-label', `${p.id} ${p.name}，${p.anchor}，${p.precision}`);
    b.innerHTML = `<span class="beacon-core" aria-hidden="true"></span><span class="beacon-number">${p.id}</span>${micro?'':`<span class="beacon-label">${p.label||p.anchor}</span>`}`;
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
    button.setAttribute('aria-label','查看粤港澳大湾区与广东工业大学揭阳校区的 23 个合作信号');
    button.innerHTML='<span class="cluster-beacon-ring" aria-hidden="true"></span><span class="cluster-beacon-count">20</span><span class="cluster-beacon-label">GREATER BAY AREA<small>+ 03 JIEYANG HQ / OPEN DETAIL ↘</small></span>';
    const hq = byId.get('29');
    const hqAnchor = project('main',hq.lon,hq.lat);
    const hqEnd = {x:hqAnchor.x+24*scale,y:hqAnchor.y+26*scale};
    createLineGroup(svg,{id:'HQ',precisionKind:'host'},hqAnchor,hqEnd);
    const hqLabel = document.createElement('span');
    hqLabel.className = 'hq-anchor-label';
    hqLabel.style.left = `${hqEnd.x}px`; hqLabel.style.top = `${hqEnd.y}px`;
    hqLabel.innerHTML = 'AITA HQ / 03<small>JIEYANG CAMPUS</small>';
    layer.append(hqLabel);
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
      JIEYANG: {...project('gba',byId.get('29').lon,byId.get('29').lat),dx:-18,dy:-102}
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
    const typeOK = state.filter==='ALL' || p.family===state.filter;
    const q = state.query.trim().toLowerCase();
    const queryOK = !q || `${p.id} ${p.name} ${p.anchor} ${p.city} ${p.category} ${p.address} ${p.pinBasis}`.toLowerCase().includes(q);
    return typeOK && queryOK;
  }

  function formatPosition(p) {
    if (p.lon == null) return 'NON-GEOGRAPHIC / DISTRIBUTED';
    const ns = p.lat >= 0 ? 'N' : 'S';
    const ew = p.lon >= 0 ? 'E' : 'W';
    const decimals = p.precisionKind==='approx' ? 2 : 5;
    return `${Math.abs(p.lat).toFixed(decimals)}°${ns} / ${Math.abs(p.lon).toFixed(decimals)}°${ew} · ${p.precisionKind==='approx'?'APPROX.':'WGS84'}`;
  }

  function updateSelection() {
    const id = activeId();
    const p = byId.get(id);
    $('#locate-index').disabled = !p;
    if (!p) {
      $('#selection-status').textContent = '00 / 33';
      $('#selection-code').textContent = 'NO MATCH';
      $('#selection-name').textContent = '未找到匹配的合作单位';
      ['anchor', 'map', 'position', 'address', 'basis', 'precision', 'category', 'display'].forEach(field => {
        $('#selection-' + field).textContent = '—';
      });
      $('#selection-note').textContent = '调整类别或搜索关键词，或点击 RESET 恢复完整名录。';
      return;
    }
    $('#selection-status').textContent = `${p.id} / 33`;
    $('#selection-code').textContent = `NODE:${p.id} / ${p.category}`;
    $('#selection-name').textContent = p.name;
    $('#selection-anchor').textContent = p.anchor;
    $('#selection-map').textContent = p.map;
    $('#selection-position').textContent = formatPosition(p);
    $('#selection-address').textContent = p.address;
    $('#selection-basis').textContent = p.pinBasis;
    $('#selection-precision').textContent = p.precision;
    $('#selection-category').textContent = p.category;
    $('#selection-display').textContent = p.group==='native' ? 'NETWORK-NATIVE SIGNAL' : 'GEOGRAPHIC ANCHOR / SHORT LEADER';
    $('#selection-note').textContent = p.group==='native'
      ? '分布式开源社区不强制绑定单一城市，在地图之外以 network-native 信号呈现。'
      : p.precisionKind==='approx'
        ? '定位资料未确认办公楼宇，虚线仅表示城市或省级近似位置，不代表企业地址。'
        : p.precisionKind==='host'
          ? '定位资料仅指向所属校区，不代表独立楼宇；信号头就近避让，线条起点保留校园锚点。'
          : '位置按提供的地址定位资料展示；信号头就近避让，线条起点保留地理锚点，不等同于具体合作场所。';
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
    native.classList.toggle('is-active',id==='33');
    native.style.opacity=matches(byId.get('33'))?'1':'.12';
    native.disabled = !matches(byId.get('33'));
    native.setAttribute('aria-pressed', String(id === '33'));
    const visible=partners.filter(matches).length;
    $('#search-count').textContent=`${String(visible).padStart(2,'0')} / 33`;
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
    root.classList.add('is-ready');
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
    state.lockedId = '10';
    state.query = '';
    $('#partner-search').value = '';
    setFilter('ALL');
  }
  $('#clear-selection').addEventListener('click', resetSelection);
  $('.network-native').addEventListener('pointerenter',()=>{state.hoverId='33';updateUI();});
  $('.network-native').addEventListener('pointerleave',()=>{state.hoverId=null;updateUI();});
  $('.network-native').addEventListener('focus',()=>{state.hoverId='33';updateUI();});
  $('.network-native').addEventListener('blur',()=>{state.hoverId=null;updateUI();});
  $('.network-native').addEventListener('click',()=>{state.lockedId='33';state.hoverId=null;updateUI();});
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
  let loading = false;
  const startRendering = async () => {
    if (started || loading) return;
    loading = true;
    try {
      await loadCloudImages();
    } catch (error) {
      // The directory and interactive signals remain usable if a bitmap fails.
      console.warn('Network background image could not load:', error);
    }
    started = true;
    renderAll();
  };
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
})();
