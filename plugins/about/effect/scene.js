
import * as THREE from './vendor/three.module.js';

/* ============================================================
   共识星野 · CONSENSUS FIELD
   act i    DRIFT      自由个体,开放加入
   act ii   CONVERGE   局部规则,自组织成形
   act iii  VERIFY     提议-广播-三分之二确认,信号色落锁
   act iv   RELEASE    结构松开,进入下一轮演化
   ============================================================ */

const Q = new URLSearchParams(location.search);
const LITE = Q.has('lite');
const T0 = parseFloat(Q.get('t') || '0');
// Keep the collaboration graph stable when the parent grid crosses a breakpoint.

const N = Math.min(1024, parseInt(Q.get('n')) || (LITE ? 360 : 480));  // 协作节点(≤宿主纹理容量)
const DUST = parseInt(Q.get('dust')) || (LITE ? 192 : 256); // 尘埃场边长(² = 数量)
const LINK_R = 1.05;                                    // 连线阈值
const CYCLE = 18.5;                                       // 一轮叙事时长(秒)
const SIGNAL = new THREE.Color(0xff5900);               // 唯一的信号色:验证时刻
const GRAY = new THREE.Color(0.56, 0.56, 0.56);

/* seeded rng —— 每轮构形可复现、可审计 */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}

/* ---------- renderer ---------- */
const canvas = document.getElementById('stage');
let renderer;
try{
  renderer = new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'});
}catch(e){ document.getElementById('fallback').style.display='flex'; throw e; }
const DPR = Math.min(devicePixelRatio || 1, 1.5);
let qualityLevel = LITE ? 0 : 1;
let pixelRatio = Math.min(DPR, LITE ? 1 : 1.25, Math.sqrt(1200000 / Math.max(1, innerWidth * innerHeight)));
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth/innerHeight, 0.1, 100);
camera.position.set(0, 0, innerWidth/innerHeight < 0.9 ? 19 : 15);
const world = new THREE.Group();
scene.add(world);

/* ---------- 共享 ---------- */
function flowJS(x, y, z, t, out){
  out.x = Math.sin(y*0.35 + t*0.15) + Math.cos(z*0.28 - t*0.10);
  out.y = Math.sin(z*0.32 + t*0.12) + Math.cos(x*0.30 + t*0.09);
  out.z = Math.sin(x*0.29 - t*0.11) + Math.cos(y*0.33 + t*0.13);
  return out;
}
const smooth = (a, b, x)=>{ const t = Math.min(1, Math.max(0, (x-a)/(b-a))); return t*t*(3-2*t); };

/* ============================================================
   LAYER 1 — 节点光晕尘埃:每一粒尘埃归属一个网络节点
   节点位置每帧经小纹理上传;尘埃在宿主周围缓慢绕行,
   随网络聚散——尘埃云即协作群体的"气场",结构上不可能坍缩
   ============================================================ */
const HOST_TEX = 32;                                      // 32² = 1024 ≥ N
const hostData = new Float32Array(HOST_TEX*HOST_TEX*4);   // xyz=节点位置, w=确认热度
const hostTex = new THREE.DataTexture(hostData, HOST_TEX, HOST_TEX, THREE.RGBAFormat, THREE.FloatType);
hostTex.minFilter = hostTex.magFilter = THREE.NearestFilter;
hostTex.needsUpdate = true;

