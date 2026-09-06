
export function mount(root) {
  const doc = document;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Purple perspective matrix with visible RGB separation and a cyan energy beam.
  const joinCanvas = root.querySelector("#join-particle-field");
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
}
