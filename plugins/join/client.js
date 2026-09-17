
export function mount(root) {
  const doc = document;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Purple perspective matrix with visible RGB separation and a cyan energy beam.
  const joinCanvas = root.querySelector("#join-particle-field");
  if (joinCanvas instanceof HTMLCanvasElement) {
    const joinContext = joinCanvas.getContext("2d", { alpha: true }); let joinWidth = 1; let joinHeight = 1;
    let joinDpr = 1; let joinAnimationFrame = 0; let joinLastDraw = 0; let joinVisible = false;
    let joinField = null;

    const joinHash = (x, y, seed) => {
      const value = Math.sin(x * 127.1 + y * 311.7 + seed * 71.9) * 43758.5453;
      return value - Math.floor(value);
    };

    const resizeJoinCanvas = () => {
      const rect = joinCanvas.getBoundingClientRect(); joinWidth = Math.max(1, rect.width);
      joinHeight = Math.max(1, rect.height); joinDpr = Math.min(window.devicePixelRatio || 1, 2);
      joinCanvas.width = Math.round(joinWidth * joinDpr);
      joinCanvas.height = Math.round(joinHeight * joinDpr);
      joinContext?.setTransform(joinDpr, 0, 0, joinDpr, 0, 0);
      joinField = null; if (reduceMotion) drawJoinField(0);
    };

    // Everything about a lattice cell except its drift is fixed once the canvas
    // has a size, so the rectangles — colour strings included — are collected here
    // and a frame only advances the drift. The colours stay as rgba() strings
    // rather than a numeric globalAlpha: the two take different rounding paths
    // through the compositor, and the string builds the identical picture.
    const buildJoinField = () => {
      const columns = Math.max(36, Math.min(96, Math.round(joinWidth / 19.5)));
      const rows = Math.max(15, Math.min(26, Math.round(joinHeight / 20)));
      const backColumns = Math.max(58, Math.min(148, Math.round(joinWidth / 12)));
      const backRows = Math.max(22, Math.min(40, Math.round(joinHeight / 13)));
      // A cell is [x, y, drift phase halves, drift rate, drift amplitude, row, cull slack].
      const cells = [];
      // Rects must reach the canvas in their original order: the composite rounds
      // to 8 bits after every additive step, so reordering overlapping rects
      // changes the last bit of some pixels.
      const ops = [];
      const addCell = (x, y, phaseU, phaseV, rate, amplitude, row, slack) => {
        cells.push([x, y, phaseU, phaseV, rate, amplitude, row, slack]); return cells.length - 1;
      };
      const rect = (color, index, dx, dy, width, height, glitchX = dx, glitchY = dy, glitchColor = color) => {
        ops.push([index, dx, dy, width, height, color, glitchX, glitchY, glitchColor]);
      };

      // A smaller interleaved lattice closes the gaps without flattening the foreground grid.
      for (let row = 0; row < backRows; row += 1) {
        const v = (row + 0.42) / backRows; const depth = v ** 1.72;
        for (let column = 0; column < backColumns; column += 1) {
          if (joinHash(column, row, 61) < 0.035) continue; const u = (column + 0.5) / backColumns;
          const cyanBeam = Math.exp(-((u - 0.57) ** 2) / 0.0032);
          const beamA = Math.exp(-((u - 0.67) ** 2) / 0.004);
          const beamB = Math.exp(-((u - 0.855) ** 2) / 0.0048);
          const energy = Math.min(1, Math.max(cyanBeam * 0.9, beamA * 0.78 + beamB)); const x = joinWidth * (
            0.012 + u * 0.976
            + (u - 0.5) * depth * 0.14
            + (cyanBeam * 0.07 + beamA * 0.078 + beamB * 0.064) * depth
            + Math.sin(u * 9.2 + v * 2.8) * depth * 0.005
          );
          const index = addCell(x, joinHeight * (0.025 + v * 0.93), u * 8.8, v * 5.1, 0.00044, 0.32, -1, 12);

          const noise = joinHash(column, row, 67); const particleWidth = 0.46 + depth * 0.66 + energy * 0.34;
          const particleHeight = 0.9 + depth * 1.75 + energy * 1.35;
          const alpha = 0.08 + depth * 0.2 + energy * 0.22 + noise * 0.035;
          if (cyanBeam > 0.18) rect(`rgba(23, 205, 231, ${alpha * 0.9})`, index, 0, 0, particleWidth, particleHeight);
          else rect(`rgba(115, 49, 214, ${alpha})`, index, 0, 0, particleWidth, particleHeight);
          if (noise > 0.76 || cyanBeam > 0.28) {
            rect(`rgba(33, 221, 244, ${alpha * 0.52})`, index, 0.85, -0.28, Math.max(0.42, particleWidth * 0.66), particleHeight * 0.74);
          }
          if (noise > 0.93) {
            rect(`rgba(230, 43, 255, ${alpha * 0.48})`, index, -0.9, 0.3, Math.max(0.4, particleWidth * 0.62), particleHeight * 0.7);
          }
        }
      }

      for (let row = 0; row < rows; row += 1) {
        const v = row / (rows - 1); const depth = v ** 1.7;
        for (let column = 0; column < columns; column += 1) {
          if (joinHash(column, row, 3) < 0.055) continue; const u = column / (columns - 1);
          const beamA = Math.exp(-((u - 0.67) ** 2) / 0.0034);
          const beamB = Math.exp(-((u - 0.855) ** 2) / 0.0042);
          const cyanBeam = Math.exp(-((u - 0.57) ** 2) / 0.0028);
          const purpleEnergy = Math.min(1, beamA * 0.84 + beamB);
          const energy = Math.max(purpleEnergy, cyanBeam * 0.94);
          const perspective = (u - 0.5) * depth * 0.14;
          const fieldBend = (cyanBeam * 0.074 + beamA * 0.082 + beamB * 0.067) * depth;
          const wave = Math.sin(u * 8.5 + v * 2.4) * depth * 0.006;
          const x = joinWidth * (0.018 + u * 0.964 + perspective + fieldBend + wave);
          const index = addCell(x, joinHeight * (0.03 + v * 0.925), u * 10.5, v * 4.2, 0.00052, 0.45, row, 16);

          const noise = joinHash(column, row, 11); const particleWidth = 0.84 + depth * 1.22 + energy * 0.82;
          const particleHeight = 1.7 + depth * 4.15 + energy * 3.6;
          const alpha = Math.min(0.98, 0.19 + depth * 0.46 + energy * 0.4 + noise * 0.09);
          const splitBurst = joinHash(column, row, 23) > 0.88;
          // A glitching row widens the split and lifts the torn channels apart.
          const channel = 1.25 + depth * 1.65 + energy * 0.72 + (splitBurst ? 2.8 : 0);
          const split = splitBurst ? 1.15 : 0.4;
          const cyanDominant = cyanBeam > 0.18;

          rect(`rgba(245, 42, 255, ${alpha * (splitBurst ? 0.72 : 0.46)})`, index, -channel, split, particleWidth, particleHeight * 0.88,
            -(channel + 4.2), 1.15, `rgba(245, 42, 255, ${alpha * 0.72})`);
          if (cyanDominant) rect(`rgba(27, 225, 247, ${alpha * 0.96})`, index, 0, 0, particleWidth, particleHeight);
          else rect(`rgba(158, 54, 255, ${alpha})`, index, 0, 0, particleWidth, particleHeight);
          rect(`rgba(30, 229, 248, ${alpha * (cyanDominant ? 0.82 : splitBurst ? 0.74 : energy > 0.14 || noise > 0.82 ? 0.62 : 0.42)})`,
            index, channel, -split, Math.max(0.64, particleWidth * 0.76), particleHeight * 0.84, channel + 4.2, -1.15);
          if (energy > 0.32 && noise > 0.46) {
            rect(cyanDominant ? `rgba(194, 255, 255, ${alpha * 0.5})` : `rgba(205, 174, 255, ${alpha * 0.38})`,
              index, 0.2, 0, Math.max(0.5, particleWidth * 0.45), particleHeight * 0.58);
          }
        }
      }

      // Float64, not Float32: rounding a sub-pixel position to single precision is
      // enough to move the antialiased edge of a rectangle by one level.
      joinField = { cells, ops, rows, positionX: new Float64Array(cells.length), positionY: new Float64Array(cells.length), live: new Uint8Array(cells.length), rowShift: new Float64Array(rows), rowGlitch: new Uint8Array(rows) };
    };

    const drawJoinField = (time = 0) => {
      if (!joinContext) return; if (!reduceMotion && time > 0 && (!joinVisible || doc.hidden)) return;
      if (!reduceMotion && joinLastDraw && time - joinLastDraw < 32) {
        joinAnimationFrame = requestAnimationFrame(drawJoinField); return;
      }
      joinLastDraw = time; joinContext.clearRect(0, 0, joinWidth, joinHeight);
      if (!joinField) buildJoinField();

      const { cells, ops, rows, positionX, positionY, live, rowShift, rowGlitch } = joinField;
      const glitchPhase = Math.floor(time / 96);
      const glitchTime = !reduceMotion && time % 4600 > 3590 && time % 4600 < 3810;
      for (let row = 0; row < rows; row += 1) {
        const on = glitchTime && joinHash(row, glitchPhase, 29) > 0.68;
        rowGlitch[row] = on ? 1 : 0;
        rowShift[row] = on ? (joinHash(row, glitchPhase, 31) - 0.5) * Math.min(28, joinWidth * 0.025) : 0;
      }
      for (let index = 0; index < cells.length; index += 1) {
        const cell = cells[index]; const row = cell[6];
        const x = cell[0] + (row < 0 ? 0 : rowShift[row]); const slack = cell[7];
        positionX[index] = x; live[index] = x < -slack || x > joinWidth + slack ? 0 : 1;
        positionY[index] = cell[1] + (reduceMotion ? 0 : Math.sin(time * cell[4] + cell[2] + cell[3]) * cell[5]);
      }

      joinContext.save(); joinContext.globalCompositeOperation = "lighter";
      for (const op of ops) {
        const index = op[0];
        if (!live[index]) continue; const row = cells[index][6]; const torn = row < 0 ? 0 : rowGlitch[row];
        joinContext.fillStyle = torn ? op[8] : op[5];
        joinContext.fillRect(positionX[index] + (torn ? op[6] : op[1]), positionY[index] + (torn ? op[7] : op[2]), op[3], op[4]);
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

    resizeJoinCanvas(); drawJoinField();
    window.addEventListener("resize", resizeJoinCanvas, { passive: true });
    const syncJoinAnimation = () => {
      cancelAnimationFrame(joinAnimationFrame);
      if (!reduceMotion && joinVisible && !doc.hidden) {
        joinLastDraw = 0; joinAnimationFrame = requestAnimationFrame(drawJoinField);
      }
    };
    if (!reduceMotion) {
      if ("IntersectionObserver" in window) {
        const joinObserver = new IntersectionObserver(([entry]) => {
          joinVisible = entry.isIntersecting; syncJoinAnimation();
        }); joinObserver.observe(joinCanvas);
      } else {
        joinVisible = true; syncJoinAnimation();
      }
    }
    doc.addEventListener("visibilitychange", syncJoinAnimation);
  }
}
