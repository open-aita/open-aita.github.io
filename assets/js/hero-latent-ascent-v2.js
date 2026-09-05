(() => {
  "use strict";

  const doc = document;
  const root = doc.documentElement;
  const body = doc.body;
  const hero = doc.querySelector(".hero");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const releasePage = () => {
    root.classList.remove("hero-intro-pending");
    root.classList.add("hero-intro-ready");
  };

  if (!(hero instanceof HTMLElement)) {
    releasePage();
    return;
  }

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const mix = (a, b, t) => a + ((b - a) * t);
  const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const easeInCubic = (t) => Math.pow(clamp01(t), 3);
  const smoothstep = (t) => {
    const n = clamp01(t);
    return n * n * (3 - (2 * n));
  };

  const seededRandom = (seedValue) => {
    let seed = seedValue >>> 0;
    return () => {
      seed += 0x6d2b79f5;
      let value = seed;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------------------------------------------------------------------
     Persistent hero illustration: a deterministic point / ASCII mountain.
     It is rendered once per layout size and has no idle animation cost.
  --------------------------------------------------------------------- */
  const mountain = doc.createElement("div");
  mountain.className = "latent-ascent";
  mountain.setAttribute("aria-hidden", "true");
  mountain.innerHTML = `
    <canvas class="latent-ascent__canvas"></canvas>
    <span class="latent-ascent__readout">LATENT ASCENT / FIG.00</span>
    <span class="latent-ascent__coordinates"><b>∞ FRONTIER</b><span>23°08′ / 113°16′</span><span>RESEARCH ALTITUDE / OPEN</span></span>
  `;
  hero.insertBefore(mountain, hero.querySelector(".hero-copy"));

  const mountainCanvas = mountain.querySelector("canvas");
  const mountainContext = mountainCanvas instanceof HTMLCanvasElement
    ? mountainCanvas.getContext("2d", { alpha: true })
    : null;

  const pointInPolygon = (x, y, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];
      const intersects = ((yi > y) !== (yj > y))
        && (x < (((xj - xi) * (y - yi)) / ((yj - yi) || 0.00001)) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  };

  const drawClimber = (context, x, y, angle, accent, index, scale) => {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.scale(scale, scale);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = accent ? "rgba(154,167,184,.90)" : "rgba(232,235,228,.76)";
    context.fillStyle = accent ? "rgba(154,167,184,.90)" : "rgba(232,235,228,.78)";
    context.lineWidth = 1.05;

    context.beginPath();
    context.arc(0, -5.4, 1.55, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(0, -3.4);
    context.lineTo(-.3, 2.8);
    context.moveTo(-.1, -1.2);
    context.lineTo(-4.1, 1.1);
    context.moveTo(-.1, -.8);
    context.lineTo(3.4, -3.2);
    context.moveTo(-.3, 2.6);
    context.lineTo(-3.5, 6.8);
    context.moveTo(-.3, 2.6);
    context.lineTo(3.4, 5.5);
    context.stroke();

    context.strokeStyle = accent ? "rgba(154,167,184,.45)" : "rgba(185,187,180,.34)";
    context.strokeRect(-3.0, -2.8, 2.4, 3.8);
    context.restore();

    context.save();
    context.fillStyle = "rgba(185,187,180,.35)";
    context.font = `${Math.max(7, 7.5 * scale)}px "Cascadia Mono", Consolas, monospace`;
    context.textAlign = "center";
    context.fillText(`0${index}`, x + (8 * scale), y - (10 * scale));
    context.restore();
  };

  const drawMountain = () => {
    if (!(mountainCanvas instanceof HTMLCanvasElement) || !mountainContext) return;

    const bounds = mountain.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    mountainCanvas.width = Math.round(width * dpr);
    mountainCanvas.height = Math.round(height * dpr);
    mountainContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    mountainContext.clearRect(0, 0, width, height);

    const random = seededRandom(Math.round((width * 17) + (height * 31) + 2026));
    const ridgeNormalized = [
      [-.04, .88], [.07, .80], [.15, .72], [.24, .77], [.33, .57],
      [.42, .65], [.50, .46], [.57, .51], [.68, .18], [.74, .36],
      [.80, .29], [.88, .48], [.96, .40], [1.06, .57]
    ];
    const ridge = ridgeNormalized.map(([x, y]) => [x * width, y * height]);
    const polygon = [...ridge, [width * 1.08, height * .97], [-width * .08, height * .97]];

    const tracePolygon = () => {
      mountainContext.beginPath();
      mountainContext.moveTo(polygon[0][0], polygon[0][1]);
      for (let i = 1; i < polygon.length; i += 1) {
        mountainContext.lineTo(polygon[i][0], polygon[i][1]);
      }
      mountainContext.closePath();
    };

    // Sparse atmosphere above the ridge; strictly gray-white.
    const skyCount = Math.round(Math.min(170, Math.max(66, width / 7)));
    for (let i = 0; i < skyCount; i += 1) {
      const x = width * (.22 + (random() * .82));
      const y = height * (.05 + (random() * .57));
      if (pointInPolygon(x, y, polygon)) continue;
      const bright = random() > .92;
      mountainContext.fillStyle = bright
        ? `rgba(232,235,228,${.08 + (random() * .16)})`
        : `rgba(226,230,222,${.025 + (random() * .075)})`;
      const size = random() > .88 ? 1.5 : 1;
      mountainContext.fillRect(x, y, size, size);
    }

    mountainContext.save();
    tracePolygon();
    mountainContext.clip();

    const faceGradient = mountainContext.createLinearGradient(0, height * .12, width, height);
    faceGradient.addColorStop(0, "rgba(255,255,255,.005)");
    faceGradient.addColorStop(.58, "rgba(255,255,255,.018)");
      faceGradient.addColorStop(.76, "rgba(226,230,222,.022)");
    faceGradient.addColorStop(1, "rgba(255,255,255,.008)");
    mountainContext.fillStyle = faceGradient;
    mountainContext.fillRect(0, 0, width, height);

    // Topographic contours, clipped to the mountain silhouette.
    const contourGap = Math.max(17, Math.min(27, width / 48));
    mountainContext.lineWidth = 1;
    for (let row = 0, y = height * .31; y < height * .96; y += contourGap, row += 1) {
      mountainContext.beginPath();
      for (let x = -20; x <= width + 20; x += 12) {
        const normalizedX = x / width;
        const wave = Math.sin((normalizedX * 10.4) + (row * .69)) * (4 + (row * .22));
        const secondary = Math.sin((normalizedX * 23.0) - (row * .31)) * 1.8;
        const py = y + wave + secondary;
        if (x === -20) mountainContext.moveTo(x, py);
        else mountainContext.lineTo(x, py);
      }
      mountainContext.strokeStyle = row % 4 === 0
        ? "rgba(205,209,201,.105)"
        : "rgba(205,209,201,.070)";
      mountainContext.stroke();
    }

    // Facet lines preserve a technical, non-illustrative character.
    const peak = ridge[8];
    const facetTargets = [ridge[1], ridge[3], ridge[5], ridge[10], ridge[12], [width * .99, height * .94]];
    facetTargets.forEach((target, index) => {
      mountainContext.beginPath();
      mountainContext.moveTo(peak[0], peak[1]);
      const controlX = mix(peak[0], target[0], .54) + ((index - 2) * 11);
      const controlY = mix(peak[1], target[1], .50) + (index % 2 ? 26 : -8);
      mountainContext.quadraticCurveTo(controlX, controlY, target[0], target[1]);
      mountainContext.strokeStyle = index === 3
        ? "rgba(224,228,220,.11)"
        : "rgba(224,228,220,.055)";
      mountainContext.stroke();
    });

    // Dot field.
    const dotTarget = Math.min(1050, Math.max(360, Math.round((width * height) / 1900)));
    let drawnDots = 0;
    let attempts = 0;
    while (drawnDots < dotTarget && attempts < dotTarget * 5) {
      attempts += 1;
      const x = random() * width;
      const y = height * (.17 + (random() * .80));
      if (!pointInPolygon(x, y, polygon)) continue;
      const signal = random() > .93;
      const alpha = .055 + (random() * (signal ? .29 : .16));
      mountainContext.fillStyle = signal
        ? `rgba(238,241,234,${alpha})`
        : `rgba(225,229,221,${alpha})`;
      const size = random() > .86 ? 1.45 : .9;
      mountainContext.fillRect(x, y, size, size);
      drawnDots += 1;
    }

    // ASCII texture. Its density scales down on narrow layouts.
    const characters = ["·", "/", "\\", ":", "+", "^", "_", "|", "<", ">"];
    const xGap = width < 720 ? 24 : 20;
    const yGap = width < 720 ? 23 : 19;
    mountainContext.textAlign = "center";
    mountainContext.textBaseline = "middle";
    mountainContext.font = `${width < 720 ? 7 : 8}px "Cascadia Mono", Consolas, monospace`;
    for (let y = height * .27; y < height * .94; y += yGap) {
      for (let x = width * .04; x < width; x += xGap) {
        const jitterX = x + ((random() - .5) * 5);
        const jitterY = y + ((random() - .5) * 4);
        if (!pointInPolygon(jitterX, jitterY, polygon) || random() < .29) continue;
        const character = characters[Math.floor(random() * characters.length)];
        const bright = random() > .955;
        mountainContext.fillStyle = bright
          ? `rgba(232,235,228,${.16 + (random() * .19)})`
          : `rgba(215,219,211,${.055 + (random() * .085)})`;
        mountainContext.fillText(character, jitterX, jitterY);
      }
    }
    mountainContext.restore();

    // Primary ridge.
    mountainContext.beginPath();
    mountainContext.moveTo(ridge[0][0], ridge[0][1]);
    ridge.slice(1).forEach(([x, y]) => mountainContext.lineTo(x, y));
    const ridgeGradient = mountainContext.createLinearGradient(width * .2, 0, width * .92, 0);
    ridgeGradient.addColorStop(0, "rgba(224,228,220,.08)");
    ridgeGradient.addColorStop(.55, "rgba(224,228,220,.28)");
    ridgeGradient.addColorStop(.68, "rgba(154,167,184,.44)");
    ridgeGradient.addColorStop(1, "rgba(224,228,220,.12)");
    mountainContext.strokeStyle = ridgeGradient;
    mountainContext.lineWidth = 1.1;
    mountainContext.stroke();

    // Climbing route and rope team.
    const route = [
      [.25, .755], [.35, .625], [.45, .585], [.53, .485], [.60, .405], [.68, .185]
    ].map(([x, y]) => [x * width, y * height]);
    mountainContext.beginPath();
    mountainContext.moveTo(route[0][0], route[0][1]);
    route.slice(1).forEach(([x, y]) => mountainContext.lineTo(x, y));
    mountainContext.setLineDash([3, 6]);
    mountainContext.strokeStyle = "rgba(154,167,184,.30)";
    mountainContext.lineWidth = .9;
    mountainContext.stroke();
    mountainContext.setLineDash([]);

    const climberScale = Math.max(.78, Math.min(1.25, width / 930));
    drawClimber(mountainContext, route[1][0], route[1][1], -.22, false, 1, climberScale);
    drawClimber(mountainContext, route[2][0], route[2][1], .12, false, 2, climberScale);
    drawClimber(mountainContext, route[4][0], route[4][1], -.30, true, 3, climberScale);

    // Summit beacon.
    const beaconX = peak[0];
    const beaconY = peak[1];
    mountainContext.strokeStyle = "rgba(120,231,114,.42)";
    mountainContext.lineWidth = 1;
    mountainContext.beginPath();
    mountainContext.arc(beaconX, beaconY, 7, 0, Math.PI * 2);
    mountainContext.moveTo(beaconX - 14, beaconY);
    mountainContext.lineTo(beaconX + 14, beaconY);
    mountainContext.moveTo(beaconX, beaconY - 14);
    mountainContext.lineTo(beaconX, beaconY + 14);
    mountainContext.stroke();
    mountainContext.fillStyle = "rgba(120,231,114,.83)";
    mountainContext.fillRect(beaconX - 1, beaconY - 1, 2, 2);
    mountainContext.fillStyle = "rgba(120,231,114,.45)";
    mountainContext.font = `${Math.max(8, width / 135)}px "Cascadia Mono", Consolas, monospace`;
    mountainContext.textAlign = "left";
    mountainContext.fillText("∞ / FRONTIER", beaconX + 18, beaconY - 9);
  };

  let resizeTimer = 0;
  const queueMountainDraw = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(drawMountain, 90);
  };
  drawMountain();
  window.addEventListener("resize", queueMountainDraw, { passive: true });

  if (reduceMotion) {
    mountain.classList.add("is-visible");
    releasePage();
    return;
  }

  /* ---------------------------------------------------------------------
     First-load transition: particles hold the AITA wordmark, expand through
     the viewer, then dissolve while the mountain and page shell surface.
  --------------------------------------------------------------------- */
  root.classList.add("hero-intro-pending");

  const intro = doc.createElement("div");
  intro.className = "aita-intro";
  intro.setAttribute("aria-hidden", "true");
  intro.innerHTML = `
    <canvas class="aita-intro__canvas"></canvas>
    <span class="aita-intro__status"><span>INITIALIZING FRONTIER</span><i></i><span>AITA / 2026</span></span>
  `;
  body.prepend(intro);

  const introCanvas = intro.querySelector("canvas");
  const introContext = introCanvas instanceof HTMLCanvasElement
    ? introCanvas.getContext("2d", { alpha: true })
    : null;

  let viewportWidth = 1;
  let viewportHeight = 1;
  let introDpr = 1;
  let letterParticles = [];
  let ambientParticles = [];
  let introFrame = 0;
  let startTime = 0;
  let finished = false;

  const buildWordmark = () => {
    if (!(introCanvas instanceof HTMLCanvasElement) || !introContext) return;
    viewportWidth = Math.max(1, window.innerWidth);
    viewportHeight = Math.max(1, window.innerHeight);
    introDpr = Math.min(window.devicePixelRatio || 1, 1.75);
    introCanvas.width = Math.round(viewportWidth * introDpr);
    introCanvas.height = Math.round(viewportHeight * introDpr);
    introContext.setTransform(introDpr, 0, 0, introDpr, 0, 0);

    const offscreen = doc.createElement("canvas");
    offscreen.width = viewportWidth;
    offscreen.height = viewportHeight;
    const offscreenContext = offscreen.getContext("2d", { willReadFrequently: true });
    if (!offscreenContext) return;

    const fontSize = Math.min(280, Math.max(92, viewportWidth * .19), viewportHeight * .31);
    offscreenContext.clearRect(0, 0, viewportWidth, viewportHeight);
    offscreenContext.fillStyle = "#fff";
    offscreenContext.font = `800 ${fontSize}px Arial, Helvetica, sans-serif`;
    offscreenContext.textAlign = "center";
    offscreenContext.textBaseline = "middle";
    offscreenContext.fillText("AITA", viewportWidth / 2, (viewportHeight / 2) - (fontSize * .015));

    const pixels = offscreenContext.getImageData(0, 0, viewportWidth, viewportHeight).data;
    const gap = viewportWidth < 600 ? 5 : 7;
    const candidates = [];
    for (let y = 0; y < viewportHeight; y += gap) {
      for (let x = 0; x < viewportWidth; x += gap) {
        if (pixels[((y * viewportWidth) + x) * 4 + 3] > 110) candidates.push([x, y]);
      }
    }

    const maxParticles = viewportWidth < 600 ? 1050 : 1900;
    const stride = Math.max(1, Math.ceil(candidates.length / maxParticles));
    const random = seededRandom(0x41495441 + viewportWidth + viewportHeight);
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    letterParticles = [];
    for (let i = 0; i < candidates.length; i += stride) {
      const [targetX, targetY] = candidates[i];
      const angle = Math.atan2(targetY - centerY, targetX - centerX) + ((random() - .5) * .7);
      const displacement = 18 + (random() * 58);
      letterParticles.push({
        targetX,
        targetY,
        startX: targetX + (Math.cos(angle) * displacement),
        startY: targetY + (Math.sin(angle) * displacement),
        burstX: Math.cos(angle) * (44 + (random() * 150)),
        burstY: Math.sin(angle) * (44 + (random() * 150)),
        size: .72 + (random() * 1.25),
        phase: random() * Math.PI * 2,
        brand: random() > .84
      });
    }

    ambientParticles = Array.from({ length: viewportWidth < 600 ? 46 : 92 }, () => {
      const angle = random() * Math.PI * 2;
      const radius = Math.min(viewportWidth, viewportHeight) * (.18 + (random() * .43));
      return {
        x: centerX + (Math.cos(angle) * radius),
        y: centerY + (Math.sin(angle) * radius),
        angle,
        speed: 12 + (random() * 42),
        size: random() > .82 ? 1.4 : .8,
        alpha: .035 + (random() * .16),
        brand: random() > .87
      };
    });
  };

  const finishIntro = () => {
    if (finished) return;
    finished = true;
    window.cancelAnimationFrame(introFrame);
    releasePage();
    mountain.classList.add("is-visible");
    intro.remove();
    window.removeEventListener("resize", buildWordmark);
  };

  const drawIntro = (now) => {
    if (!introContext || finished) return;
    if (!startTime) startTime = now;
    const elapsed = now - startTime;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    const assemble = easeOutCubic(elapsed / 245);
    const burst = easeInCubic((elapsed - 610) / 800);
    const fade = 1 - smoothstep((elapsed - 730) / 700);
    const reveal = smoothstep((elapsed - 570) / 680);

    introContext.clearRect(0, 0, viewportWidth, viewportHeight);
    introContext.save();
    introContext.globalCompositeOperation = "lighter";

    ambientParticles.forEach((particle) => {
      const drift = Math.max(0, elapsed - 520) / 1000;
      const x = particle.x + (Math.cos(particle.angle) * particle.speed * drift * drift * 2.4);
      const y = particle.y + (Math.sin(particle.angle) * particle.speed * drift * drift * 2.4);
      const alpha = particle.alpha * Math.max(0, 1 - burst);
      introContext.fillStyle = particle.brand
        ? `rgba(154,167,184,${alpha})`
        : `rgba(226,230,222,${alpha})`;
      introContext.fillRect(x, y, particle.size, particle.size);
    });

    letterParticles.forEach((particle) => {
      const jitter = Math.sin((elapsed * .009) + particle.phase) * (1 - burst) * .55;
      const settledX = mix(particle.startX, particle.targetX, assemble) + jitter;
      const settledY = mix(particle.startY, particle.targetY, assemble) - jitter;
      const scale = 1 + (burst * 2.75);
      const x = centerX + ((settledX - centerX) * scale) + (particle.burstX * burst * burst);
      const y = centerY + ((settledY - centerY) * scale) + (particle.burstY * burst * burst);
      const alpha = Math.max(0, Math.min(1, elapsed / 145)) * Math.pow(Math.max(0, 1 - burst), 1.22);
      const size = particle.size * (1 + (burst * 1.8));
      introContext.fillStyle = particle.brand
        ? `rgba(154,167,184,${alpha * .96})`
        : `rgba(238,241,234,${alpha * .77})`;
      introContext.fillRect(x, y, size, size);
    });

    // A brief signal flare bridges the wordmark and mountain states.
    const flare = Math.max(0, 1 - Math.abs((elapsed - 690) / 185));
    if (flare > 0) {
      const gradient = introContext.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.min(viewportWidth, viewportHeight) * .36);
      gradient.addColorStop(0, `rgba(154,167,184,${flare * .10})`);
      gradient.addColorStop(.35, `rgba(154,167,184,${flare * .028})`);
      gradient.addColorStop(1, "rgba(154,167,184,0)");
      introContext.fillStyle = gradient;
      introContext.fillRect(0, 0, viewportWidth, viewportHeight);
    }
    introContext.restore();

    if (elapsed > 540 && !mountain.classList.contains("is-visible")) {
      mountain.classList.add("is-visible");
    }
    if (elapsed > 930 && root.classList.contains("hero-intro-pending")) {
      releasePage();
    }

    intro.style.opacity = String(Math.max(0, fade));
    intro.style.backgroundColor = `rgba(14,14,14,${Math.max(0, 1 - (reveal * .98))})`;

    if (elapsed >= 1510) {
      finishIntro();
      return;
    }
    introFrame = window.requestAnimationFrame(drawIntro);
  };

  buildWordmark();
  window.addEventListener("resize", buildWordmark, { passive: true });
  doc.addEventListener("visibilitychange", () => {
    if (doc.hidden) finishIntro();
  }, { once: true });

  // A hard recovery guard prevents an unavailable canvas from hiding content.
  window.setTimeout(finishIntro, 1900);
  introFrame = window.requestAnimationFrame(drawIntro);
})();
