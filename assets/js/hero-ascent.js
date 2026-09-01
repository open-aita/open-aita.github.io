(() => {
  "use strict";

  const doc = document;
  const root = doc.documentElement;
  const hero = doc.querySelector(".hero#top");
  if (!(hero instanceof HTMLElement) || hero.querySelector("[data-hero-ascent]")) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = getComputedStyle(root);
  const ink = css.getPropertyValue("--text-soft").trim() || "#b9bbb4";
  const white = css.getPropertyValue("--text").trim() || "#f4f4f2";
  const green = css.getPropertyValue("--green").trim() || "#78e772";

  const style = doc.createElement("style");
  style.textContent = `
    .hero{isolation:isolate}.hero-grid,.hero-glow{z-index:0}.hero-copy,.hero-meta{position:relative;z-index:3}
    .aita-ascent{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;contain:layout paint style}
    .aita-ascent canvas,.aita-intro canvas{display:block;width:100%;height:100%}
    .aita-ascent:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(14,14,14,.98),rgba(14,14,14,.80) 24%,rgba(14,14,14,.22) 53%,transparent 76%)}
    .aita-intro{position:fixed;inset:0;z-index:10000;overflow:hidden;background:#0e0e0e;opacity:1;touch-action:none;transition:opacity 620ms cubic-bezier(.22,.61,.36,1)}
    .aita-intro.out{opacity:0}html[data-aita-intro]{overflow:hidden}html[data-aita-intro] .hero-copy,html[data-aita-intro] .hero-meta{opacity:0!important;transform:translateY(14px)!important}
    @media(max-width:720px){.aita-ascent{opacity:.94}.aita-ascent:after{background:linear-gradient(180deg,rgba(14,14,14,.02),rgba(14,14,14,.26) 46%,rgba(14,14,14,.96) 82%)}}
    @media(prefers-reduced-motion:reduce){.aita-intro{display:none!important}.aita-ascent{opacity:.82}}
  `;
  doc.head.append(style);

  const layer = doc.createElement("div");
  layer.className = "aita-ascent";
  layer.dataset.heroAscent = "";
  layer.setAttribute("aria-hidden", "true");
  const canvas = doc.createElement("canvas");
  layer.append(canvas);
  hero.insertBefore(layer, hero.querySelector(".hero-copy"));
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => {
    const t = clamp((v - a) / Math.max(.0001, b - a));
    return t * t * (3 - 2 * t);
  };
  const hash = (x, y = 0) => {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  };
  const ease = (v) => 1 - Math.pow(1 - clamp(v), 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  const fade = (t) => t * t * (3 - 2 * t);

  let w = 1, h = 1, mobile = false;
  let glyphs = [], rowMeshes = [], columnMeshes = [], crestMeshes = [], route = [];
  let summitPoint = { x: 0, y: 0, scale: 1 };
  let progress = reduced ? 1 : 0, resizeTimer = 0;

  const world = {
    xMin: -1.36,
    xMax: 1.42,
    zMin: .035,
    zMax: 1.28,
    summitX: -.08,
    summitZ: .28
  };

  const valueNoise = (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z);
    const tx = fade(x - xi), tz = fade(z - zi);
    const a = hash(xi, zi), b = hash(xi + 1, zi);
    const c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  };

  const fbm = (x, z) => {
    let sum = 0, amplitude = .54, frequency = 1;
    for (let octave = 0; octave < 4; octave += 1) {
      sum += valueNoise(x * frequency, z * frequency) * amplitude;
      frequency *= 2.07;
      amplitude *= .49;
    }
    return sum;
  };

  const cone = (x, z, cx, cz, rx, rz, power = 1.16) => {
    const d = Math.hypot((x - cx) / rx, (z - cz) / rz);
    return Math.pow(Math.max(0, 1 - d), power);
  };

  const gaussian = (x, z, cx, cz, sx, sz) => {
    const dx = (x - cx) / sx, dz = (z - cz) / sz;
    return Math.exp(-(dx * dx + dz * dz) * 1.65);
  };

  const terrain = (x, z) => {
    const main = 1.14 * cone(x, z, -.08, .28, .78, .59, 1.04);
    const rightPeak = .73 * cone(x, z, .76, .48, .66, .48, 1.12);
    const leftShoulder = .52 * cone(x, z, -.76, .61, .72, .60, 1.18);
    const rearSpire = .34 * cone(x, z, .28, .085, .42, .31, 1.28);
    const mainRidge = .22 * gaussian(x, z, -.16 - (z - .30) * .58, .52, .24, .76);
    const rightRidge = .16 * gaussian(x, z, .18 + (z - .30) * 1.03, .53, .27, .66);
    const valley = .16 * gaussian(x, z, .33, .61, .29, .33);
    let height = Math.max(main, rightPeak, leftShoulder, rearSpire) + mainRidge + rightRidge - valley;
    const footprint = smooth(.02, .20, height);
    const ridged = 1 - Math.abs(fbm(x * 2.35 + 7.4, z * 2.55 + 3.1) * 2 - 1);
    const grain = fbm(x * 5.6 + 19.2, z * 5.2 + 11.7) - .5;
    height += footprint * ((ridged - .53) * .105 + grain * .075);
    return Math.max(0, height);
  };

  let camera = null;
  const project = (x, z, y) => {
    const perspective = camera.perspectiveBase + z * camera.perspectiveGain;
    return {
      x: camera.originX + (x + (z - .48) * camera.shear) * camera.scaleX * perspective,
      y: camera.horizonY + z * camera.depthY - y * camera.heightY * perspective,
      scale: perspective,
      depth: z
    };
  };

  const surfaceSample = (x, z) => {
    const y = terrain(x, z);
    const e = .016;
    const dx = (terrain(x + e, z) - terrain(x - e, z)) / (2 * e);
    const dz = (terrain(x, z + e) - terrain(x, z - e)) / (2 * e);
    const nx0 = -dx * 1.05, ny0 = 1, nz0 = -dz * .90;
    const length = Math.hypot(nx0, ny0, nz0) || 1;
    const nx = nx0 / length, ny = ny0 / length, nz = nz0 / length;
    const lightLength = Math.hypot(-.58, .78, -.31);
    const light = clamp((nx * -.58 + ny * .78 + nz * -.31) / lightLength, -.2, 1);
    return { y, dx, dz, slope: Math.hypot(dx, dz), light };
  };

  const projectedTerrainPoint = (x, z, lift = 0) => {
    const y = terrain(x, z);
    const point = project(x, z, y + lift);
    return { ...point, worldX: x, worldZ: z, height: y };
  };

  const glyphFor = (sample, x, z) => {
    const contour = Math.abs(((sample.y * 9.2) % 1) - .5);
    if (sample.slope > 2.18) {
      if (Math.abs(sample.dx) > Math.abs(sample.dz) * .72) return sample.dx > 0 ? "\\" : "/";
      return sample.dz > 0 ? "|" : "!";
    }
    if (contour < .075 && sample.y > .14) return sample.dz > .18 ? "_" : "-";
    const ramp = ["·", ".", ":", "-", "=", "+", "*", "x", "#"];
    const shade = clamp(.12 + (sample.light + .18) * .67 + Math.min(.18, sample.slope * .035));
    const jitter = (hash(x * 71, z * 89) - .5) * 1.25;
    return ramp[Math.round(clamp(shade * (ramp.length - 1) + jitter, 0, ramp.length - 1))];
  };

  const makePolyline = (points, stage, alpha, dashed = false) => ({ points, stage, alpha, dashed });

  const sizeMountain = () => {
    const box = hero.getBoundingClientRect();
    w = Math.max(1, Math.round(box.width));
    h = Math.max(1, Math.round(box.height));
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mobile = w < 720;
    camera = mobile ? {
      originX: w * .64,
      horizonY: h * .235,
      scaleX: w * .48,
      depthY: h * .52,
      heightY: h * .255,
      shear: -.22,
      perspectiveBase: .61,
      perspectiveGain: .25
    } : {
      originX: w * .775,
      horizonY: h * .37,
      scaleX: w * .305,
      depthY: h * .44,
      heightY: h * .31,
      shear: -.28,
      perspectiveBase: .64,
      perspectiveGain: .31
    };

    glyphs = [];
    rowMeshes = [];
    columnMeshes = [];
    crestMeshes = [];
    route = [];

    const xCount = mobile ? 49 : 84;
    const zCount = mobile ? 29 : 46;
    const xStep = (world.xMax - world.xMin) / xCount;
    const zStep = (world.zMax - world.zMin) / zCount;
    const fontSize = mobile ? 8.2 : 10.1;
    const cell = fontSize * .72;
    const zBuffer = new Map();
    const columns = Array.from({ length: xCount + 1 }, () => []);

    for (let zi = 0; zi <= zCount; zi += 1) {
      const z = world.zMin + zi * zStep;
      const row = [];
      for (let xi = 0; xi <= xCount; xi += 1) {
        const x = world.xMin + xi * xStep;
        const sample = surfaceSample(x, z);
        if (sample.y < .026) {
          row.push(null);
          columns[xi].push(null);
          continue;
        }
        const point = project(x, z, sample.y);
        const visibleOnCanvas = point.x > -40 && point.x < w + 45 && point.y > -35 && point.y < h + 40;
        if (!visibleOnCanvas) {
          row.push(null);
          columns[xi].push(null);
          continue;
        }

        const distanceFromSummit = Math.hypot((x - world.summitX) * .73, (z - world.summitZ) * .92);
        const stage = clamp(.035 + distanceFromSummit * .45 + (1 - clamp(sample.y)) * .085 + hash(xi + 4, zi + 8) * .055, 0, .92);
        const near = smooth(world.zMin, world.zMax, z);
        const mass = smooth(.025, .19, sample.y);
        const depthAlpha = .34 + near * .66;
        const lightAlpha = .15 + clamp(sample.light + .18) * .41;
        const alpha = mass * depthAlpha * lightAlpha;
        const keep = clamp(.46 + clamp(sample.light + .20) * .31 + near * .17 + Math.min(.08, sample.slope * .014), .40, .96);
        const accent = hash(xi * 7 + 13, zi * 11 + 3) < .012 && sample.y > .16;
        const glyph = {
          x: point.x,
          y: point.y,
          z,
          scale: point.scale,
          height: sample.y,
          stage,
          char: glyphFor(sample, x, z),
          alpha: alpha * (accent ? 1.55 : 1),
          accent,
          slope: sample.slope,
          light: sample.light,
          keep
        };

        const key = `${Math.round(point.x / cell)}:${Math.round(point.y / (cell * .92))}`;
        const previous = zBuffer.get(key);
        if (!previous || z > previous.z || (Math.abs(z - previous.z) < .035 && sample.y > previous.height)) zBuffer.set(key, glyph);
        const meshPoint = { x: point.x, y: point.y, stage, z, height: sample.y };
        row.push(meshPoint);
        columns[xi].push(meshPoint);
      }
      if (zi % 2 === 0) {
        const stage = clamp(.07 + Math.abs(z - world.summitZ) * .39, .04, .78);
        rowMeshes.push(makePolyline(row, stage, .030 + smooth(.08, 1.28, z) * .034));
      }
    }

    for (let xi = 0; xi <= xCount; xi += mobile ? 5 : 6) {
      const x = world.xMin + xi * xStep;
      const stage = clamp(.10 + Math.abs(x - world.summitX) * .30, .07, .78);
      columnMeshes.push(makePolyline(columns[xi], stage, .013, true));
    }

    glyphs = [...zBuffer.values()]
      .filter(g => hash(Math.round(g.x * .33), Math.round(g.y * .41)) < g.keep)
      .sort((a, b) => a.z - b.z || a.y - b.y);

    const crestDefinitions = [
      [[-.08,.28],[-.25,.38],[-.43,.51],[-.63,.69],[-.89,.93]],
      [[-.08,.28],[.12,.33],[.34,.40],[.56,.48],[.78,.58],[1.02,.75]],
      [[-.08,.28],[.03,.20],[.18,.12],[.31,.085]]
    ];
    crestDefinitions.forEach((definition, index) => {
      const points = [];
      for (let segment = 0; segment < definition.length - 1; segment += 1) {
        const [ax, az] = definition[segment], [bx, bz] = definition[segment + 1];
        for (let step = 0; step < 18; step += 1) {
          const t = step / 18;
          points.push(projectedTerrainPoint(lerp(ax, bx, t), lerp(az, bz, t), .006));
        }
      }
      const last = definition[definition.length - 1];
      points.push(projectedTerrainPoint(last[0], last[1], .006));
      crestMeshes.push(makePolyline(points, .10 + index * .055, index === 2 ? .12 : .18));
    });

    const routeWorld = [
      [-.88,.94],[-.70,.80],[-.55,.69],[-.42,.58],[-.31,.49],[-.22,.42],[-.14,.35],[-.08,.29]
    ];
    route = routeWorld.map(([x, z]) => projectedTerrainPoint(x, z, .013));
    summitPoint = projectedTerrainPoint(world.summitX, world.summitZ, .018);
  };

  const strokeMesh = (mesh, reveal, color, width = 1) => {
    const visible = smooth(mesh.stage, mesh.stage + .20, reveal);
    if (visible < .01) return;
    ctx.save();
    ctx.globalAlpha = mesh.alpha * visible;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (mesh.dashed) ctx.setLineDash([1, mobile ? 8 : 10]);
    ctx.beginPath();
    let pen = false;
    mesh.points.forEach(point => {
      if (!point) { pen = false; return; }
      if (pen) ctx.lineTo(point.x, point.y);
      else { ctx.moveTo(point.x, point.y); pen = true; }
    });
    ctx.stroke();
    ctx.restore();
  };

  const drawClimber = (routeIndex, accent = false, scale = 1) => {
    const point = route[routeIndex];
    const before = route[Math.max(0, routeIndex - 1)];
    const after = route[Math.min(route.length - 1, routeIndex + 1)];
    if (!point || !before || !after) return;
    const angle = Math.atan2(after.y - before.y, after.x - before.x);
    const s = (mobile ? .72 : .92) * point.scale * scale;
    const inheritedAlpha = ctx.globalAlpha;
    ctx.save();
    ctx.translate(point.x, point.y - 2.5 * s);
    ctx.rotate(angle * .22);
    ctx.strokeStyle = ctx.fillStyle = accent ? green : white;
    ctx.globalAlpha = inheritedAlpha * (accent ? .94 : .73);
    ctx.lineWidth = Math.max(.7, s * .82);
    ctx.beginPath(); ctx.arc(0, -6.8 * s, 1.42 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -5.2*s); ctx.lineTo(-.7*s, -.2*s);
    ctx.moveTo(-.1*s, -3.6*s); ctx.lineTo(-3.7*s, -1.2*s);
    ctx.moveTo(-.2*s, -3.5*s); ctx.lineTo(3.3*s, -1.8*s);
    ctx.moveTo(-.7*s, -.1*s); ctx.lineTo(-3.4*s, 3.7*s);
    ctx.moveTo(-.7*s, -.1*s); ctx.lineTo(2.3*s, 3.4*s);
    ctx.stroke();
    ctx.globalAlpha = inheritedAlpha * .30;
    ctx.strokeStyle = ink;
    ctx.strokeRect(-3.1*s, -4.8*s, 2.2*s, 3.3*s);
    ctx.restore();
  };

  const drawRoute = (reveal) => {
    const visible = smooth(.62, .84, reveal);
    if (visible < .01 || route.length < 2) return;
    ctx.save();
    ctx.globalAlpha = .18 * visible;
    ctx.strokeStyle = ink;
    ctx.lineWidth = .75;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    route.forEach((point, index) => index ? ctx.lineTo(point.x, point.y - 1) : ctx.moveTo(point.x, point.y - 1));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = visible;
    drawClimber(3, false, 1.10);
    drawClimber(5, false, 1.16);
    drawClimber(6, true, 1.22);
    ctx.restore();
  };

  const drawBeacon = (reveal) => {
    const visible = smooth(.72, .91, reveal);
    if (visible < .01) return;
    const x = summitPoint.x, y = summitPoint.y;
    ctx.save();
    ctx.strokeStyle = green;
    ctx.fillStyle = green;
    ctx.globalAlpha = .62 * visible;
    ctx.lineWidth = .9;
    ctx.beginPath();
    ctx.moveTo(x, y - 1); ctx.lineTo(x, y - (mobile ? 14 : 19));
    ctx.moveTo(x - 4, y - (mobile ? 10 : 14)); ctx.lineTo(x + 4, y - (mobile ? 10 : 14));
    ctx.stroke();
    ctx.globalAlpha = .22 * visible;
    ctx.beginPath(); ctx.arc(x, y - (mobile ? 10 : 14), mobile ? 7 : 10, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = .82 * visible;
    ctx.fillRect(x - .8, y - (mobile ? 10.8 : 14.8), 1.6, 1.6);
    ctx.restore();
  };

  const drawCrestAscii = (mesh, index, reveal) => {
    const visible = smooth(mesh.stage, mesh.stage + .19, reveal);
    if (visible < .01) return;
    const points = mesh.points.filter(Boolean);
    ctx.save();
    ctx.font = `${mobile ? 7.8 : 9.2}px "Cascadia Mono","JetBrains Mono",Consolas,monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 1; i < points.length - 1; i += mobile ? 4 : 3) {
      const before = points[i - 1], point = points[i], after = points[i + 1];
      const slope = Math.atan2(after.y - before.y, after.x - before.x);
      const char = slope < -.24 ? "/" : slope > .24 ? "\\" : (index === 2 ? ":" : "^");
      ctx.globalAlpha = (index === 2 ? .18 : .36) * visible;
      ctx.fillStyle = index === 2 ? ink : white;
      ctx.fillText(char, point.x, point.y - 1);
    }
    ctx.restore();
  };

  const drawMountain = (p = progress) => {
    progress = clamp(p);
    ctx.clearRect(0, 0, w, h);

    rowMeshes.forEach(mesh => strokeMesh(mesh, progress, ink));
    columnMeshes.forEach(mesh => strokeMesh(mesh, progress, ink));

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let activeFont = "";
    glyphs.forEach(glyph => {
      const visible = smooth(glyph.stage, glyph.stage + .17, progress);
      if (visible < .012) return;
      const near = smooth(.45, 1.28, glyph.z);
      const baseSize = mobile ? 7.45 : 8.65;
      const fontSize = Math.round(baseSize * (.76 + glyph.scale * .46 + near * .12) * 2) / 2;
      const nextFont = `${fontSize}px "Cascadia Mono","JetBrains Mono",Consolas,monospace`;
      if (nextFont !== activeFont) { ctx.font = nextFont; activeFont = nextFont; }
      const nearBoost = .80 + near * .34;
      const lit = smooth(.02, .88, glyph.light + .18);
      ctx.globalAlpha = Math.min(.68, glyph.alpha * visible * nearBoost * (glyph.accent ? 1.38 : 1));
      ctx.fillStyle = glyph.accent ? green : (lit > .55 ? white : ink);
      ctx.fillText(glyph.char, glyph.x, glyph.y);
    });
    ctx.restore();

    crestMeshes.forEach((mesh, index) => {
      strokeMesh(mesh, progress, index === 2 ? ink : white, index === 2 ? .65 : .78);
      drawCrestAscii(mesh, index, progress);
    });
    drawRoute(progress);
    drawBeacon(progress);
    ctx.globalAlpha = 1;
  };

  const redrawMountain = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { sizeMountain(); drawMountain(progress); }, 90);
  };
  addEventListener("resize", redrawMountain, { passive: true });
  sizeMountain();
  if (reduced) { drawMountain(1); return; }

  root.dataset.aitaIntro = "active";
  const overlay = doc.createElement("div");
  overlay.className = "aita-intro";
  overlay.setAttribute("aria-hidden", "true");
  const introCanvas = doc.createElement("canvas");
  overlay.append(introCanvas);
  doc.body.append(overlay);
  const intro = introCanvas.getContext("2d", { alpha: true });
  if (!intro) { root.removeAttribute("data-aita-intro"); overlay.remove(); drawMountain(1); return; }

  let iw=1, ih=1, particles=[], frame=0, start=performance.now(), done=false;
  const sizeIntro = () => {
    iw=Math.max(1,innerWidth);ih=Math.max(1,innerHeight);
    const dpr=Math.min(devicePixelRatio||1,1.75);
    introCanvas.width=Math.round(iw*dpr);introCanvas.height=Math.round(ih*dpr);intro.setTransform(dpr,0,0,dpr,0,0);
    const off=doc.createElement("canvas");off.width=iw;off.height=ih;
    const o=off.getContext("2d",{willReadFrequently:true});if(!o)return;
    const fs=Math.min(280,iw*.255,ih*.34),cy=ih*.48;
    o.font=`800 ${fs}px "Segoe UI",Arial,sans-serif`;o.textAlign="center";o.textBaseline="middle";o.fillStyle="#fff";o.fillText("AITA",iw/2,cy);
    const px=o.getImageData(0,0,iw,ih).data,gap=iw<600?3:6,raw=[];
    for(let y=0;y<ih;y+=gap)for(let x=0;x<iw;x+=gap)if(px[(y*iw+x)*4+3]>128)raw.push([x,y]);
    const stride=Math.max(1,Math.ceil(raw.length/(iw<600?2500:4300)));
    particles=raw.filter((_,i)=>i%stride===0).map(([x,y],i)=>({x,y,a:hash(y+41,x+17)*Math.PI*2,s:.055+hash(x+i,y-i)*.15,d:hash(i,x)*.2,z:.75+hash(i+13,y)*1.15,g:hash(i+77,x+y)<.105,p:hash(x*.5,y*.5)*Math.PI*2}));
  };
  const drawIntro = (ms) => {
    intro.clearRect(0,0,iw,ih);const scatter=clamp((ms-280)/700),cx=iw/2,cy=ih*.48;
    intro.globalCompositeOperation="lighter";
    particles.forEach(q=>{const local=clamp((scatter-q.d)/Math.max(.01,1-q.d)),e=ease(local),zoom=1+e*2.55,drift=e*e*Math.min(iw,ih)*q.s,sh=scatter<.08?Math.sin(ms*.018+q.p)*.65:0,alpha=Math.pow(1-e,1.35)*(.62+q.z*.23);if(alpha<.012)return;intro.globalAlpha=Math.min(q.g ? .96 : .88,alpha);intro.fillStyle=q.g?green:white;const z=q.z*(1+e*.65);intro.fillRect(cx+(q.x-cx)*zoom+Math.cos(q.a)*drift+sh,cy+(q.y-cy)*zoom+Math.sin(q.a)*drift+sh*.4,z,z)});
    intro.globalAlpha=1;intro.globalCompositeOperation="source-over";
  };
  const release = () => {
    if(done)return;done=true;cancelAnimationFrame(frame);progress=1;drawMountain(1);root.removeAttribute("data-aita-intro");overlay.remove();removeEventListener("resize",sizeIntro);doc.removeEventListener("keydown",skipKey);
  };
  const skipKey = e => { if (["Escape","Enter"," "].includes(e.key)) release(); };
  const tick = now => {
    if(done)return;const ms=now-start;drawIntro(ms);drawMountain(ease((ms-520)/1320));
    if(ms>=780)overlay.classList.add("out");if(ms>=1180)root.removeAttribute("data-aita-intro");if(ms>=1460)overlay.remove();if(ms>=1900)return release();frame=requestAnimationFrame(tick);
  };
  sizeIntro();overlay.addEventListener("pointerdown",release,{once:true});doc.addEventListener("keydown",skipKey);addEventListener("resize",sizeIntro,{passive:true});frame=requestAnimationFrame(tick);
})();