const DUST_VERT = /* glsl */`
  uniform sampler2D texHost;
  uniform float uSize, uTime, uMouseOn;
  uniform vec3 uMouse;
  attribute float aHost;      // 宿主节点索引
  attribute vec4 aSeed;       // x:相位1  y:相位2  z:轨道半径  w:角速度
  varying float vBright;
  varying float vHeat;
  void main(){
    vec4 host = texture2D(texHost, vec2((mod(aHost, 32.0) + 0.5) / 32.0,
                                        (floor(aHost / 32.0) + 0.5) / 32.0));
    vHeat = host.w;
    // 宿主周围的缓慢轨道:相位 + 角速度,有界运行,永不坍缩
    float a1 = aSeed.x + uTime * aSeed.w;
    float a2 = aSeed.y + uTime * aSeed.w * 0.63;
    vec3 off = aSeed.z * vec3(sin(a1)*cos(a2), cos(a1)*0.8, sin(a1)*sin(a2));
    vec3 p = host.xyz + off;
    // 光标扰动:局部液体般推开
    vec3 dm = p - uMouse;
    float dl = length(dm);
    p += normalize(dm + 0.0001) * (1.0 - smoothstep(0.0, 3.2, dl)) * 1.4 * uMouseOn;
    // 独立相位的缓慢闪烁:环境是活的,但不躁动
    float tw = fract(aSeed.x * 12.9898 + aSeed.y * 78.233);
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.35 + tw * 0.5) + tw * 6.2831);
    vBright = (0.38 + 0.30 * twinkle) * (0.55 + 0.45 * (1.0 - smoothstep(0.1, 0.9, aSeed.z)));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (128.0 / -mv.z) * (0.5 + aSeed.z * 0.35);
  }
`;
const DUST_FRAG = /* glsl */`
  varying float vBright;
  varying float vHeat;
  uniform float uGlow;
  uniform vec3 uSignal;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.06, d);
    // 宿主的确认热度晕染整团光晕:验证时刻,群体共振
    vec3 col = mix(vec3(0.32), uSignal, vHeat * 0.55) * vBright * (1.0 + uGlow * 0.9);
    gl_FragColor = vec4(col, a * 0.62);
  }
`;

function createDust(count){
  const rng = mulberry32(20260902);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count*3), 3)); // 占位,真实位置在着色器计算
  const aHost = new Float32Array(count);
  const aSeed = new Float32Array(count*4);
  for (let i = 0; i < count; i++){
    aHost[i] = i % N;
    aSeed[i*4+0] = rng() * Math.PI * 2;
    aSeed[i*4+1] = rng() * Math.PI * 2;
    aSeed[i*4+2] = 0.12 + Math.pow(rng(), 2.2) * 0.85;   // 轨道半径:多数贴近宿主
    aSeed[i*4+3] = (0.25 + rng() * 0.6) * (rng() < 0.5 ? -1 : 1);
  }
  geo.setAttribute('aHost', new THREE.BufferAttribute(aHost, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 4));
  const mat = new THREE.ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG,
    uniforms: {
      texHost: {value: hostTex},
      uSize: {value: 0.46 * pixelRatio},
      uGlow: {value: 0}, uTime: {value: 0},
      uMouse: {value: new THREE.Vector3(999, 999, 0)}, uMouseOn: {value: 0},
      uSignal: {value: new THREE.Color(0xff5900)}
    },
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  world.add(points);
  return {points, mat};
}

/* ============================================================
   LAYER 2 — 协作网络:默认 480 个自主体 + 阈值连线 + 共识脉冲
   ============================================================ */
const pos = new Float32Array(N*3);
const vel = new Float32Array(N*3);
const heat = new Float32Array(N);          // 0..1 确认热度
const confirmed = new Uint8Array(N);
const confirmedAt = new Float32Array(N);
const relDelay = new Float32Array(N);
const sizeMul = new Float32Array(N);
const perm = new Uint16Array(N);           // agent → 构形槽位

{
  const rng = mulberry32(777);
  for (let i = 0; i < N; i++){
    const r = 3.5 + rng()*3.5, th = Math.acos(2*rng()-1), ph = rng()*Math.PI*2;
    pos[i*3]   = r*Math.sin(th)*Math.cos(ph);
    pos[i*3+1] = r*Math.sin(th)*Math.sin(ph);
    pos[i*3+2] = r*Math.cos(th);
    vel[i*3] = (rng()-0.5)*2.2; vel[i*3+1] = (rng()-0.5)*2.2; vel[i*3+2] = (rng()-0.5)*2.2;
    sizeMul[i] = 1;
  }
}

