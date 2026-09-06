import { prepareEffect } from "../../packages/kernel/effects.js";
export function mount(root) {
  const doc = document;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
prepareEffect(root.querySelector("[data-output-cloud-frame]"), "aita:output-cloud");
  // Deterministic folded particle surface for the intellectual-property panel.
  const ipCanvas = root.querySelector("#ip-particle-field");
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
}
