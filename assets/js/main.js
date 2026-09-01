(() => {
  "use strict";

  const doc = document;
  const body = doc.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);
  const easeInCubic = (value) => value * value * value;
  const smoothstep = (value) => {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  };

  /* HeroAscent: first-session AITA particle intro, then a static ASCII/dot mountain. */
  const initHeroAscent = () => {
    const hero = doc.querySelector(".hero#top");
    const copy = hero?.querySelector(".hero-copy");
    if (!(hero instanceof HTMLElement) || !copy) return;

    const canvas = doc.createElement("canvas");
    canvas.className = "hero-ascent-canvas";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "3"
    });
    hero.insertBefore(canvas, copy);

    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!context) {
      canvas.remove();
      return;
    }

    const terrainCanvas = doc.createElement("canvas");
    const terrainContext = terrainCanvas.getContext("2d", { alpha: true });
    const params = new URLSearchParams(window.location.search);
    const introOverride = params.get("intro");
    const sessionKey = "aita.hero-intro.latent-ascent.v1";
    const duration = 1720;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let centerX = 1;
    let centerY = 1;
    let particles = [];
    let frame = 0;
    let resizeFrame = 0;
    let startTime = 0;
    let pausedAt = 0;
    let introComplete = false;

    const hasSeenIntro = () => {
      try {
        return window.sessionStorage.getItem(sessionKey) === "seen";
      } catch {
        return false;
      }
    };
    const rememberIntro = () => {
      try {
        window.sessionStorage.setItem(sessionKey, "seen");
      } catch {
        // Local files and hardened browsers may disable storage.
      }
    };
    const shouldRunIntro = !reduceMotion && introOverride !== "0" && (introOverride === "1" || !hasSeenIntro());

    const randomFactory = (seed) => () => {
      let next = seed += 0x6D2B79F5;
      next = Math.imul(next ^ (next >>> 15), next | 1);
      next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };

    const ridge = [
      [40, 690], [150, 648], [250, 675], [360, 574], [442, 602], [566, 456],
      [646, 506], [760, 322], [824, 382], [932, 208], [985, 270], [1064, 174],
      [1110, 245], [1218, 426], [1360, 636], [1400, 660]
    ];

    const pathFromPoints = (target, points, close = false) => {
      target.beginPath();
      points.forEach(([x, y], index) => index ? target.lineTo(x, y) : target.moveTo(x, y));
      if (close) target.closePath();
    };

    const strokePolyline = (target, points, color, lineWidth = 1, dash = []) => {
      target.save();
      pathFromPoints(target, points);
      target.strokeStyle = color;
      target.lineWidth = lineWidth;
      target.setLineDash(dash);
      target.stroke();
      target.restore();
    };

    const drawClimber = (target, x, y, rotation, scale = 1) => {
      target.save();
      target.translate(x, y);
      target.rotate(rotation);
      target.scale(scale, scale);
      target.strokeStyle = "rgba(235,238,231,.82)";
      target.fillStyle = "rgba(120,231,114,.72)";
      target.lineWidth = 2;
      target.lineCap = "round";
      target.lineJoin = "round";
      target.beginPath();
      target.arc(0, -10, 3.2, 0, Math.PI * 2);
      target.moveTo(0, -6); target.lineTo(1, 5);
      target.moveTo(0, -3); target.lineTo(-7, 1);
      target.moveTo(0, -3); target.lineTo(7, -7);
      target.moveTo(1, 5); target.lineTo(-5, 13);
      target.moveTo(1, 5); target.lineTo(8, 11);
      target.stroke();
      target.fillRect(-5, -5, 4, 7);
      target.strokeStyle = "rgba(120,231,114,.36)";
      target.lineWidth = 1;
      target.setLineDash([2, 4]);
      target.beginPath();
      target.moveTo(8, 11);
      target.bezierCurveTo(18, 17, 27, 14, 38, 6);
      target.stroke();
      target.restore();
    };

    const buildTerrain = () => {
      if (!terrainContext) return;
      terrainCanvas.width = Math.round(width * dpr);
      terrainCanvas.height = Math.round(height * dpr);
      terrainContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      terrainContext.clearRect(0, 0, width, height);

      const compact = width < 700;
      const scale = compact
        ? Math.min((width * 1.88) / 1400, (height * .94) / 760)
        : Math.min((width * .90) / 1400, (height * .89) / 760);
      const rightEdge = compact ? width * 1.38 : width * 1.04;
      const originX = rightEdge - 1400 * scale;
      const originY = height * (compact ? .055 : .025);

      terrainContext.save();
      terrainContext.translate(originX, originY);
      terrainContext.scale(scale, scale);

      terrainContext.strokeStyle = "rgba(244,244,242,.052)";
      terrainContext.fillStyle = "rgba(185,187,180,.32)";
      terrainContext.lineWidth = 1 / scale;
      terrainContext.setLineDash([2 / scale, 13 / scale]);
      [178, 310, 442, 574, 706].forEach((y) => {
        terrainContext.beginPath();
        terrainContext.moveTo(118, y);
        terrainContext.lineTo(1368, y);
        terrainContext.stroke();
      });
      terrainContext.setLineDash([]);
      terrainContext.beginPath();
      terrainContext.moveTo(118, 84); terrainContext.lineTo(118, 706); terrainContext.lineTo(1368, 706);
      terrainContext.stroke();

      terrainContext.font = "10px 'Cascadia Mono', Consolas, monospace";
      terrainContext.fillStyle = "rgba(185,187,180,.27)";
      [574, 442, 310, 178].forEach((y, index) => terrainContext.fillText(`0${index + 1}`, 78, y + 4));
      terrainContext.fillText("LATENT ASCENT / FIELD 01", 136, 112);
      terrainContext.fillText("Δz / ∞", 1200, 112);

      const face = [...ridge, [1400, 760], [40, 760]];
      pathFromPoints(terrainContext, face, true);
      const faceGradient = terrainContext.createLinearGradient(300, 620, 1140, 210);
      faceGradient.addColorStop(0, "rgba(120,231,114,0)");
      faceGradient.addColorStop(.52, "rgba(120,231,114,.018)");
      faceGradient.addColorStop(1, "rgba(244,244,242,.04)");
      terrainContext.fillStyle = faceGradient;
      terrainContext.fill();

      terrainContext.save();
      pathFromPoints(terrainContext, face, true);
      terrainContext.clip();
      terrainContext.fillStyle = "rgba(185,187,180,.19)";
      for (let y = 150; y < 748; y += 21) {
        for (let x = 90 + ((y / 21) % 2) * 8; x < 1390; x += 21) {
          terrainContext.fillRect(x, y, 1.25, 1.25);
        }
      }
      terrainContext.restore();

      const ridgeGradient = terrainContext.createLinearGradient(40, 0, 1400, 0);
      ridgeGradient.addColorStop(0, "rgba(185,187,180,.08)");
      ridgeGradient.addColorStop(.44, "rgba(185,187,180,.30)");
      ridgeGradient.addColorStop(.77, "rgba(120,231,114,.58)");
      ridgeGradient.addColorStop(1, "rgba(185,187,180,.18)");
      strokePolyline(terrainContext, ridge, ridgeGradient, 1.3 / scale);

      const contours = [
        [[92,708],[254,690],[382,621],[506,625],[641,537],[724,552],[832,444],[922,460],[1014,390],[1118,410],[1260,520],[1376,657]],
        [[178,716],[352,676],[489,668],[616,602],[751,610],[875,524],[1002,525],[1118,484],[1247,550],[1368,666]],
        [[329,711],[508,692],[676,646],[848,650],[1007,601],[1154,584],[1290,628],[1388,684]],
        [[245,651],[356,596],[449,621],[573,486],[647,534],[763,350],[830,411],[940,239],[988,301],[1067,205],[1126,276],[1229,451],[1335,624]]
      ];
      contours.forEach((line, index) => strokePolyline(
        terrainContext,
        line,
        index === 3 ? "rgba(185,187,180,.08)" : "rgba(185,187,180,.14)",
        1 / scale
      ));

      const facets = [
        [[360,574],[382,621],[508,692]], [[566,456],[641,537],[676,646]],
        [[760,322],[832,444],[848,650]], [[932,208],[1014,390],[1007,601]],
        [[1064,174],[1118,410],[1154,584]], [[566,456],[760,322],[646,506]],
        [[760,322],[932,208],[824,382]], [[932,208],[1064,174],[985,270]],
        [[1064,174],[1218,426],[1110,245]]
      ];
      facets.forEach((line) => strokePolyline(terrainContext, line, "rgba(120,231,114,.10)", 1 / scale));

      terrainContext.save();
      terrainContext.strokeStyle = "rgba(120,231,114,.40)";
      terrainContext.lineWidth = 1 / scale;
      terrainContext.setLineDash([3 / scale, 7 / scale]);
      terrainContext.beginPath();
      terrainContext.moveTo(527,496);
      terrainContext.bezierCurveTo(570,468,626,430,678,401);
      terrainContext.bezierCurveTo(728,357,735,342,760,322);
      terrainContext.bezierCurveTo(816,314,892,232,932,208);
      terrainContext.bezierCurveTo(982,207,1025,190,1064,174);
      terrainContext.stroke();
      terrainContext.restore();

      terrainContext.save();
      pathFromPoints(terrainContext, face, true);
      terrainContext.clip();
      terrainContext.font = "13px 'Cascadia Mono', Consolas, monospace";
      terrainContext.fillStyle = "rgba(185,187,180,.18)";
      [
        [306,654,"...  /\\  .::  //  +  ...  ::"],
        [430,596,"//  ::::  /\\  ..  ++  / /  ::"],
        [548,538,"+  /\\  ::  ^  //  .  frontier"],
        [642,470,"/ /  ...  ^^  :::  /\\  +  +"],
        [735,408,"::  /\\  //  ..  ^^^  .:"],
        [814,338,"//  ^  /\\  +  signal"],
        [900,286,".::  /\\  ^^  +"],
        [1000,246,"/\\  ^  ."],
        [1048,210,"^"]
      ].forEach(([x, y, text], index) => {
        terrainContext.fillStyle = index === 2 || index === 5
          ? "rgba(120,231,114,.23)"
          : "rgba(185,187,180,.18)";
        terrainContext.fillText(text, x, y);
      });
      terrainContext.font = "800 148px 'Segoe UI', Arial, sans-serif";
      terrainContext.fillStyle = "rgba(120,231,114,.035)";
      terrainContext.fillText("A I T A", 742, 650);
      terrainContext.restore();

      terrainContext.font = "10px 'Cascadia Mono', Consolas, monospace";
      terrainContext.fillStyle = "rgba(185,187,180,.30)";
      terrainContext.fillText("BASE CAMP / 01", 452, 446);
      terrainContext.fillText("RIDGE / 02", 738, 298);
      terrainContext.fillStyle = "rgba(120,231,114,.62)";
      terrainContext.fillText("RESEARCH FRONTIER", 1081, 164);

      drawClimber(terrainContext, 571, 449, -.12, 1);
      drawClimber(terrainContext, 786, 331, .08, 1);
      drawClimber(terrainContext, 1021, 224, -.07, 1);

      terrainContext.fillStyle = "rgba(120,231,114,.16)";
      terrainContext.beginPath(); terrainContext.arc(1064,174,13,0,Math.PI*2); terrainContext.fill();
      terrainContext.fillStyle = "rgba(120,231,114,.95)";
      terrainContext.beginPath(); terrainContext.arc(1064,174,2.8,0,Math.PI*2); terrainContext.fill();
      terrainContext.restore();

      terrainContext.save();
      terrainContext.globalCompositeOperation = "destination-in";
      const fade = terrainContext.createLinearGradient(width * .08, 0, width * .62, 0);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(.42, "rgba(0,0,0,.20)");
      fade.addColorStop(1, "rgba(0,0,0,1)");
      terrainContext.fillStyle = fade;
      terrainContext.fillRect(0, 0, width, height);
      terrainContext.restore();
    };

    const drawTrackedWord = (target, fontSize) => {
      const letters = [..."AITA"];
      const tracking = fontSize * .075;
      target.font = `800 ${fontSize}px "Arial Black", "Segoe UI", Arial, sans-serif`;
      target.textAlign = "center";
      target.textBaseline = "middle";
      const widths = letters.map((letter) => target.measureText(letter).width);
      const total = widths.reduce((sum, value) => sum + value, 0) + tracking * (letters.length - 1);
      let cursor = centerX - total / 2;
      letters.forEach((letter, index) => {
        target.fillText(letter, cursor + widths[index] / 2, centerY);
        cursor += widths[index] + tracking;
      });
    };

    const buildParticles = () => {
      const compact = width < 700;
      centerX = width * (compact ? .50 : .66);
      centerY = height * (compact ? .27 : .34);
      const fontSize = compact
        ? Math.min(width * .265, height * .16, 112)
        : Math.min(width * .19, height * .265, 250);
      const offscreen = doc.createElement("canvas");
      offscreen.width = width;
      offscreen.height = height;
      const offscreenContext = offscreen.getContext("2d", { willReadFrequently: true });
      if (!offscreenContext) return;
      offscreenContext.fillStyle = "#fff";
      drawTrackedWord(offscreenContext, fontSize);
      const pixels = offscreenContext.getImageData(0, 0, width, height).data;
      const step = compact ? 4 : width < 1120 ? 5 : 6;
      const points = [];
      const minX = Math.max(0, Math.floor(centerX - fontSize * 1.85));
      const maxX = Math.min(width, Math.ceil(centerX + fontSize * 1.85));
      const minY = Math.max(0, Math.floor(centerY - fontSize * .65));
      const maxY = Math.min(height, Math.ceil(centerY + fontSize * .65));
      for (let y = minY; y < maxY; y += step) {
        for (let x = minX; x < maxX; x += step) {
          if (pixels[(y * width + x) * 4 + 3] > 92) points.push([x, y]);
        }
      }
      const random = randomFactory((width * 73856093) ^ (height * 19349663) ^ 0xA17A);
      for (let index = points.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [points[index], points[swap]] = [points[swap], points[index]];
      }
      const spread = Math.min(width, height) * (compact ? .42 : .52);
      particles = points.slice(0, compact ? 520 : 1180).map(([homeX, homeY], index) => {
        const cloudAngle = random() * Math.PI * 2;
        const cloudRadius = (.08 + Math.pow(random(), .65) * .92) * spread;
        const bias = .22 + random() * .34;
        return {
          homeX, homeY,
          startX: centerX + Math.cos(cloudAngle) * cloudRadius + (homeX - centerX) * bias,
          startY: centerY + Math.sin(cloudAngle) * cloudRadius * .54 + (homeY - centerY) * bias,
          angle: Math.atan2(homeY - centerY, homeX - centerX),
          drift: 44 + random() * (compact ? 90 : 164),
          phase: random() * Math.PI * 2,
          size: .72 + random() * 1.22,
          accent: random() < .115 || index % 37 === 0,
          delay: random() * .055,
          previousX: homeX,
          previousY: homeY
        };
      });
    };

    const resizeHero = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildTerrain();
      buildParticles();
    };

    const drawTerrain = (alpha = 1, offsetY = 0, blur = 0) => {
      if (!terrainContext) return;
      context.save();
      context.globalAlpha = alpha;
      context.filter = blur > .2 ? `blur(${blur}px)` : "none";
      context.drawImage(terrainCanvas, 0, offsetY, width, height);
      context.restore();
    };

    const drawCalibration = (progress) => {
      const visibility = progress < .49
        ? clamp(progress / .18, 0, 1)
        : clamp(1 - (progress - .49) / .22, 0, 1);
      if (visibility <= 0) return;
      context.save();
      context.globalAlpha = visibility * .28;
      context.strokeStyle = "rgba(185,187,180,.32)";
      context.fillStyle = "rgba(185,187,180,.42)";
      context.lineWidth = 1;
      const halfWidth = Math.min(width * .27, 430);
      const halfHeight = Math.min(height * .13, 128);
      context.beginPath();
      context.moveTo(centerX - halfWidth, centerY - halfHeight);
      context.lineTo(centerX - halfWidth + 28, centerY - halfHeight);
      context.moveTo(centerX - halfWidth, centerY - halfHeight);
      context.lineTo(centerX - halfWidth, centerY - halfHeight + 18);
      context.moveTo(centerX + halfWidth, centerY + halfHeight);
      context.lineTo(centerX + halfWidth - 28, centerY + halfHeight);
      context.moveTo(centerX + halfWidth, centerY + halfHeight);
      context.lineTo(centerX + halfWidth, centerY + halfHeight - 18);
      context.stroke();
      context.restore();
    };

    const finishIntro = () => {
      if (introComplete) return;
      introComplete = true;
      cancelAnimationFrame(frame);
      canvas.style.zIndex = "1";
      context.clearRect(0, 0, width, height);
      drawTerrain(.94);
      hero.dataset.heroAscent = "settled";
    };

    const drawIntro = (timestamp) => {
      if (introComplete) return;
      if (!startTime) startTime = timestamp;
      const progress = clamp((timestamp - startTime) / duration, 0, 1);
      context.clearRect(0, 0, width, height);

      const mountainAmount = smoothstep((progress - .36) / .57);
      drawTerrain(.94 * mountainAmount, (1 - mountainAmount) * 30, (1 - mountainAmount) * 7);

      const veilAmount = progress < .48 ? .96 : .96 * (1 - smoothstep((progress - .48) / .47));
      if (veilAmount > .01) {
        context.fillStyle = `rgba(14,14,14,${veilAmount})`;
        context.fillRect(0, 0, width, height);
      }
      drawCalibration(progress);

      context.save();
      context.globalCompositeOperation = "lighter";
      particles.forEach((particle) => {
        const local = clamp((progress - particle.delay) / (1 - particle.delay), 0, 1);
        let x;
        let y;
        let alpha;
        let size;
        let streak = 0;
        if (local < .23) {
          const amount = easeOutCubic(local / .23);
          x = particle.startX + (particle.homeX - particle.startX) * amount;
          y = particle.startY + (particle.homeY - particle.startY) * amount;
          alpha = .10 + amount * .82;
          size = particle.size * (.64 + amount * .42);
        } else if (local < .49) {
          const amount = (local - .23) / .26;
          const shimmer = Math.sin(amount * Math.PI * 3 + particle.phase) * .58 * (1 - amount);
          x = particle.homeX + Math.cos(particle.phase) * shimmer;
          y = particle.homeY + Math.sin(particle.phase * 1.31) * shimmer;
          alpha = .82 + Math.sin(amount * Math.PI + particle.phase) * .10;
          size = particle.size * (1.08 + Math.sin(particle.phase + amount * 5) * .08);
        } else {
          const raw = (local - .49) / .51;
          const amount = easeInCubic(raw);
          const scale = 1 + amount * 2.32;
          const turbulence = Math.sin(particle.phase + amount * 8) * particle.drift * amount * .13;
          x = centerX + (particle.homeX - centerX) * scale + Math.cos(particle.angle) * particle.drift * amount + turbulence;
          y = centerY + (particle.homeY - centerY) * scale + Math.sin(particle.angle) * particle.drift * amount * .64 + turbulence * .24;
          alpha = Math.pow(1 - smoothstep(raw), 1.34) * .96;
          size = particle.size * (1.05 + amount * .72);
          streak = amount * 11;
        }
        if (alpha <= .015 || x < -60 || x > width + 60 || y < -60 || y > height + 60) return;
        const color = particle.accent ? "120,231,114" : "234,237,230";
        context.fillStyle = `rgba(${color},${alpha})`;
        if (streak > 1.2) {
          const dx = x - particle.previousX;
          const dy = y - particle.previousY;
          const distance = Math.hypot(dx, dy) || 1;
          context.strokeStyle = `rgba(${color},${alpha * .28})`;
          context.lineWidth = Math.max(.5, size * .52);
          context.beginPath();
          context.moveTo(x - dx / distance * streak, y - dy / distance * streak);
          context.lineTo(x, y);
          context.stroke();
        }
        context.fillRect(x, y, size, size);
        particle.previousX = x;
        particle.previousY = y;
      });
      context.restore();

      if (progress >= 1) finishIntro();
      else frame = requestAnimationFrame(drawIntro);
    };

    const queueHeroResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeHero();
        if (introComplete) {
          context.clearRect(0, 0, width, height);
          drawTerrain(.94);
        }
      });
    };

    resizeHero();
    window.addEventListener("resize", queueHeroResize, { passive: true });
    if (shouldRunIntro) {
      rememberIntro();
      hero.dataset.heroAscent = "intro";
      frame = requestAnimationFrame(drawIntro);
      window.setTimeout(finishIntro, duration + 900);
    } else {
      finishIntro();
    }

    doc.addEventListener("visibilitychange", () => {
      if (introComplete) return;
      if (doc.hidden) {
        pausedAt = performance.now();
        cancelAnimationFrame(frame);
      } else {
        if (pausedAt) startTime += performance.now() - pausedAt;
        pausedAt = 0;
        frame = requestAnimationFrame(drawIntro);
      }
    });
  };

  try {
    initHeroAscent();
  } catch {
    // The decorative scene must never block the static site.
  }

  const header = doc.querySelector("[data-header]");
  const updateScrollUI = () => {
    const y = window.scrollY || doc.documentElement.scrollTop;
    header?.classList.toggle("is-scrolled", y > 16);
  };
  updateScrollUI();
  window.addEventListener("scroll", updateScrollUI, { passive: true });
  window.addEventListener("resize", updateScrollUI, { passive: true });

  const menuButton = doc.querySelector("[data-menu-toggle]");
  const mobileMenu = doc.querySelector("[data-mobile-menu]");
  const setMenu = (open) => {
    if (!menuButton || !mobileMenu) return;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.querySelector(".sr-only")?.replaceChildren(open ? "关闭导航菜单" : "打开导航菜单");
    mobileMenu.hidden = !open;
    mobileMenu.setAttribute("aria-hidden", String(!open));
    body.classList.toggle("menu-open", open);
  };
  menuButton?.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
  mobileMenu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });

  const revealItems = [...doc.querySelectorAll(".reveal")];
  if (!reduceMotion) revealItems.forEach((item) => item.classList.add("is-pending"));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: .08 });
    revealItems.forEach((item) => observer.observe(item));
  }

  const filterButtons = [...doc.querySelectorAll("[data-filter]")];
  const projectCards = [...doc.querySelectorAll("[data-project-grid] .project-card")];
  const projectCount = doc.querySelector("[data-project-count]");
  filterButtons.forEach((button) => button.addEventListener("click", () => {
    const filter = button.dataset.filter || "all";
    filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    let visible = 0;
    projectCards.forEach((card) => {
      const hidden = filter !== "all" && !(card.dataset.category || "").split(/\s+/).includes(filter);
      card.hidden = hidden;
      if (!hidden) visible += 1;
    });
    if (projectCount) projectCount.textContent = `${String(visible).padStart(2, "0")} SHOWN`;
  }));

  const lightbox = doc.querySelector("[data-lightbox-dialog]");
  const lightboxImage = lightbox?.querySelector("img");
  const lightboxCaption = lightbox?.querySelector("figcaption");
  const closeLightbox = () => lightbox?.open && lightbox.close();
  doc.querySelectorAll("[data-lightbox]").forEach((button) => button.addEventListener("click", () => {
    if (!lightbox || !lightboxImage || !lightboxCaption) return;
    lightboxImage.src = button.dataset.lightbox || "";
    lightboxImage.alt = button.dataset.caption || "活动图片";
    lightboxCaption.textContent = button.dataset.caption || "";
    typeof lightbox.showModal === "function" ? lightbox.showModal() : lightbox.setAttribute("open", "");
  }));
  doc.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  const demoDialog = doc.querySelector("[data-demo-dialog]");
  doc.querySelector("[data-demo-notice]")?.addEventListener("click", () => {
    if (!demoDialog) return;
    typeof demoDialog.showModal === "function" ? demoDialog.showModal() : demoDialog.setAttribute("open", "");
  });
  doc.querySelectorAll("[data-demo-close]").forEach((button) => button.addEventListener("click", () => {
    if (!demoDialog) return;
    typeof demoDialog.close === "function" ? demoDialog.close() : demoDialog.removeAttribute("open");
  }));
  demoDialog?.addEventListener("click", (event) => {
    if (event.target === demoDialog && typeof demoDialog.close === "function") demoDialog.close();
  });

  const trackedSections = ["about", "research", "outputs", "network"]
    .map((id) => doc.getElementById(id))
    .filter(Boolean);
  if ("IntersectionObserver" in window && trackedSections.length) {
    const navObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      doc.querySelectorAll(".primary-nav a").forEach((link) => {
        const active = link.getAttribute("href") === `#${visible.target.id}`;
        active ? link.setAttribute("aria-current", "location") : link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-20% 0px -65%", threshold: [.05, .2, .5] });
    trackedSections.forEach((section) => navObserver.observe(section));
  }

  const researchCanvas = doc.getElementById("research-field");
  if (researchCanvas instanceof HTMLCanvasElement) {
    const rctx = researchCanvas.getContext("2d", { alpha: true });
    let rw = 1;
    let rh = 1;
    let rdpr = 1;
    let rframe = 0;
    let points = [];
    let visible = true;
    const makePoints = () => {
      const count = Math.max(160, Math.min(520, Math.round((rw * rh) / 3200)));
      points = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * 2 - 1,
        y: Math.random() * 1.5 - .75,
        z: Math.random() * 1.05 + .02,
        size: Math.random() * 1.25 + .45,
        band: index % 7
      }));
    };
    const resizeResearch = () => {
      const rect = researchCanvas.getBoundingClientRect();
      rw = Math.max(1, rect.width);
      rh = Math.max(1, rect.height);
      rdpr = Math.min(window.devicePixelRatio || 1, 2);
      researchCanvas.width = Math.round(rw * rdpr);
      researchCanvas.height = Math.round(rh * rdpr);
      rctx?.setTransform(rdpr, 0, 0, rdpr, 0, 0);
      makePoints();
    };
    const drawResearch = (time = 0) => {
      if (!rctx || !visible) return;
      rctx.clearRect(0, 0, rw, rh);
      const centerX = rw * .74;
      const centerY = rh * .58;
      const spread = Math.min(rw, rh) * 1.05;
      const speed = reduceMotion ? 0 : .000055;
      rctx.save();
      rctx.globalCompositeOperation = "lighter";
      points.forEach((point) => {
        const z = reduceMotion ? point.z : ((point.z - time * speed) % 1.05 + 1.05) % 1.05 + .015;
        const perspective = .12 + z * z;
        const curve = Math.sin(point.y * 2.8 + point.x * 1.6) * .12;
        const x = centerX + point.x * spread * perspective;
        const y = centerY + (point.y + curve * z) * spread * perspective * .58;
        if (x < -20 || x > rw + 20 || y < -20 || y > rh + 20) return;
        const alpha = Math.min(.8, .05 + z * .52);
        const radius = point.size * (.35 + z * 1.25);
        const color = point.band < 5 ? "120,231,114" : "224,228,220";
        rctx.fillStyle = `rgba(${color},${alpha})`;
        rctx.fillRect(x, y, radius, radius);
      });
      rctx.restore();
      rctx.strokeStyle = "rgba(190,196,188,.07)";
      rctx.lineWidth = 1;
      for (let index = 0; index < 5; index += 1) {
        rctx.beginPath();
        const y = centerY + index * 42;
        rctx.moveTo(rw * .44, y);
        rctx.quadraticCurveTo(rw * .74, y + index * 16, rw * 1.04, y - 20 + index * 28);
        rctx.stroke();
      }
      if (!reduceMotion) rframe = requestAnimationFrame(drawResearch);
    };
    resizeResearch();
    if (reduceMotion) drawResearch();
    else if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        cancelAnimationFrame(rframe);
        if (visible) rframe = requestAnimationFrame(drawResearch);
      }, { rootMargin: "120px" }).observe(researchCanvas);
    } else {
      rframe = requestAnimationFrame(drawResearch);
    }
    window.addEventListener("resize", resizeResearch, { passive: true });
    doc.addEventListener("visibilitychange", () => {
      cancelAnimationFrame(rframe);
      if (!doc.hidden && visible && !reduceMotion) rframe = requestAnimationFrame(drawResearch);
    });
  }

  const dotsCanvas = doc.getElementById("footer-dots");
  if (dotsCanvas instanceof HTMLCanvasElement) {
    const dctx = dotsCanvas.getContext("2d");
    const text = "走向无限智能";
    let width = 1;
    let height = 1;
    let dots = [];
    let frame = 0;
    let visible = false;
    let pointerX = -9999;
    let pointerY = -9999;
    const buildDots = () => {
      const rect = dotsCanvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dotsCanvas.width = width * dpr;
      dotsCanvas.height = height * dpr;
      dctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      const offscreen = doc.createElement("canvas");
      offscreen.width = width;
      offscreen.height = height;
      const offscreenContext = offscreen.getContext("2d", { willReadFrequently: true });
      if (!offscreenContext) return;
      const fontSize = Math.min(height * .58, width / text.length * 1.08);
      offscreenContext.font = `600 ${fontSize}px "Geist", "Inter", "PingFang SC", "Microsoft YaHei", sans-serif`;
      offscreenContext.textAlign = "center";
      offscreenContext.textBaseline = "middle";
      offscreenContext.fillStyle = "#fff";
      offscreenContext.fillText(text, width / 2, height / 2 + fontSize * .04);
      const pixels = offscreenContext.getImageData(0, 0, width, height).data;
      dots = [];
      const gap = width < 620 ? 5 : 6;
      for (let y = 0; y < height; y += gap) {
        for (let x = 0; x < width; x += gap) {
          if (pixels[(y * width + x) * 4 + 3] > 110) dots.push({ homeX: x, homeY: y, x, y, vx: 0, vy: 0, green: Math.random() < .13 });
        }
      }
      for (let index = 0; index < Math.round(width / 16); index += 1) {
        dots.push({ homeX: Math.random() * width, homeY: Math.random() * height, ambient: true });
      }
    };
    const drawDots = () => {
      if (!dctx) return;
      dctx.clearRect(0, 0, width, height);
      dots.forEach((dot) => {
        if (dot.ambient) {
          dctx.fillStyle = "rgba(190,196,188,.16)";
          dctx.fillRect(dot.homeX, dot.homeY, 2, 2);
          return;
        }
        const dx = dot.x - pointerX;
        const dy = dot.y - pointerY;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < 8100) {
          const distance = Math.sqrt(distanceSquared) || 1;
          const force = (90 - distance) / 90 * 3.2;
          dot.vx += dx / distance * force;
          dot.vy += dy / distance * force;
        }
        dot.vx += (dot.homeX - dot.x) * .045;
        dot.vy += (dot.homeY - dot.y) * .045;
        dot.vx *= .86;
        dot.vy *= .86;
        dot.x += dot.vx;
        dot.y += dot.vy;
        dctx.fillStyle = dot.green ? "rgba(120,231,114,.92)" : "rgba(228,232,224,.6)";
        dctx.fillRect(dot.x, dot.y, 2, 2);
      });
      if (!reduceMotion && visible) frame = requestAnimationFrame(drawDots);
    };
    const startDots = () => {
      cancelAnimationFrame(frame);
      if (reduceMotion) drawDots();
      else if (visible) frame = requestAnimationFrame(drawDots);
    };
    buildDots();
    if (reduceMotion) drawDots();
    else if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        startDots();
      }, { rootMargin: "80px" }).observe(dotsCanvas);
    } else {
      visible = true;
      startDots();
    }
    dotsCanvas.addEventListener("pointermove", (event) => {
      const rect = dotsCanvas.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
    });
    dotsCanvas.addEventListener("pointerleave", () => {
      pointerX = -9999;
      pointerY = -9999;
    });
    window.addEventListener("resize", () => { buildDots(); startDots(); }, { passive: true });
    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) cancelAnimationFrame(frame);
      else startDots();
    });
  }
})();