/* 两种构形槽位:球面晶格 / 环面晶格 —— 系统每轮演化为不同形态 */
function buildSlots(kind){
  const out = new Float32Array(N*3);
  const rng = mulberry32(kind === 0 ? 41 : 97);
  const GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++){
    let x, y, z;
    if (kind === 0){                                   // 斐波那契球
      const yy = 1 - (i / (N-1)) * 2;
      const rr = Math.sqrt(Math.max(0, 1 - yy*yy));
      const th = GA * i;
      x = Math.cos(th)*rr; y = yy; z = Math.sin(th)*rr;
      const R = 4.7;
      x*=R; y*=R; z*=R;
    } else {                                           // 环面(倾斜朝向镜头)
      const u = i * GA, v = i * 0.7548776662 * Math.PI * 2;
      const R = 4.4, r = 1.22;
      const tx = (R + r*Math.cos(v)) * Math.cos(u);
      const tz = (R + r*Math.cos(v)) * Math.sin(u);
      const ty = r * Math.sin(v);
      const ca = Math.cos(1.02), sa = Math.sin(1.02);  // 绕 X 轴倾转 ~58°
      x = tx; y = ty*ca - tz*sa; z = ty*sa + tz*ca;
    }
    out[i*3]   = x + (rng()-0.5)*0.10;
    out[i*3+1] = y + (rng()-0.5)*0.10;
    out[i*3+2] = z + (rng()-0.5)*0.10;
  }
  return out;
}
const SLOTS = [buildSlots(0), buildSlots(1)];

/* 每种构形预计算"证明边":每个槽位的两条最近邻边,验证通过时点亮 */
function buildProofEdges(slots){
  const edges = [];
  for (let i = 0; i < N; i++){
    let b1 = -1, b2 = -1, d1 = 1e9, d2 = 1e9;
    for (let j = 0; j < N; j++){
      if (j === i) continue;
      const dx = slots[i*3]-slots[j*3], dy = slots[i*3+1]-slots[j*3+1], dz = slots[i*3+2]-slots[j*3+2];
      const d = dx*dx + dy*dy + dz*dz;
      if (d < d1){ d2 = d1; b2 = b1; d1 = d; b1 = j; }
      else if (d < d2){ d2 = d; b2 = j; }
    }
    edges.push([i, b1], [i, b2]);
  }
  return edges;
}
const PROOF = [buildProofEdges(SLOTS[0]), buildProofEdges(SLOTS[1])];

/* ---- 节点渲染 ---- */
const agentGeo = new THREE.BufferGeometry();
agentGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
const aColor = new Float32Array(N*3);
const aSize = new Float32Array(N);
agentGeo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3).setUsage(THREE.DynamicDrawUsage));
agentGeo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1).setUsage(THREE.DynamicDrawUsage));
const agentMat = new THREE.ShaderMaterial({
  vertexShader: /* glsl */`
    attribute vec3 aColor; attribute float aSize;
    uniform float uBase;
    varying vec3 vColor;
    void main(){
      vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uBase * aSize * (140.0 / -mv.z);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vColor;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.12, d);
      gl_FragColor = vec4(vColor, a);
    }`,
  uniforms: {uBase: {value: 0.42 * pixelRatio}},
  transparent: true, depthWrite: false, depthTest: false
});
const agentPoints = new THREE.Points(agentGeo, agentMat);
agentPoints.frustumCulled = false;
world.add(agentPoints);

/* ---- 连线渲染 ---- */
const MAXSEG = 9000;
const linkGeo = new THREE.BufferGeometry();
const lPos = new Float32Array(MAXSEG*6);
const lCol = new Float32Array(MAXSEG*6);
const segI = new Int16Array(MAXSEG*2);   // 每条线段的两端节点索引
linkGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3).setUsage(THREE.DynamicDrawUsage));
linkGeo.setAttribute('color', new THREE.BufferAttribute(lCol, 3).setUsage(THREE.DynamicDrawUsage));
const linkMat = new THREE.LineBasicMaterial({
  vertexColors: true, transparent: true, opacity: 1,
  blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
});
const linkLines = new THREE.LineSegments(linkGeo, linkMat);
linkLines.frustumCulled = false;
world.add(linkLines);

