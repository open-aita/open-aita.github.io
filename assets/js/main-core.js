(() => {
  "use strict";

  const doc = document;
  const body = doc.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Header state.
  const header = doc.querySelector("[data-header]");
  const updateScrollUI = () => {
    const y = window.scrollY || doc.documentElement.scrollTop;
    header?.classList.toggle("is-scrolled", y > 16);
  };
  updateScrollUI();
  window.addEventListener("scroll", updateScrollUI, { passive: true });
  window.addEventListener("resize", updateScrollUI, { passive: true });

  // Mobile navigation.
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
  menuButton?.addEventListener("click", () => {
    setMenu(menuButton.getAttribute("aria-expanded") !== "true");
  });
  mobileMenu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });

  // Progressive reveal. Content remains readable without JavaScript.
  const revealItems = [...doc.querySelectorAll(".reveal")];
  if (!reduceMotion) revealItems.forEach((item) => item.classList.add("is-pending"));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  // Project filtering.
  const filterButtons = [...doc.querySelectorAll("[data-filter]")];
  const projectCards = [...doc.querySelectorAll("[data-project-grid] .project-card")];
  const projectCount = doc.querySelector("[data-project-count]");
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter || "all";
      filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      let visibleCount = 0;
      projectCards.forEach((card) => {
        const categories = (card.dataset.category || "").split(/\s+/);
        const hidden = filter !== "all" && !categories.includes(filter);
        card.hidden = hidden;
        if (!hidden) visibleCount += 1;
      });
      if (projectCount) projectCount.textContent = `${String(visibleCount).padStart(2, "0")} SHOWN`;
    });
  });

  // Accessible image lightbox.
  const lightbox = doc.querySelector("[data-lightbox-dialog]");
  const lightboxImage = lightbox?.querySelector("img");
  const lightboxCaption = lightbox?.querySelector("figcaption");
  const closeLightbox = () => lightbox?.open && lightbox.close();
  doc.querySelectorAll("[data-lightbox]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!lightbox || !lightboxImage || !lightboxCaption) return;
      lightboxImage.src = button.dataset.lightbox || "";
      lightboxImage.alt = button.dataset.caption || "活动图片";
      lightboxCaption.textContent = button.dataset.caption || "";
      if (typeof lightbox.showModal === "function") lightbox.showModal();
      else lightbox.setAttribute("open", "");
    });
  });
  doc.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  // Demo notice keeps unsupported contact details explicit instead of inventing them.
  const demoDialog = doc.querySelector("[data-demo-dialog]");
  doc.querySelector("[data-demo-notice]")?.addEventListener("click", () => {
    if (!demoDialog) return;
    if (typeof demoDialog.showModal === "function") demoDialog.showModal();
    else demoDialog.setAttribute("open", "");
  });
  doc.querySelectorAll("[data-demo-close]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!demoDialog) return;
      if (typeof demoDialog.close === "function") demoDialog.close();
      else demoDialog.removeAttribute("open");
    });
  });
  demoDialog?.addEventListener("click", (event) => {
    if (event.target === demoDialog) demoDialog.close();
  });

  // Section-aware navigation.
  const trackedSections = ["about", "research", "outputs", "network"]
    .map((id) => doc.getElementById(id))
    .filter(Boolean);
  if ("IntersectionObserver" in window && trackedSections.length) {
    const navObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      doc.querySelectorAll(".primary-nav a").forEach((link) => {
        const active = link.getAttribute("href") === `#${visible.target.id}`;
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-20% 0px -65%", threshold: [0.05, 0.2, 0.5] });
    trackedSections.forEach((section) => navObserver.observe(section));
  }

  // Lightweight 3D research field inspired by scientific visualization rather than a video asset.
  const canvas = doc.getElementById("research-field");
  if (canvas instanceof HTMLCanvasElement) {
    const context = canvas.getContext("2d", { alpha: true });
    let width = 1;
    let height = 1;
    let dpr = 1;
    let animationFrame = 0;
    let points = [];

    const makePoints = () => {
      const count = Math.max(220, Math.min(680, Math.round((width * height) / 2200)));
      points = Array.from({ length: count }, (_, index) => {
        const band = index % 13;
        return {
          x: Math.random() * 2 - 1,
          y: Math.random() * 1.5 - 0.75,
          z: Math.random() * 1.05 + 0.02,
          size: Math.random() * 1.35 + 0.55,
          band
        };
      });
    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
      makePoints();
    };

    const drawField = (time = 0) => {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      const centerX = width * 0.74;
      const centerY = height * 0.58;
      const spread = Math.min(width, height) * 1.05;
      const speed = reduceMotion ? 0 : 0.000055;

      context.save();
      context.globalCompositeOperation = "lighter";
      points.forEach((point) => {
        const z = reduceMotion ? point.z : ((point.z - time * speed) % 1.05 + 1.05) % 1.05 + 0.015;
        const perspective = 0.12 + z * z;
        const curve = Math.sin((point.y * 2.8) + (point.x * 1.6)) * 0.13 - point.x * 0.16;
        const px = centerX + point.x * spread * perspective;
        const py = centerY + (point.y + curve * z) * spread * perspective * 0.58;
        if (px < -20 || px > width + 20 || py < -20 || py > height + 20) return;

        const alpha = Math.min(0.88, 0.09 + z * 0.64);
        const radius = point.size * (0.42 + z * 1.3);
        const hue = point.band === 0 ? "143, 169, 180" : "224, 228, 220";
        context.fillStyle = `rgba(${hue}, ${alpha})`;
        context.fillRect(px, py, radius, radius);
      });
      context.restore();

      // One restrained research ridge makes the field readable as a system path.
      context.beginPath();
      context.moveTo(width * 0.43, height * 0.72);
      context.quadraticCurveTo(width * 0.72, height * 0.58, width * 1.03, height * 0.2);
      context.strokeStyle = "rgba(143, 169, 180, .18)";
      context.lineWidth = 1;
      context.stroke();

      // Technical horizon lines.
      context.strokeStyle = "rgba(190, 196, 188, .1)";
      context.lineWidth = 1;
      for (let i = 0; i < 5; i += 1) {
        context.beginPath();
        const y = centerY + i * 42;
        context.moveTo(width * 0.44, y);
        context.quadraticCurveTo(width * 0.74, y + i * 16, width * 1.04, y - 20 + i * 28);
        context.stroke();
      }

      if (!reduceMotion) animationFrame = requestAnimationFrame(drawField);
    };

    resizeCanvas();
    drawField();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) cancelAnimationFrame(animationFrame);
      else if (!reduceMotion) animationFrame = requestAnimationFrame(drawField);
    });
  }

  // Deterministic folded particle surface for the intellectual-property panel.
  const ipCanvas = doc.getElementById("ip-particle-field");
  if (ipCanvas instanceof HTMLCanvasElement) {
    const ipContext = ipCanvas.getContext("2d", { alpha: true });

    const hash = (x, y, seed = 0) => {
      const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
      return value - Math.floor(value);
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const surfaceHeight = (u, v) => {
      const spineA = Math.exp(-((u - (0.67 - Math.sin(v * 3.4) * 0.12)) ** 2) / 0.018)
        * (0.58 + Math.cos(v * 4.1) * 0.22);
      const spineB = Math.exp(-((u - (0.28 + v * 0.36)) ** 2) / 0.04)
        * (0.32 + Math.sin(v * 5.8) * 0.13);
      const folds = Math.sin(u * 13.2 + v * 5.1) * 0.13
        + Math.cos(u * 6.1 - v * 9.8) * 0.09;
      const notch = Math.exp(-((u - 0.5) ** 2) / 0.012 - ((v - 0.46) ** 2) / 0.075) * -0.27;
      return clamp(0.06 + spineA + spineB + folds + notch, -0.24, 1.2);
    };

    const drawIpField = () => {
      if (!ipContext) return;
      const rect = ipCanvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ipCanvas.width = Math.round(width * dpr);
      ipCanvas.height = Math.round(height * dpr);
      ipContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      ipContext.clearRect(0, 0, width, height);

      const project = (u, v, depth = 0) => {
        const elevation = surfaceHeight(clamp(u + depth * 0.035, 0, 1), v);
        return {
          elevation,
          x: width * (-0.13 + u * 1.17 + (v - 0.5) * 0.3 + depth * 0.018),
          y: height * (0.18 + v * 0.71 - elevation * 0.43 + depth * 0.016)
        };
      };

      ipContext.save();
      ipContext.globalCompositeOperation = "source-over";

      const drawParticle = (x, y, widthScale, heightScale, heat, alpha, spectrum) => {
        const redAlpha = alpha * (0.38 + spectrum * 0.16);
        const coreAlpha = alpha * (0.76 + heat * 0.2);
        const greenAlpha = alpha * (spectrum > 0.52 ? 0.22 + heat * 0.14 : 0.04);
        let core = [255, Math.round(66 + heat * 126), 5];
        if (spectrum < 0.28) core = [255, Math.round(34 + heat * 54), 4];
        else if (spectrum > 0.982) core = [34, 205, 184];
        else if (spectrum > 0.925) core = [112, 246, 44];
        else if (spectrum > 0.74) core = [255, Math.round(202 + heat * 42), 38];
        ipContext.fillStyle = `rgba(255, 38, 4, ${redAlpha})`;
        ipContext.fillRect(x - 0.92, y + 0.22, widthScale, heightScale);
        ipContext.fillStyle = `rgba(${core[0]}, ${core[1]}, ${core[2]}, ${coreAlpha})`;
        ipContext.fillRect(x, y, widthScale, heightScale);
        ipContext.fillStyle = `rgba(${Math.round(82 + heat * 92)}, 255, 24, ${greenAlpha})`;
        ipContext.fillRect(x + 0.96, y - 0.24, Math.max(0.58, widthScale * 0.66), heightScale * 0.74);
        if (spectrum > 0.9) {
          ipContext.fillStyle = `rgba(22, 184, 170, ${alpha * 0.2})`;
          ipContext.fillRect(x + 1.58, y - 0.42, Math.max(0.52, widthScale * 0.52), heightScale * 0.6);
        }
        if (heat > 0.7 && spectrum > 0.55) {
          ipContext.fillStyle = `rgba(255, 244, 118, ${alpha * 0.34})`;
          ipContext.fillRect(x + 0.18, y, Math.max(0.55, widthScale * 0.46), heightScale * 0.58);
        }
        const trailCount = spectrum > 0.94 ? 3 : spectrum > 0.78 ? 2 : spectrum > 0.64 ? 1 : 0;
        for (let trail = 1; trail <= trailCount; trail += 1) {
          const trailY = y + heightScale + trail * (1.8 + heightScale * 0.42);
          const trailAlpha = alpha * (0.22 / trail);
          ipContext.fillStyle = `rgba(${core[0]}, ${core[1]}, ${core[2]}, ${trailAlpha})`;
          ipContext.fillRect(x + (trail % 2 ? 0.35 : -0.28), trailY, Math.max(0.5, widthScale * 0.62), Math.max(1, heightScale * 0.54));
        }
      };

      const drawBlockParticle = (x, y, size, particleHeight, heat, alpha, spectrum, variant) => {
        drawParticle(x, y, size, particleHeight, heat, alpha, spectrum);
        if (variant > 0.28) {
          const offsetX = variant > 0.68 ? size * 1.45 : -size * 0.92;
          const offsetY = variant > 0.68 ? particleHeight * 0.18 : particleHeight * 0.72;
          drawParticle(
            x + offsetX,
            y + offsetY,
            Math.max(0.72, size * 0.72),
            Math.max(1.2, particleHeight * 0.58),
            heat,
            alpha * 0.72,
            hash(variant * 100, heat * 100, 83)
          );
        }
        if (variant > 0.84) {
          drawParticle(
            x - size * 0.35,
            y - particleHeight * 0.68,
            Math.max(0.66, size * 0.58),
            Math.max(1, particleHeight * 0.44),
            heat,
            alpha * 0.56,
            spectrum
          );
        }
      };

      // A near-continuous, low-contrast lattice supplies the dense particle volume.
      const backColumns = Math.max(132, Math.min(212, Math.round(width / 2.08)));
      const backRows = Math.max(92, Math.min(190, Math.round(height / 3.65)));
      for (let row = 0; row < backRows; row += 1) {
        const v = row / (backRows - 1);
        for (let column = 0; column < backColumns; column += 1) {
          const u = column / (backColumns - 1);
          const point = project(u, v, 0.7);
          const voidField = Math.exp(-((u - 0.24) ** 2) / 0.019 - ((v - 0.58) ** 2) / 0.05);
          const rightMass = clamp((u - 0.34) / 0.54, 0, 1);
          if (hash(column, row, 47) < 0.11 - rightMass * 0.075 + voidField * 0.76) continue;
          if (point.x < -12 || point.x > width + 12 || point.y < -18 || point.y > height + 20) continue;

          const heat = clamp((point.elevation + 0.2) / 1.16, 0, 1);
          const spectrum = hash(column, row, 53);
          const particleWidth = 0.72 + v * 0.44 + rightMass * 0.22;
          const particleHeight = 1.8 + v * 1.9 + heat * 1.25;
          const alpha = 0.1 + heat * 0.25 + rightMass * 0.15;
          const green = spectrum > 0.968;
          ipContext.fillStyle = green
            ? `rgba(86, 214, 40, ${alpha * 0.72})`
            : `rgba(216, ${Math.round(35 + heat * 74)}, 3, ${alpha})`;
          ipContext.fillRect(
            point.x + (hash(column, row, 59) - 0.5) * 1.25,
            point.y + (hash(column, row, 61) - 0.5) * 1.5,
            particleWidth,
            particleHeight
          );
        }
      }

      // A brighter second surface creates the folded mid-plane without adding lines or glow.
      const columns = Math.max(104, Math.min(158, Math.round(width / 2.82)));
      const rows = Math.max(78, Math.min(158, Math.round(height / 4.45)));
      for (let row = 0; row < rows; row += 1) {
        const v = row / (rows - 1);
        for (let column = 0; column < columns; column += 1) {
          const u = column / (columns - 1);
          const omission = hash(column, row, 3);
          const voidField = Math.exp(-((u - 0.24) ** 2) / 0.018 - ((v - 0.58) ** 2) / 0.045);
          const rightMass = clamp((u - 0.38) / 0.5, 0, 1);
          if (omission < 0.055 + v * 0.035 - rightMass * 0.025 + voidField * 0.72) continue;
          const point = project(u, v);
          if (point.x < -12 || point.x > width + 12 || point.y < -18 || point.y > height + 20) continue;

          const heat = clamp((point.elevation + 0.16) / 1.12, 0, 1);
          const shimmer = hash(column, row, 8);
          const jitterX = (hash(column, row, 11) - 0.5) * 1.7;
          const jitterY = (hash(column, row, 17) - 0.5) * 1.65;
          const size = 0.68 + v * 0.68 + (shimmer > 0.982 ? 0.92 : 0);
          const particleHeight = size * (1.82 + v * 1.55 + (shimmer > 0.96 ? 1.28 : 0));
          const alpha = (0.23 + heat * 0.69 + rightMass * 0.08) * (0.94 - v * 0.16) * (0.72 + shimmer * 0.28);
          drawParticle(point.x + jitterX, point.y + jitterY, size, particleHeight, heat, alpha, shimmer);
        }
      }

      // Larger clustered particles sit in front of the lattice and break up its uniform scale.
      const blockCount = Math.round(Math.min(1120, Math.max(420, width * height / 330)));
      for (let index = 0; index < blockCount; index += 1) {
        const u = hash(index, 2, 67);
        const v = hash(index, 5, 71);
        const point = project(u, v, -0.52);
        const voidField = Math.exp(-((u - 0.24) ** 2) / 0.018 - ((v - 0.58) ** 2) / 0.045);
        if (hash(index, 7, 73) < voidField * 0.82) continue;
        const heat = clamp((point.elevation + 0.12) / 1.08, 0, 1);
        const rightMass = clamp((u - 0.34) / 0.56, 0, 1);
        const sizeNoise = hash(index, 11, 79);
        const size = 1.05 + sizeNoise * 1.28 + rightMass * 0.34;
        const particleHeight = size * (1.38 + hash(index, 13, 81) * 1.35);
        const alpha = 0.36 + heat * 0.51 + rightMass * 0.09;
        drawBlockParticle(
          point.x + (hash(index, 17, 89) - 0.5) * 4.2,
          point.y + (hash(index, 19, 97) - 0.5) * 4.8,
          size,
          particleHeight,
          heat,
          alpha,
          hash(index, 23, 101),
          hash(index, 29, 103)
        );
      }

      // Detached chromatic fragments dissolve the stacked surfaces into the black field.
      const scatterCount = Math.round(Math.min(420, Math.max(220, width * height / 980)));
      for (let index = 0; index < scatterCount; index += 1) {
        const u = hash(index, 2, 19);
        const v = hash(index, 5, 23);
        const point = project(u, v);
        const lift = (hash(index, 7, 29) - 0.64) * height * (0.07 + Math.max(0, point.elevation) * 0.12);
        const drift = (hash(index, 11, 31) - 0.5) * width * 0.13;
        const spectrum = hash(index, 19, 43);
        const alpha = 0.17 + hash(index, 13, 37) * 0.56;
        const size = hash(index, 17, 41) > 0.86 ? 1.7 : 0.8;
        drawParticle(point.x + drift, point.y + lift, size, size * (1.8 + spectrum * 1.8), clamp(point.elevation, 0, 1), alpha, spectrum);
      }

      ipContext.restore();
    };

    drawIpField();
    window.addEventListener("resize", drawIpField, { passive: true });
  }

  // Purple perspective matrix with visible RGB separation and a cyan energy beam.
  const joinCanvas = doc.getElementById("join-particle-field");
  if (joinCanvas instanceof HTMLCanvasElement) {
    const joinContext = joinCanvas.getContext("2d", { alpha: true });
    let joinWidth = 1;
    let joinHeight = 1;
    let joinDpr = 1;
    let joinAnimationFrame = 0;
    let joinLastDraw = 0;

    const joinHash = (x, y, seed = 0) => {
      const value = Math.sin(x * 127.1 + y * 311.7 + seed * 71.9) * 43758.5453;
      return value - Math.floor(value);
    };

    const resizeJoinCanvas = () => {
      const rect = joinCanvas.getBoundingClientRect();
      joinWidth = Math.max(1, rect.width);
      joinHeight = Math.max(1, rect.height);
      joinDpr = Math.min(window.devicePixelRatio || 1, 2);
      joinCanvas.width = Math.round(joinWidth * joinDpr);
      joinCanvas.height = Math.round(joinHeight * joinDpr);
      joinContext?.setTransform(joinDpr, 0, 0, joinDpr, 0, 0);
      if (reduceMotion) drawJoinField(0);
    };

    const drawJoinField = (time = 0) => {
      if (!joinContext) return;
      if (!reduceMotion && joinLastDraw && time - joinLastDraw < 32) {
        joinAnimationFrame = requestAnimationFrame(drawJoinField);
        return;
      }
      joinLastDraw = time;
      joinContext.clearRect(0, 0, joinWidth, joinHeight);

      const columns = Math.max(36, Math.min(96, Math.round(joinWidth / 19.5)));
      const rows = Math.max(15, Math.min(26, Math.round(joinHeight / 20)));
      const glitchPhase = Math.floor(time / 96);
      const glitchTime = !reduceMotion && time % 4600 > 3590 && time % 4600 < 3810;

      joinContext.save();
      joinContext.globalCompositeOperation = "lighter";

      // A smaller interleaved lattice closes the gaps without flattening the foreground grid.
      const backColumns = Math.max(58, Math.min(148, Math.round(joinWidth / 12)));
      const backRows = Math.max(22, Math.min(40, Math.round(joinHeight / 13)));
      for (let row = 0; row < backRows; row += 1) {
        const v = (row + 0.42) / backRows;
        const depth = v ** 1.72;
        for (let column = 0; column < backColumns; column += 1) {
          if (joinHash(column, row, 61) < 0.035) continue;
          const u = (column + 0.5) / backColumns;
          const cyanBeam = Math.exp(-((u - 0.57) ** 2) / 0.0032);
          const beamA = Math.exp(-((u - 0.67) ** 2) / 0.004);
          const beamB = Math.exp(-((u - 0.855) ** 2) / 0.0048);
          const energy = Math.min(1, Math.max(cyanBeam * 0.9, beamA * 0.78 + beamB));
          const x = joinWidth * (
            0.012 + u * 0.976
            + (u - 0.5) * depth * 0.14
            + (cyanBeam * 0.07 + beamA * 0.078 + beamB * 0.064) * depth
            + Math.sin(u * 9.2 + v * 2.8) * depth * 0.005
          );
          const drift = reduceMotion ? 0 : Math.sin(time * 0.00044 + u * 8.8 + v * 5.1) * 0.32;
          const y = joinHeight * (0.025 + v * 0.93) + drift;
          if (x < -12 || x > joinWidth + 12) continue;

          const noise = joinHash(column, row, 67);
          const particleWidth = 0.46 + depth * 0.66 + energy * 0.34;
          const particleHeight = 0.9 + depth * 1.75 + energy * 1.35;
          const alpha = 0.08 + depth * 0.2 + energy * 0.22 + noise * 0.035;
          joinContext.fillStyle = cyanBeam > 0.18
            ? `rgba(23, 205, 231, ${alpha * 0.9})`
            : `rgba(115, 49, 214, ${alpha})`;
          joinContext.fillRect(x, y, particleWidth, particleHeight);
          if (noise > 0.76 || cyanBeam > 0.28) {
            joinContext.fillStyle = `rgba(33, 221, 244, ${alpha * 0.52})`;
            joinContext.fillRect(x + 0.85, y - 0.28, Math.max(0.42, particleWidth * 0.66), particleHeight * 0.74);
          }
          if (noise > 0.93) {
            joinContext.fillStyle = `rgba(230, 43, 255, ${alpha * 0.48})`;
            joinContext.fillRect(x - 0.9, y + 0.3, Math.max(0.4, particleWidth * 0.62), particleHeight * 0.7);
          }
        }
      }

      for (let row = 0; row < rows; row += 1) {
        const v = row / (rows - 1);
        const depth = v ** 1.7;
        const rowGlitch = glitchTime && joinHash(row, glitchPhase, 29) > 0.68;
        const rowShift = rowGlitch ? (joinHash(row, glitchPhase, 31) - 0.5) * Math.min(28, joinWidth * 0.025) : 0;

        for (let column = 0; column < columns; column += 1) {
          if (joinHash(column, row, 3) < 0.055) continue;
          const u = column / (columns - 1);
          const beamA = Math.exp(-((u - 0.67) ** 2) / 0.0034);
          const beamB = Math.exp(-((u - 0.855) ** 2) / 0.0042);
          const cyanBeam = Math.exp(-((u - 0.57) ** 2) / 0.0028);
          const purpleEnergy = Math.min(1, beamA * 0.84 + beamB);
          const energy = Math.max(purpleEnergy, cyanBeam * 0.94);
          const perspective = (u - 0.5) * depth * 0.14;
          const fieldBend = (cyanBeam * 0.074 + beamA * 0.082 + beamB * 0.067) * depth;
          const wave = Math.sin(u * 8.5 + v * 2.4) * depth * 0.006;
          const drift = reduceMotion ? 0 : Math.sin(time * 0.00052 + u * 10.5 + v * 4.2) * 0.45;
          const x = joinWidth * (0.018 + u * 0.964 + perspective + fieldBend + wave) + rowShift;
          const y = joinHeight * (0.03 + v * 0.925) + drift;
          if (x < -16 || x > joinWidth + 16) continue;

          const noise = joinHash(column, row, 11);
          const particleWidth = 0.84 + depth * 1.22 + energy * 0.82;
          const particleHeight = 1.7 + depth * 4.15 + energy * 3.6;
          const alpha = Math.min(0.98, 0.19 + depth * 0.46 + energy * 0.4 + noise * 0.09);
          const splitBurst = joinHash(column, row, 23) > 0.88;
          const channelSplit = 1.25 + depth * 1.65 + energy * 0.72 + (splitBurst ? 2.8 : 0) + (rowGlitch ? 4.2 : 0);
          const verticalSplit = splitBurst || rowGlitch ? 1.15 : 0.4;
          const cyanDominant = cyanBeam > 0.18;

          joinContext.fillStyle = `rgba(245, 42, 255, ${alpha * (rowGlitch || splitBurst ? 0.72 : 0.46)})`;
          joinContext.fillRect(x - channelSplit, y + verticalSplit, particleWidth, particleHeight * 0.88);
          joinContext.fillStyle = cyanDominant
            ? `rgba(27, 225, 247, ${alpha * 0.96})`
            : `rgba(158, 54, 255, ${alpha})`;
          joinContext.fillRect(x, y, particleWidth, particleHeight);
          joinContext.fillStyle = `rgba(30, 229, 248, ${alpha * (cyanDominant ? 0.82 : splitBurst ? 0.74 : energy > 0.14 || noise > 0.82 ? 0.62 : 0.42)})`;
          joinContext.fillRect(x + channelSplit, y - verticalSplit, Math.max(0.64, particleWidth * 0.76), particleHeight * 0.84);

          if (energy > 0.32 && noise > 0.46) {
            joinContext.fillStyle = cyanDominant
              ? `rgba(194, 255, 255, ${alpha * 0.5})`
              : `rgba(205, 174, 255, ${alpha * 0.38})`;
            joinContext.fillRect(x + 0.2, y, Math.max(0.5, particleWidth * 0.45), particleHeight * 0.58);
          }
        }
      }

      if (glitchTime) {
        for (let fragment = 0; fragment < 13; fragment += 1) {
          const y = joinHash(fragment, glitchPhase, 41) * joinHeight;
          const x = joinHash(fragment, glitchPhase, 43) * joinWidth;
          const fragmentWidth = 10 + joinHash(fragment, glitchPhase, 47) * Math.min(92, joinWidth * 0.08);
          joinContext.fillStyle = fragment % 3 === 0
            ? "rgba(38, 229, 247, .2)"
            : "rgba(166, 80, 255, .18)";
          joinContext.fillRect(x, y, fragmentWidth, fragment % 4 === 0 ? 2 : 1);
        }
      }
      joinContext.restore();

      if (!reduceMotion) joinAnimationFrame = requestAnimationFrame(drawJoinField);
    };

    resizeJoinCanvas();
    drawJoinField();
    window.addEventListener("resize", resizeJoinCanvas, { passive: true });
    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) cancelAnimationFrame(joinAnimationFrame);
      else if (!reduceMotion) {
        joinLastDraw = 0;
        joinAnimationFrame = requestAnimationFrame(drawJoinField);
      }
    });
  }

  // Dot-matrix footer wordmark; particles spring home and scatter around the pointer.
  const dotsCanvas = doc.getElementById("footer-dots");
  if (dotsCanvas instanceof HTMLCanvasElement) {
    const dctx = dotsCanvas.getContext("2d");
    const DOT_TEXT = "走向无限智能";
    let dw = 1;
    let dh = 1;
    let dots = [];
    let dotsFrame = 0;
    let dotsVisible = false;
    let pointerX = -9999;
    let pointerY = -9999;

    const buildDots = () => {
      const rect = dotsCanvas.getBoundingClientRect();
      dw = Math.max(1, Math.round(rect.width));
      dh = Math.max(1, Math.round(rect.height));
      const ddpr = Math.min(window.devicePixelRatio || 1, 2);
      dotsCanvas.width = dw * ddpr;
      dotsCanvas.height = dh * ddpr;
      dctx?.setTransform(ddpr, 0, 0, ddpr, 0, 0);

      const off = doc.createElement("canvas");
      off.width = dw;
      off.height = dh;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      const fontSize = Math.min(dh * 0.58, (dw / DOT_TEXT.length) * 1.08);
      octx.font = `600 ${fontSize}px "Geist", "Inter", "PingFang SC", "Microsoft YaHei", sans-serif`;
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillStyle = "#ffffff";
      octx.fillText(DOT_TEXT, dw / 2, dh / 2 + fontSize * 0.04);
      const textWidth = octx.measureText(DOT_TEXT).width;
      const textStart = (dw - textWidth) / 2;
      const accentStart = textStart + textWidth / 3;
      const accentEnd = textStart + textWidth * 2 / 3;
      const pixels = octx.getImageData(0, 0, dw, dh).data;

      dots = [];
      const gap = dw < 620 ? 5 : 6;
      for (let y = 0; y < dh; y += gap) {
        for (let x = 0; x < dw; x += gap) {
          if (pixels[(y * dw + x) * 4 + 3] > 110) {
            const signature = (Math.round(x / gap) * 17) + (Math.round(y / gap) * 31);
            const accent = x >= accentStart && x < accentEnd && signature % 37 === 0;
            dots.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, accent });
          }
        }
      }
      const ambient = Math.round(dw / 16);
      for (let i = 0; i < ambient; i += 1) {
        dots.push({ hx: Math.random() * dw, hy: Math.random() * dh, x: 0, y: 0, vx: 0, vy: 0, ambient: true });
      }
    };

    const drawDots = () => {
      if (!dctx) return;
      dctx.clearRect(0, 0, dw, dh);
      dots.forEach((dot) => {
        if (dot.ambient) {
          dctx.fillStyle = "rgba(190, 196, 188, .16)";
          dctx.fillRect(dot.hx, dot.hy, 2, 2);
          return;
        }
        const dx = dot.x - pointerX;
        const dy = dot.y - pointerY;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < 8100) {
          const dist = Math.sqrt(dist2) || 1;
          const force = ((90 - dist) / 90) * 3.2;
          dot.vx += (dx / dist) * force;
          dot.vy += (dy / dist) * force;
        }
        dot.vx += (dot.hx - dot.x) * 0.045;
        dot.vy += (dot.hy - dot.y) * 0.045;
        dot.vx *= 0.86;
        dot.vy *= 0.86;
        dot.x += dot.vx;
        dot.y += dot.vy;
        dctx.fillStyle = dot.accent ? "rgba(154, 167, 184, .78)" : "rgba(228, 232, 224, .6)";
        dctx.fillRect(dot.x, dot.y, 2, 2);
      });
      if (!reduceMotion && dotsVisible) dotsFrame = requestAnimationFrame(drawDots);
    };

    const startDots = () => {
      cancelAnimationFrame(dotsFrame);
      if (reduceMotion) drawDots();
      else if (dotsVisible) dotsFrame = requestAnimationFrame(drawDots);
    };

    buildDots();
    if (reduceMotion) {
      drawDots();
    } else if ("IntersectionObserver" in window) {
      const dotsObserver = new IntersectionObserver((entries) => {
        dotsVisible = entries.some((entry) => entry.isIntersecting);
        startDots();
      }, { rootMargin: "80px" });
      dotsObserver.observe(dotsCanvas);
    } else {
      dotsVisible = true;
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
      if (doc.hidden) cancelAnimationFrame(dotsFrame);
      else startDots();
    });
  }
})();
