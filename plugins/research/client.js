import { createResearchGalaxy } from "./galaxy.js";
export function mount(root) {
  const doc = document;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Research field: layered galaxy behind the existing inward passage and particle type.
  const canvas = root.querySelector("#research-field");
  if (canvas instanceof HTMLCanvasElement) {
    const context = canvas.getContext("2d", { alpha: true });
    const galaxy = createResearchGalaxy();
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
}