/* ---- 证明边(验证通过时显现的晶格骨架) ---- */
const proofGeo = new THREE.BufferGeometry();
const proofPos = new Float32Array(N*2*6);
proofGeo.setAttribute('position', new THREE.BufferAttribute(proofPos, 3).setUsage(THREE.DynamicDrawUsage));
const proofMat = new THREE.LineBasicMaterial({
  color: SIGNAL, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
});
const proofLines = new THREE.LineSegments(proofGeo, proofMat);
proofLines.frustumCulled = false;
world.add(proofLines);
function loadProofEdges(kind){
  const edges = PROOF[kind], slots = SLOTS[kind];
  let k = 0;
  for (const [a, b] of edges){
    proofPos[k++] = slots[a*3]; proofPos[k++] = slots[a*3+1]; proofPos[k++] = slots[a*3+2];
    proofPos[k++] = slots[b*3]; proofPos[k++] = slots[b*3+1]; proofPos[k++] = slots[b*3+2];
  }
  proofGeo.attributes.position.needsUpdate = true;
  proofGeo.setDrawRange(0, edges.length*2);
}

/* ---- 空间哈希 ---- */
const hash = new Map();
const CELL = LINK_R;
function cellKey(x, y, z){
  return (Math.floor(x/CELL)*73856093) ^ (Math.floor(y/CELL)*19349663) ^ (Math.floor(z/CELL)*83492791);
}
const adj = new Array(N); for (let i = 0; i < N; i++) adj[i] = [];
let linkCount = 0;

/* ============================================================
   状态机与共识脉冲
   ============================================================ */
let round = 0, proposer = 0, verified = false, verifiedAt = -1;
let glowPulse = 0, proofOpacity = 0, formation = 0;
const rngRound = mulberry32(1);

function resetRound(r){
  round = r;
  formation = r % 2;
  const rng = mulberry32(1000 + r);
  for (let i = 0; i < N; i++) perm[i] = i;
  for (let i = N-1; i > 0; i--){           // Fisher–Yates:每轮重新抽签决定谁站在哪
    const j = Math.floor(rng()*(i+1));
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  proposer = Math.floor(rng()*N);
  for (let i = 0; i < N; i++){
    confirmed[i] = 0; confirmedAt[i] = 0;
    relDelay[i] = rng()*2.6;
    sizeMul[i] = 1;
  }
  sizeMul[proposer] = 1.6;
  verified = false; verifiedAt = -1;
  loadProofEdges(formation);
}
resetRound(0);

const bfsMark = new Uint8Array(N);
function bfs(hopLimit){
  bfsMark.fill(0);
  const q = [proposer], depth = new Int16Array(N).fill(-1);
  bfsMark[proposer] = 1; depth[proposer] = 0;
  let head = 0;
  while (head < q.length){
    const cur = q[head++];
    if (depth[cur] >= hopLimit) continue;
    for (const nb of adj[cur]){
      if (!bfsMark[nb]){ bfsMark[nb] = 1; depth[nb] = depth[cur]+1; q.push(nb); }
    }
  }
  return bfsMark;
}

/* ---------- 交互:光标力场 ---------- */
const ndc = new THREE.Vector2(0, 0);
const mouseWorld = new THREE.Vector3(999, 999, 0);
const mouseLocal = new THREE.Vector3(999, 999, 0);
let mouseOn = 0, mouseOnTarget = 0, idleTimer = 0;
const ray = new THREE.Raycaster();
const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
function onMove(x, y){
  ndc.x = (x/innerWidth)*2 - 1;
  ndc.y = -(y/innerHeight)*2 + 1;
  mouseOnTarget = 1;
  idleTimer = 0;
}
addEventListener('pointermove', e => onMove(e.clientX, e.clientY), {passive: true});
addEventListener('touchmove', e => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); }, {passive: true});

addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.position.z = camera.aspect < 0.9 ? 19 : 15;
  camera.updateProjectionMatrix();
  applyQuality(qualityLevel);
});

/* ---------- 尘埃:节点光晕(纯顶点着色器,无需浮点渲染目标) ---------- */
let dustField = createDust(DUST*DUST);

/* ============================================================
   主循环
   ============================================================ */
const FIXDT = Q.has('fixdt');
let simTime = T0;
let last = performance.now()/1000;
let active = window.parent === window, pageActive = true, frameRequest = 0;
const fv = {x:0, y:0, z:0};
const vA = new THREE.Vector3(), vB = new THREE.Vector3();

function applyQuality(level) {
  qualityLevel = level;
  pixelRatio = Math.min(DPR, [1, 1.25, 1.5][level],
    Math.sqrt(1200000 / Math.max(1, innerWidth * innerHeight)));
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  dustField.mat.uniforms.uSize.value = 0.46 * pixelRatio;
  agentMat.uniforms.uBase.value = 0.42 * pixelRatio;
  // Reuse the buffers; lowering quality must not itself rebuild a large particle field.
  const count = Math.min(DUST * DUST, level === 0 ? 192 * 192 : DUST * DUST);
  dustField.points.geometry.setDrawRange(0, count);
  canvas.dataset.quality = String(level);
  canvas.dataset.particles = String(count);
  canvas.dataset.pixelRatio = pixelRatio.toFixed(2);
}
const budget = window.createAitaEffectBudget({
  initial: qualityLevel, max: LITE ? 0 : 2, onChange: applyQuality
});
function syncActivity() {
  cancelAnimationFrame(frameRequest);
  frameRequest = 0;
  budget.reset();
  last = performance.now()/1000;
  canvas.dataset.active = String(active && pageActive && !document.hidden);
  document.documentElement.dataset.effectActive = canvas.dataset.active;
  if (active && pageActive && !document.hidden) frameRequest = requestAnimationFrame(frame);
}
addEventListener('message', event => {
  if (event.source !== window.parent || !event.data || event.data.type !== 'aita:about-field-active') return;
  const next = Boolean(event.data.active);
  if (next === active) return;
  active = next;
  syncActivity();
});
addEventListener('visibilitychange', syncActivity);
addEventListener('pagehide', () => { pageActive = false; syncActivity(); });
addEventListener('pageshow', () => { pageActive = true; syncActivity(); });

