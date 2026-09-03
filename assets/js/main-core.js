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
  doc.querySelectorAll(".mobile-menu a, .header-cta").forEach((link) => link.addEventListener("click", () => setMenu(false)));
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

  // Preload the Outputs WebGL artwork, then pause it whenever the section is offscreen.
  const outputCloudFrame = doc.querySelector("[data-output-cloud-frame]");
  let outputCloudVisible = false;
  const setOutputCloudActive = () => {
    outputCloudFrame?.contentWindow?.postMessage({
      type: "aita:output-cloud-active",
      active: outputCloudVisible
    }, "*");
  };
  const loadOutputCloud = () => {
    if (!(outputCloudFrame instanceof HTMLIFrameElement) || outputCloudFrame.hasAttribute("src")) return;
    const source = outputCloudFrame.dataset.src;
    if (!source) return;
    const revealOutputCloud = (event) => {
      if (event.source !== outputCloudFrame.contentWindow || event.data !== "aita:output-cloud-ready") return;
      outputCloudFrame.classList.add("is-loaded");
      setOutputCloudActive();
      window.removeEventListener("message", revealOutputCloud);
    };
    window.addEventListener("message", revealOutputCloud);
    outputCloudFrame.src = source;
  };
  if (outputCloudFrame instanceof HTMLIFrameElement && !reduceMotion) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadOutputCloud, { timeout: 900 });
    } else {
      window.setTimeout(loadOutputCloud, 200);
    }
    if ("IntersectionObserver" in window) {
      const outputCloudObserver = new IntersectionObserver(([entry], observer) => {
        outputCloudVisible = entry.isIntersecting;
        if (outputCloudVisible) loadOutputCloud();
        if (outputCloudFrame.hasAttribute("src")) setOutputCloudActive();
      }, { rootMargin: "25% 0px", threshold: 0 });
      outputCloudObserver.observe(outputCloudFrame);
    } else {
      loadOutputCloud();
    }
  }

  // Load the self-contained About WebGL field only near its panel and pause it offscreen.
  const aboutFieldFrame = doc.querySelector("[data-about-field-frame]");
  let aboutFieldVisible = false;
  const setAboutFieldActive = () => {
    aboutFieldFrame?.contentWindow?.postMessage({
      type: "aita:about-field-active",
      active: aboutFieldVisible
    }, "*");
  };
  const loadAboutField = () => {
    if (!(aboutFieldFrame instanceof HTMLIFrameElement) || aboutFieldFrame.hasAttribute("src")) return;
    const source = aboutFieldFrame.dataset.src;
    if (!source) return;
    const revealAboutField = (event) => {
      if (event.source !== aboutFieldFrame.contentWindow || event.data !== "aita:about-field-ready") return;
      aboutFieldFrame.classList.add("is-loaded");
      setAboutFieldActive();
      window.removeEventListener("message", revealAboutField);
    };
    window.addEventListener("message", revealAboutField);
    aboutFieldFrame.src = source;
  };
  if (aboutFieldFrame instanceof HTMLIFrameElement && !reduceMotion) {
    if ("IntersectionObserver" in window) {
      const aboutFieldObserver = new IntersectionObserver(([entry]) => {
        aboutFieldVisible = entry.isIntersecting;
        if (aboutFieldVisible) loadAboutField();
        if (aboutFieldFrame.hasAttribute("src")) setAboutFieldActive();
      }, { rootMargin: "30% 0px", threshold: 0 });
      aboutFieldObserver.observe(aboutFieldFrame);
    } else {
      aboutFieldVisible = true;
      loadAboutField();
    }
  }

  // Keep the four-phase SVG loop paused outside the viewport and in background tabs.
  const aboutLoop = doc.querySelector(".about-system");
  if (aboutLoop && "IntersectionObserver" in window) {
    let aboutLoopVisible = false;
    const syncAboutLoop = () => {
      aboutLoop.classList.toggle("is-loop-active", aboutLoopVisible && !doc.hidden);
    };
    const aboutLoopObserver = new IntersectionObserver(([entry]) => {
      aboutLoopVisible = entry.isIntersecting;
      syncAboutLoop();
    });
    aboutLoopObserver.observe(aboutLoop);
    doc.addEventListener("visibilitychange", syncAboutLoop);
  }

  // Competition archive stream. Reuse the complete source records while omitting contributors.
  const awardStream = doc.querySelector("[data-award-stream]");
  if (awardStream) {
    const viewport = awardStream.querySelector("[data-award-stream-viewport]");
    const toggle = awardStream.querySelector("[data-award-stream-toggle]");
    const count = awardStream.querySelector("[data-award-stream-count]");
    const records = [...doc.querySelectorAll(".award-records li")].map((item) => {
      const levelNode = item.lastElementChild;
      return {
        index: item.firstElementChild?.textContent.trim() || "",
        title: item.querySelector("strong")?.textContent.trim() || "",
        level: levelNode?.tagName === "B" ? levelNode.textContent.trim() : ""
      };
    }).filter((record) => record.index && record.title && record.level);

    const getAwardTier = ({ title, level }) => {
      if (/国一|国二|国三|国赛/.test(level)) return "red";
      if (/省一|省二|省三|省奖|省级/.test(level)) return "purple";
      if (/校一|校二|校三|校级/.test(level)) return "blue";
      if (/院一|院二|院三|院级/.test(level)) return "green";
      if (/省赛|广东赛区|广东分赛|广东选拔赛|广东省|华南赛区|赛区/.test(title)) return "purple";
      if (/校际|校区|广东工业大学/.test(title)) return "blue";
      if (/国赛|全国|全球|世界/.test(title)) return "red";
      return "green";
    };
    const tierKeys = ["green", "blue", "purple", "red"];
    const streamCount = 6;
    const laneBuckets = Array.from({ length: streamCount }, () => (
      Object.fromEntries(tierKeys.map((tier) => [tier, []]))
    ));
    const tierPositions = Object.fromEntries(tierKeys.map((tier) => [tier, 0]));
    records.forEach((record) => {
      const tier = getAwardTier(record);
      const laneIndex = (tierKeys.indexOf(tier) + tierPositions[tier]) % laneBuckets.length;
      tierPositions[tier] += 1;
      laneBuckets[laneIndex][tier].push({ ...record, tier });
    });
    const lanes = laneBuckets.map((bucket, laneIndex) => {
      const tierStart = laneIndex % tierKeys.length;
      const tierOrder = [...tierKeys.slice(tierStart), ...tierKeys.slice(0, tierStart)];
      const mixedRecords = [];
      while (tierOrder.some((tier) => bucket[tier].length)) {
        tierOrder.forEach((tier) => {
          if (bucket[tier].length) mixedRecords.push(bucket[tier].shift());
        });
      }
      return mixedRecords;
    });

    const createToken = (record, tier) => {
      const token = doc.createElement("span");
      token.className = `award-code-token award-code-token--${tier}`;
      const title = doc.createElement("span");
      const level = doc.createElement("em");
      title.textContent = record.title;
      level.textContent = record.level;
      token.append(title, level);
      return token;
    };

    if (viewport && records.length) {
      const fragment = doc.createDocumentFragment();
      lanes.forEach((sourceRecords, laneIndex) => {
        if (!sourceRecords.length) return;
        const visualRecords = [...sourceRecords];

        const lane = doc.createElement("div");
        lane.className = "award-code-lane";
        const laneWindow = doc.createElement("div");
        laneWindow.className = "award-code-window";
        const track = doc.createElement("div");
        track.className = "award-code-track";
        const characterCount = visualRecords.reduce((total, record) => (
          total + record.title.length + record.level.length + 10
        ), 0);
        const duration = Math.max(90, Math.min(190, characterCount * .22));
        track.style.setProperty("--award-stream-duration", `${Math.round(duration)}s`);
        track.style.setProperty("--award-stream-delay", `${Math.round(-duration * laneIndex * .19)}s`);

        const createSequence = () => {
          const sequence = doc.createElement("div");
          sequence.className = "award-code-sequence";
          visualRecords.forEach((record) => sequence.append(createToken(record, record.tier)));
          return sequence;
        };
        track.append(createSequence());
        if (!reduceMotion) track.append(createSequence());
        laneWindow.append(track);
        lane.append(laneWindow);
        fragment.append(lane);
      });
      viewport.replaceChildren(fragment);
      if (count) count.textContent = String(records.length).padStart(2, "0");

      if (toggle && !reduceMotion) {
        toggle.hidden = false;
        toggle.addEventListener("click", () => {
          const paused = awardStream.classList.toggle("is-paused");
          toggle.setAttribute("aria-pressed", String(paused));
          toggle.textContent = paused ? "RESUME FLOW" : "PAUSE FLOW";
        });
      }
      if ("IntersectionObserver" in window && !reduceMotion) {
        const awardStreamObserver = new IntersectionObserver(([entry]) => {
          awardStream.classList.toggle("is-offscreen", !entry.isIntersecting);
        }, { rootMargin: "20% 0px", threshold: 0 });
        awardStreamObserver.observe(awardStream);
      }
    }
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

  // Research field: layered galaxy behind the existing inward passage and particle type.
  const canvas = doc.getElementById("research-field");
  if (canvas instanceof HTMLCanvasElement) {
    const context = canvas.getContext("2d", { alpha: true });
    const galaxy = window.createAitaResearchGalaxy?.();
    const keywordBuffer = doc.createElement("canvas");
    const keywordContext = keywordBuffer.getContext("2d", { willReadFrequently: true });
    const keywords = [
      "FOUNDATION MODELS",
      "DATA",
      "PERCEPTION",
      "SIMULATION",
      "PLANNING",
      "GENERATION",
      "EVOLUTION"
    ];
    const cycleDuration = 30000;
    const keywordStart = 2400;
    const keywordSpacing = 3200;
    const keywordLife = 4400;
    const fieldFrameInterval = 1000 / 30;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let animationFrame = 0;
    let points = [];
    let keywordMaps = [];
    let travel = 0;
    let galaxyTime = 0;
    let lastTime = 0;
    let nextFieldDraw = 0;
    let animationStart = 0;
    let fieldVisible = false;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const smoothstep = (start, end, value) => {
      const t = clamp((value - start) / (end - start), 0, 1);
      return t * t * (3 - 2 * t);
    };
    const fieldHash = (x, y, seed = 0) => {
      const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
      return value - Math.floor(value);
    };

    const makePoints = () => {
      const count = Math.max(320, Math.min(1000, Math.round((width * height) / 1500)));
      points = Array.from({ length: count }, (_, index) => {
        const x = fieldHash(index, 1, 3) * 2 - 1;
        const y = fieldHash(index, 2, 5) * 1.5 - 0.75;
        const layer = index % 3;
        return {
          x,
          y,
          z: fieldHash(index, 3, 7) * 1.05 + 0.02,
          size: fieldHash(index, 4, 11) * 1.35 + 0.55,
          color: index % 13 === 0 ? "#8fa9b4" : "#e0e4dc",
          layerDepth: 0.92 + layer * 0.065,
          layerOffset: (layer - 1) * 0.018,
          curve: Math.sin(y * 2.8 + x * 1.6 + layer * 0.72)
            * (0.11 + layer * 0.018) - x * (0.145 + layer * 0.012)
        };
      });
    };

    const makeKeywordMaps = () => {
      if (!keywordContext) return;
      const fontSize = 72;
      const fontFamily = '"ABC Favorit Mono", "Geist Mono", "Cascadia Mono", Consolas, monospace';
      const font = `650 ${fontSize}px ${fontFamily}`;
      const narrow = width < 720;
      const normalScale = narrow ? 1 : 1.65;
      const maxTargetWidth = narrow ? width * 0.84 : Math.min(width * 0.54, 1300);
      const minTargetWidth = narrow ? Math.min(200, width * 0.56) : 440;

      keywordMaps = keywords.map((label, keywordIndex) => {
        keywordContext.font = font;
        const textWidth = Math.ceil(keywordContext.measureText(label).width);
        const targetWidth = clamp(textWidth * normalScale, minTargetWidth, maxTargetWidth);
        // Short words such as DATA are enlarged more. Resample their glyphs
        // at that extra scale so particle spacing does not grow with the word.
        const samplingScale = Math.max(1, targetWidth / textWidth / normalScale);
        keywordBuffer.width = Math.ceil((textWidth + 36) * samplingScale);
        keywordBuffer.height = Math.ceil(116 * samplingScale);
        keywordContext.clearRect(0, 0, keywordBuffer.width, keywordBuffer.height);
        keywordContext.font = `650 ${fontSize * samplingScale}px ${fontFamily}`;
        keywordContext.textAlign = "center";
        keywordContext.textBaseline = "middle";
        keywordContext.fillStyle = "#ffffff";
        keywordContext.fillText(label, keywordBuffer.width / 2, keywordBuffer.height / 2);

        const pixels = keywordContext.getImageData(0, 0, keywordBuffer.width, keywordBuffer.height).data;
        const sampleStep = textWidth > 580 ? 3 : 2;
        const mapPoints = [];
        for (let y = 0; y < keywordBuffer.height; y += sampleStep) {
          for (let x = 0; x < keywordBuffer.width; x += sampleStep) {
            const alpha = pixels[((y * keywordBuffer.width) + x) * 4 + 3];
            if (alpha < 96 || fieldHash(x, y, keywordIndex + 17) < 0.035) continue;
            const seed = fieldHash(x, y, keywordIndex + 29);
            const directionX = Math.cos(seed * Math.PI * 2);
            const directionY = Math.sin(seed * Math.PI * 2);
            mapPoints.push({
              x: (x - (keywordBuffer.width / 2)) / samplingScale,
              y: (y - (keywordBuffer.height / 2)) / samplingScale,
              seed,
              scatterX: directionX * (0.35 + seed * 0.65),
              scatterY: directionY * (0.35 + seed * 0.65),
              debrisX: directionX * (0.42 + seed * 0.85),
              debrisY: directionY * (0.42 + seed * 0.85)
            });
          }
        }

        return { label, width: textWidth, targetWidth, points: mapPoints };
      });
    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      // Match the galaxy's pixel budget without changing CSS size or particle counts.
      dpr = Math.min(window.devicePixelRatio || 1, 1.75, Math.sqrt(2200000 / (width * height)));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
      makePoints();
      makeKeywordMaps();
    };

    const drawField = (time = 0) => {
      if (!context) return;
      if (!reduceMotion && time > 0) {
        if (!fieldVisible || doc.hidden) return;
        if (time < nextFieldDraw) {
          animationFrame = requestAnimationFrame(drawField);
          return;
        }
        // Carry the remainder so high-refresh screens average 30 draws/s.
        nextFieldDraw = time + fieldFrameInterval - ((time - nextFieldDraw) % fieldFrameInterval);
      }
      context.clearRect(0, 0, width, height);
      const narrow = width < 720;
      if (!animationStart && time) animationStart = time;
      const elapsed = animationStart ? Math.max(0, time - animationStart) : 0;
      const cycle = reduceMotion ? keywordStart + (keywordLife * 0.42) : elapsed % cycleDuration;
      const warpIn = smoothstep(1200, 2200, cycle);
      const warpOut = 1 - smoothstep(26400, 28700, cycle);
      const warp = warpIn * warpOut;
      const centerX = width * (narrow ? 0.56 : 0.76);
      const centerY = height * (narrow ? 0.72 : 0.54);
      const spread = Math.min(width, height) * 1.05;
      const delta = lastTime ? Math.min(48, Math.max(0, time - lastTime)) : 16;
      lastTime = time;
      if (!reduceMotion) {
        travel += delta * (0.000055 + warp * 0.00015);
        galaxyTime += delta;
      }

      const lift = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width * 0.34, height * 0.72));
      lift.addColorStop(0, `rgba(143, 169, 180, ${0.025 + warp * 0.035})`);
      lift.addColorStop(0.44, "rgba(71, 83, 88, .014)");
      lift.addColorStop(1, "rgba(14, 14, 14, 0)");
      context.fillStyle = lift;
      context.fillRect(0, 0, width, height);

      context.save();
      context.globalCompositeOperation = "lighter";
      points.forEach((point) => {
        const z = reduceMotion ? point.z : ((point.z - travel) % 1.05 + 1.05) % 1.05 + 0.015;
        const perspective = 0.12 + z * z;
        const px = centerX + point.x * spread * perspective * point.layerDepth;
        const py = centerY + (point.y + point.curve * z + point.layerOffset) * spread * perspective * 0.58;
        if (px < -20 || px > width + 20 || py < -20 || py > height + 20) return;

        const alpha = Math.min(0.9, 0.08 + z * 0.61 + warp * z * 0.12);
        const radius = point.size * (0.42 + z * 1.3);
        context.fillStyle = point.color;
        context.strokeStyle = point.color;

        if (!reduceMotion && warp > 0.02) {
          const radialX = px - centerX;
          const radialY = py - centerY;
          const radialLength = Math.max(1, Math.hypot(radialX, radialY));
          const trailLength = warp * (2 + z * 18) * point.size;
          const parallelCount = narrow ? 2 : 3;
          const directionX = radialX / radialLength;
          const directionY = radialY / radialLength;
          const trailAlpha = alpha * (0.1 + warp * 0.22);
          // Both outer trails share a stroke; the brighter center stays separate.
          for (let pass = 0; pass < 2; pass += 1) {
            context.beginPath();
            for (let trailLayer = pass; trailLayer < parallelCount; trailLayer += 2) {
              const offset = (trailLayer - (parallelCount - 1) / 2) * (0.7 + z * 1.35);
              const lengthScale = 0.76 + trailLayer * 0.2;
              context.moveTo(
                px + directionX * trailLength * lengthScale - directionY * offset,
                py + directionY * trailLength * lengthScale + directionX * offset
              );
              context.lineTo(px - directionY * offset * 0.28, py + directionX * offset * 0.28);
            }
            context.globalAlpha = trailAlpha * (pass === 1 ? 1 : 0.64);
            context.lineWidth = Math.max(0.42, radius * (pass === 1 ? 0.38 : 0.25));
            context.stroke();
          }
        }

        context.globalAlpha = alpha;
        context.fillRect(px, py, radius, radius);
      });
      context.restore();

      const keywordStates = keywordMaps.map((map, index) => {
        const local = (cycle - (keywordStart + index * keywordSpacing)) / keywordLife;
        const visibility = local >= 0 && local <= 1
          ? smoothstep(0, 0.34, local) * (1 - smoothstep(0.56, 1, local))
          : 0;
        return { map, index, local, visibility };
      }).filter((state) => state.visibility > 0.002);
      const activePulse = keywordStates.reduce((peak, state) => Math.max(peak, state.visibility), 0);

      // Composite below the unchanged inflow; keep particle words in front.
      context.save();
      context.globalCompositeOperation = "destination-over";
      galaxy?.draw(context, width, height, dpr, galaxyTime, centerX, centerY, activePulse);
      context.restore();

      // Each concept assembles in depth, holds briefly, then dissolves back into the field.
      context.save();
      context.globalCompositeOperation = "lighter";
      const verticalOffsets = [-0.055, 0.055, -0.025, 0.075, -0.065, 0.035, 0];
      keywordStates.forEach(({ map, index, local, visibility }) => {
        const approach = smoothstep(0, 0.38, local);
        const finalScale = map.targetWidth / map.width;
        const scale = finalScale * (0.32 + approach * 0.82);
        const assembleScatter = (1 - smoothstep(0, 0.34, local)) * (narrow ? 13 : 21);
        const dissolveScatter = smoothstep(0.54, 1, local) * (narrow ? 70 : 128);
        const scatter = assembleScatter + dissolveScatter;
        const wordCenterX = centerX - (narrow ? width * 0.055 : width * 0.068);
        const wordCenterY = centerY + height * verticalOffsets[index] * (narrow ? 0.55 : 1);
        const depthOffset = narrow ? 0.55 : 1;

        map.points.forEach((point) => {
          const jitterX = point.scatterX * scatter;
          const jitterY = point.scatterY * scatter;
          const farScale = scale * (0.73 + point.seed * 0.035);
          const deepScale = scale * (0.83 + point.seed * 0.025);
          const echoScale = scale * (0.905 + point.seed * 0.014);
          const midScale = scale * (0.955 + point.seed * 0.018);
          const farX = wordCenterX + point.x * farScale + jitterX * 0.30 - 12 * depthOffset;
          const farY = wordCenterY + point.y * farScale + jitterY * 0.30 + 13 * depthOffset;
          const deepX = wordCenterX + point.x * deepScale + jitterX * 0.42 - 7 * depthOffset;
          const deepY = wordCenterY + point.y * deepScale + jitterY * 0.42 + 8 * depthOffset;
          const echoX = wordCenterX + point.x * echoScale + jitterX * 0.55 - 3 * depthOffset;
          const echoY = wordCenterY + point.y * echoScale + jitterY * 0.55 + 4 * depthOffset;
          const midX = wordCenterX + point.x * midScale + jitterX * 0.78 - 0.6;
          const midY = wordCenterY + point.y * midScale + jitterY * 0.78 + 0.9;
          const coreX = wordCenterX + point.x * scale + jitterX;
          const coreY = wordCenterY + point.y * scale + jitterY;
          const size = (0.86 + point.seed * 1.08) * clamp(scale + 0.42, 0.7, 1.35);

          // Five depth samples, with incomplete back layers and independent
          // bright grains so the volume stays broken up rather than solid.
          // Keep colors constant: numeric alpha avoids allocating and parsing
          // thousands of new CSS color strings on every animation frame.
          if (point.seed < 0.64) {
            context.fillStyle = point.seed < 0.10
              ? "#afdbeb" : "#3f6f8f";
            context.globalAlpha = visibility * (point.seed < 0.10 ? 0.48 : 0.13 + point.seed * 0.16);
            context.fillRect(farX, farY, Math.max(0.55, size * 0.66), Math.max(0.55, size * 0.66));
          }
          if (point.seed > 0.22) {
            context.fillStyle = "#5c97b5";
            context.globalAlpha = visibility * (0.18 + point.seed * 0.13);
            context.fillRect(deepX, deepY, Math.max(0.55, size * 0.74), Math.max(0.55, size * 0.74));
          }
          context.fillStyle = "#518191";
          context.globalAlpha = visibility * 0.22;
          context.fillRect(echoX - 1.2, echoY, Math.max(0.5, size * 0.72), Math.max(0.5, size * 0.72));
          const midGlint = point.seed > 0.12 && point.seed < 0.28;
          context.fillStyle = midGlint ? "#c4e3ed" : "#6a97a4";
          context.globalAlpha = visibility * (midGlint ? 0.60 : 0.22 + point.seed * 0.12);
          context.fillRect(midX, midY, Math.max(0.55, size * 0.88), Math.max(0.55, size * 0.88));
          const glint = point.seed > 0.74;
          const lifted = point.seed > 0.50 && point.seed < 0.70;
          const shimmer = glint ? 0.5 + Math.sin(time * 0.00065 + point.seed * 53.4) * 0.5 : 0;
          const coreSize = glint ? size * (1.10 + shimmer * 0.16) : size;
          context.fillStyle = glint
            ? (point.seed > 0.90 ? "#f6faf2" : "#c8e9f5") : "#e0e4dc";
          context.globalAlpha = visibility * (glint ? 0.85 + shimmer * 0.15
            : lifted ? 0.65 + point.seed * 0.20 : 0.48 + point.seed * 0.32);
          context.fillRect(coreX, coreY, coreSize, coreSize);

          if (point.seed > 0.74 && dissolveScatter > 1) {
            context.fillStyle = "#8fa9b4";
            context.globalAlpha = visibility * 0.28;
            context.fillRect(
              coreX + point.debrisX * dissolveScatter,
              coreY + point.debrisY * dissolveScatter,
              Math.max(0.5, size * 0.62),
              Math.max(0.5, size * 0.62)
            );
          }
        });
      });
      context.restore();

      if (!reduceMotion && fieldVisible && !doc.hidden) animationFrame = requestAnimationFrame(drawField);
    };

    resizeCanvas();
    drawField();
    if (!reduceMotion) {
      if ("IntersectionObserver" in window) {
        const fieldObserver = new IntersectionObserver(([entry]) => {
          fieldVisible = entry.isIntersecting;
          cancelAnimationFrame(animationFrame);
          if (!fieldVisible || doc.hidden) return;
          animationStart = 0;
          lastTime = 0;
          nextFieldDraw = 0;
          travel = 0;
          animationFrame = requestAnimationFrame(drawField);
        }, { rootMargin: "10% 0px", threshold: 0.08 });
        fieldObserver.observe(canvas);
      } else {
        fieldVisible = true;
        animationFrame = requestAnimationFrame(drawField);
      }
    }
    window.addEventListener("resize", () => {
      resizeCanvas();
      if (reduceMotion) drawField();
    }, { passive: true });
    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) {
        cancelAnimationFrame(animationFrame);
      } else if (!reduceMotion && fieldVisible) {
        animationStart = 0;
        lastTime = 0;
        nextFieldDraw = 0;
        travel = 0;
        animationFrame = requestAnimationFrame(drawField);
      }
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
    let joinVisible = false;

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
      if (!reduceMotion && time > 0 && (!joinVisible || doc.hidden)) return;
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

      if (!reduceMotion && joinVisible && !doc.hidden) joinAnimationFrame = requestAnimationFrame(drawJoinField);
    };

    resizeJoinCanvas();
    drawJoinField();
    window.addEventListener("resize", resizeJoinCanvas, { passive: true });
    const syncJoinAnimation = () => {
      cancelAnimationFrame(joinAnimationFrame);
      if (!reduceMotion && joinVisible && !doc.hidden) {
        joinLastDraw = 0;
        joinAnimationFrame = requestAnimationFrame(drawJoinField);
      }
    };
    if (!reduceMotion) {
      if ("IntersectionObserver" in window) {
        const joinObserver = new IntersectionObserver(([entry]) => {
          joinVisible = entry.isIntersecting;
          syncJoinAnimation();
        });
        joinObserver.observe(joinCanvas);
      } else {
        joinVisible = true;
        syncJoinAnimation();
      }
    }
    doc.addEventListener("visibilitychange", syncJoinAnimation);
  }

})();