function frame(){
  frameRequest = 0;
  if (!active || !pageActive || document.hidden) return;
  frameRequest = requestAnimationFrame(frame);
  const now = performance.now()/1000;
  let dt, storyDt;
  if (FIXDT){ dt = storyDt = 1/30; simTime += storyDt; }
  else {
    storyDt = Math.max(0, now - last);
    dt = Math.min(0.033, storyDt);
    last = now;
    // Narrative uses visible wall time; physics keeps its bounded integration step.
    simTime += storyDt;
  }
  const time = simTime;
  window.__simTime = simTime;

  if (!FIXDT && !Q.has('dust')) budget.sample(now * 1000);

  const c = time % CYCLE;
  const r = Math.floor(time / CYCLE);
  if (r !== round) resetRound(r);

  /* 构形权重 */
  let w;
  if (c < 0.25) w = 0;
  else if (c < 1.35) w = smooth(0.25, 1.35, c);
  else if (c < 10.5) w = 1;
  else if (c < 14) w = 1 - smooth(10.5, 14, c);
  else w = 0;

  // Compress assembly without speeding up every subsequent motion or adding substeps.
  const previousAssembly = smooth(0.25, 1.35, Math.max(0, c - storyDt));
  const assemblyBlend = c < 10.5 && previousAssembly < 1
    ? Math.max(0, (w - previousAssembly) / (1 - previousAssembly)) : 0;

  /* 涡旋中心(尘埃与节点共享同一组环流) */
  vA.set(Math.sin(time*0.05)*3.2, Math.cos(time*0.043)*2.1, Math.sin(time*0.036)*2.4);
  vB.set(-Math.sin(time*0.041)*3.0, Math.sin(time*0.052)*1.8, Math.cos(time*0.047)*2.8);

  /* 光标 → 局部坐标 */
  mouseOn += (mouseOnTarget - mouseOn) * 0.1;
  idleTimer += dt;
  if (idleTimer > 1.4) mouseOnTarget = 0;
  ray.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(planeZ, hit)){
    mouseWorld.copy(hit);
    world.updateMatrixWorld();
    mouseLocal.copy(hit);
    world.worldToLocal(mouseLocal);
  }

  /* ---- 空间哈希 + 连线 + 邻接表 ---- */
  hash.clear();
  for (let i = 0; i < N; i++){
    const k = cellKey(pos[i*3], pos[i*3+1], pos[i*3+2]);
    let arr = hash.get(k);
    if (!arr){ arr = []; hash.set(k, arr); }
    arr.push(i);
    adj[i].length = 0;
  }
  linkCount = 0;
  const R2 = LINK_R*LINK_R;
  for (let i = 0; i < N; i++){
    const xi = pos[i*3], yi = pos[i*3+1], zi = pos[i*3+2];
    const cx = Math.floor(xi/CELL), cy = Math.floor(yi/CELL), cz = Math.floor(zi/CELL);
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++){
      const arr = hash.get(((cx+ox)*73856093) ^ ((cy+oy)*19349663) ^ ((cz+oz)*83492791));
      if (!arr) continue;
      for (const j of arr){
        if (j <= i) continue;
        const dx = xi - pos[j*3], dy = yi - pos[j*3+1], dz = zi - pos[j*3+2];
        const d2 = dx*dx + dy*dy + dz*dz;
        if (d2 < R2){
          adj[i].push(j); adj[j].push(i);
          if (linkCount < MAXSEG){
            const o = linkCount*6;
            lPos[o]   = xi;      lPos[o+1] = yi;      lPos[o+2] = zi;
            lPos[o+3] = pos[j*3]; lPos[o+4] = pos[j*3+1]; lPos[o+5] = pos[j*3+2];
            segI[linkCount*2] = i; segI[linkCount*2+1] = j;
            linkCount++;
          }
        }
      }
    }
  }
  linkGeo.setDrawRange(0, linkCount*2);
  linkGeo.attributes.position.needsUpdate = true;

  /* ---- 共识脉冲:提议 → 广播(BFS) → 三分之二确认 ---- */
  let confirmedCount = 0;
  if (c >= 1.5 && c < 10.5){
    const hopLimit = Math.floor((c - 1.5) / 0.40);
    const waveR = (c - 1.5) * 1.9;
    const mark = bfs(hopLimit);
    const px = pos[proposer*3], py = pos[proposer*3+1], pz = pos[proposer*3+2];
    for (let i = 0; i < N; i++){
      if (confirmed[i]) continue;
      const dx = pos[i*3]-px, dy = pos[i*3+1]-py, dz = pos[i*3+2]-pz;
      if (mark[i] || dx*dx+dy*dy+dz*dz < waveR*waveR){
        confirmed[i] = 1; confirmedAt[i] = time;
      }
    }
  }
  for (let i = 0; i < N; i++) confirmedCount += confirmed[i];
  if (!verified && confirmedCount >= Math.ceil(N*2/3)){
    verified = true; verifiedAt = time;
    glowPulse = 1;
  }

  /* 验证通过 → 证明边骨架显现 */
  const proofTarget = (verified && c < 12.5) ? 0.85 : 0;
  proofOpacity += (proofTarget - proofOpacity) * Math.min(1, dt*(proofTarget > proofOpacity ? 3 : 1.2));
  proofMat.opacity = proofOpacity;
  glowPulse = Math.max(0, glowPulse - dt*0.45);

  /* ---- 节点受力与积分 ---- */
  const slots = SLOTS[formation];
  const dampF = Math.pow(0.92, dt*60);
  for (let i = 0; i < N; i++){
    const ix = i*3;
    const x = pos[ix], y = pos[ix+1], z = pos[ix+2];
    flowJS(x, y, z, time, fv);
    const fq = 1.8 - 1.73*w;                 // 漂移期清晰可见地游动;构形接管时退场(w=1 退回 0.07)
    let fx = fv.x*fq, fy = fv.y*fq, fz = fv.z*fq;
    /* 环流 */
    let rx = x-vA.x, ry = y-vA.y, rz = z-vA.z;
    let d = Math.sqrt(rx*rx+ry*ry+rz*rz) + 1e-4;
    let s = smooth(9, 1.5, d)*0.34/d;
    fx += (ry*1.0 - rz*0.2)*s* -1; fy += (rz*0.15 - rx*1.0)*s* -1; fz += (rx*0.2 - ry*0.15)*s* -1;
    rx = x-vB.x; ry = y-vB.y; rz = z-vB.z;
    d = Math.sqrt(rx*rx+ry*ry+rz*rz) + 1e-4;
    s = smooth(9, 1.5, d)*0.34/d;
    fx += (ry*0.4 - rz*(-0.3))*s; fy += (rz*1.0 - rx*0.4)*s; fz += (rx*(-0.3) - ry*1.0)*s;
    /* 分离(与近邻保持间距) */
    for (const j of adj[i]){
      const dx = x - pos[j*3], dy = y - pos[j*3+1], dz = z - pos[j*3+2];
      const dd = Math.sqrt(dx*dx + dy*dy + dz*dz) + 1e-4;
      if (dd < 0.55){
        const push = (0.55 - dd)*1.6/dd;
        fx += dx*push; fy += dy*push; fz += dz*push;
      }
    }
    /* 构形弹簧 */
    if (w > 0){
      const si = perm[i]*3;
      fx += (slots[si]   - x) * w * 2.4;
      fy += (slots[si+1] - y) * w * 2.4;
      fz += (slots[si+2] - z) * w * 2.4;
    }
    /* 光标斥力 */
    if (mouseOn > 0.01){
      const dx = x - mouseLocal.x, dy = y - mouseLocal.y, dz = z - mouseLocal.z;
      const dd = Math.sqrt(dx*dx + dy*dy + dz*dz) + 1e-4;
      const f = smooth(3.0, 0, dd) * 9.0 * mouseOn / dd;
      fx += dx*f; fy += dy*f; fz += dz*f;
    }
    /* 软边界 */
    const rr = Math.sqrt(x*x + y*y + z*z);
    if (rr > 14){ const pull = (rr - 14)*0.5/rr; fx -= x*pull; fy -= y*pull; fz -= z*pull; }

    let vx = (vel[ix]   + fx*dt) * dampF;
    let vy = (vel[ix+1] + fy*dt) * dampF;
    let vz = (vel[ix+2] + fz*dt) * dampF;
    const sp = Math.sqrt(vx*vx + vy*vy + vz*vz);
    if (sp > 2.8){ const k = 2.8/sp; vx*=k; vy*=k; vz*=k; }
    vel[ix] = vx; vel[ix+1] = vy; vel[ix+2] = vz;
    pos[ix] = x + vx*dt; pos[ix+1] = y + vy*dt; pos[ix+2] = z + vz*dt;
    if (assemblyBlend > 0){
      const si = perm[i]*3;
      for (let axis = 0; axis < 3; axis++){
        pos[ix+axis] += (slots[si+axis] - pos[ix+axis]) * assemblyBlend;
        vel[ix+axis] *= 1 - assemblyBlend;
      }
    }
  }
  agentGeo.attributes.position.needsUpdate = true;

  /* ---- 颜色:灰阶是底色,信号橙只属于验证 ---- */
  const flash = verified ? Math.exp(-(time - verifiedAt)*3.0) : 0;
  for (let i = 0; i < N; i++){
    let target = 0;
    if (confirmed[i] && c < 10.5 + relDelay[i]) target = 1;
    const rate = target > heat[i] ? 9 : 1.4;
    heat[i] += (target - heat[i]) * Math.min(1, dt*rate);
    const h = heat[i];
    const breathe = 1 + 0.14*Math.sin(time*5 + i*0.13)*h;
    let cr = GRAY.r + (SIGNAL.r - GRAY.r)*h*breathe;
    let cg = GRAY.g + (SIGNAL.g - GRAY.g)*h*breathe;
    let cb = GRAY.b + (SIGNAL.b - GRAY.b)*h*breathe;
    cr += flash*0.9; cg += flash*0.7; cb += flash*0.55;
    aColor[i*3] = cr; aColor[i*3+1] = cg; aColor[i*3+2] = cb;
    aSize[i] = sizeMul[i] * (1 + h*0.55);
  }
  agentGeo.attributes.aColor.needsUpdate = true;
  agentGeo.attributes.aSize.needsUpdate = true;

  /* 连线颜色:距离衰减 + 确认染色 */
  for (let sgi = 0; sgi < linkCount; sgi++){
    const o = sgi*6;
    const x1 = lPos[o], y1 = lPos[o+1], z1 = lPos[o+2];
    const dx = lPos[o+3]-x1, dy = lPos[o+4]-y1, dz = lPos[o+5]-z1;
    const d01 = Math.min(1, Math.sqrt(dx*dx+dy*dy+dz*dz)/LINK_R);
    const lum = 0.16*(1 - d01) + 0.03;
    const hA = heat[segI[sgi*2]], hB = heat[segI[sgi*2+1]];
    const hMix = Math.min(hA, hB)*0.9 + Math.max(hA, hB)*0.30;   // 波前沿只染半边
    const oi = (0.45 + 0.55*(1 - d01)) * hMix;
    lCol[o]   = lum*(1-hMix) + SIGNAL.r*oi;
    lCol[o+1] = lum*(1-hMix) + SIGNAL.g*oi;
    lCol[o+2] = lum*(1-hMix) + SIGNAL.b*oi;
    lCol[o+3] = lCol[o]; lCol[o+4] = lCol[o+1]; lCol[o+5] = lCol[o+2];
  }
  linkGeo.attributes.color.needsUpdate = true;

  /* ---- 尘埃:上传宿主节点的位置与确认热度 ---- */
  for (let i = 0; i < N; i++){
    hostData[i*4]   = pos[i*3];
    hostData[i*4+1] = pos[i*3+1];
    hostData[i*4+2] = pos[i*3+2];
    hostData[i*4+3] = heat[i];
  }
  hostTex.needsUpdate = true;
  dustField.mat.uniforms.uGlow.value = glowPulse*0.9 + flash*0.4;
  dustField.mat.uniforms.uTime.value = time;
  dustField.mat.uniforms.uMouse.value.copy(mouseLocal);
  dustField.mat.uniforms.uMouseOn.value = mouseOn;

  /* ---- 镜头与世界 ---- */
  world.rotation.y += dt*0.026;
  const targetRx = Math.sin(time*0.05)*0.05 + ndc.y*-0.05;
  const targetRy = ndc.x*0.07;
  world.rotation.x += (targetRx - world.rotation.x)*0.03;
  camera.position.x += (ndc.x*1.1 - camera.position.x)*0.04;
  camera.position.y += (ndc.y*0.75 - camera.position.y)*0.04;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}
applyQuality(qualityLevel);
// A single initial image makes ready independent of the parent's active message.
renderer.render(scene, camera);
syncActivity();
window.parent.postMessage('aita:about-field-ready', '*');
