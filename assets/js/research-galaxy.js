/*
 * AITA Research — layered particle galaxy.
 * Adapted from the layered disk / differential-orbit approach in
 * https://github.com/ggwzrd/threejs-galaxy (Galaxy.ts, barred-spiral.glsl).
 * Native WebGL rendering and procedural particle materials are local to AITA;
 * the author's unpublished textures and website interface are not included.
 *
 * The MIT License (MIT)
 * Copyright © 2022 ggwzrd
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
(() => {
  "use strict";

  const vertexSource = `
    precision highp float;
    attribute vec3 aPosition;
    attribute vec4 aParticle;
    attribute vec4 aColor;
    uniform vec2 uViewport;
    uniform vec2 uCenter;
    uniform float uScale;
    uniform float uDpr;
    uniform float uTime;
    uniform float uWordPulse;
    varying vec4 vColor;
    varying float vShape;
    varying float vSeed;

    void main() {
      float radius = length(aPosition.xz);
      float angle = uTime * (0.017 + 0.027 / (radius + 0.3)) * aParticle.z;
      mat2 rotation = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
      vec2 orbit = rotation * aPosition.xz;
      float fold = sin(orbit.x * 2.5 + orbit.y * 3.2)
                 * sin(orbit.y * 4.1 - orbit.x * 1.8);
      orbit *= 1.0 + fold * 0.14 * smoothstep(0.35, 0.8, radius);
      // A gently warped volume, rather than a rigid, flat rotating sprite.
      float lift = sin(orbit.x * 2.8 + uTime * 0.08)
                 * cos(orbit.y * 3.1 - uTime * 0.06) * 0.045;
      float perspective = 1.0 / (1.0 + orbit.y * 0.13);
      vec2 plane = vec2(orbit.x, orbit.y * 0.69 + aPosition.y + lift) * perspective;
      float tilt = -0.20;
      plane = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * plane;
      vec2 pixel = uCenter + plane * uScale;
      gl_Position = vec4(pixel.x / uViewport.x * 2.0 - 1.0,
                         1.0 - pixel.y / uViewport.y * 2.0, 0.0, 1.0);
      gl_PointSize = clamp(aParticle.x * uDpr * perspective
                        * clamp(uScale / 175.0, 0.62, 1.9), 0.85 * uDpr, 22.0);
      float core = smoothstep(0.205, 0.285, radius);
      float outskirts = 1.0 - smoothstep(2.06, 2.48, radius);
      float wordBand = exp(-pow((pixel.y - uCenter.y) / (uViewport.y * 0.14), 2.0));
      float flicker = 0.91 + 0.09 * sin(uTime * 0.7 + aParticle.y * 30.0);
      vColor = vec4(aColor.rgb, aColor.a * core * outskirts * flicker
                    * (1.0 - uWordPulse * wordBand * 0.38));
      vShape = aParticle.w;
      vSeed = aParticle.y;
    }
  `;

  const fragmentSource = `
    precision mediump float;
    varying vec4 vColor;
    varying float vShape;
    varying float vSeed;

    void main() {
      vec2 p = gl_PointCoord * 2.0 - 1.0;
      float radius = length(p);
      float material;
      if (vShape < 0.5) {
        material = exp(-radius * radius * 3.5) * (1.0 - smoothstep(0.72, 1.0, radius));
      } else if (vShape < 1.5) {
        // Irregular, block-like flecks interleaved with the much finer dust.
        vec2 cell = floor((p + 1.0) * 2.5);
        float chip = 0.48 + 0.52 * step(-0.22, sin(cell.x * 3.1 + cell.y * 5.7 + vSeed * 29.0));
        float edge = max(abs(p.x), abs(p.y));
        material = chip * (1.0 - smoothstep(0.65, 1.0, edge)) * exp(-radius * radius * 0.85);
      } else {
        float star = exp(-radius * radius * 8.0);
        float rays = exp(-min(abs(p.x), abs(p.y)) * 22.0) * max(0.0, 1.0 - radius);
        material = star + rays * 0.32;
      }
      float alpha = vColor.a * material;
      if (alpha < 0.008) discard;
      gl_FragColor = vec4(vColor.rgb, alpha);
    }
  `;

  window.createAitaResearchGalaxy = () => {
    const surface = document.createElement("canvas");
    const gl = surface.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true
    });
    if (!gl) return null; // The existing 2D inflow and keywords remain usable.

    let seed = 20260903;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const normal = () => Math.sqrt(-2 * Math.log(Math.max(0.00001, random())))
      * Math.cos(random() * Math.PI * 2);
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const clusters = Array.from({ length: 420 }, (_, index) => {
      const radius = 0.26 + random() * 2.16;
      const arm = index % 4;
      return {
        radius,
        angle: arm * Math.PI * 0.5 + Math.log(radius + 0.16) * 2.15
          + normal() * 0.24 + Math.sin(radius * 5.6 + arm * 1.7) * 0.40,
        spread: 0.02 + radius * 0.025 + Math.pow(random(), 2) * 0.09
      };
    });

    // Eight overlapping populations: broken clouds, microdust, flecks, cold
    // outer stars and a warm inner rim. Black gaps are left between clusters.
    const layers = [
      { count: 12000, color: [0.20, 0.055, 0.94], size: 8.0, alpha: 0.42, min: 0.36, max: 2.12, speed: 0.84, depth: 0.040, shape: 1, clumps: 0.94 },
      { count: 36000, color: [0.16, 0.055, 1.00], size: 2.2, alpha: 0.85, min: 0.29, max: 2.23, speed: 0.96, depth: 0.025, shape: 0, clumps: 0.77 },
      { count: 20000, color: [0.46, 0.13, 1.00], size: 2.9, alpha: 0.75, min: 0.28, max: 1.94, speed: 1.04, depth: 0.038, shape: 0, clumps: 0.88 },
      { count: 17000, color: [0.32, 0.13, 0.94], size: 4.6, alpha: 0.54, min: 0.34, max: 2.12, speed: 0.91, depth: 0.045, shape: 1, clumps: 0.94 },
      { count: 16000, color: [0.63, 0.44, 1.00], size: 1.8, alpha: 0.80, min: 0.26, max: 1.73, speed: 1.10, depth: 0.026, shape: 0, clumps: 0.83 },
      { count: 9200, color: [0.30, 0.90, 1.00], size: 3.3, alpha: 0.90, min: 1.16, max: 2.44, speed: 0.77, depth: 0.065, shape: 0, clumps: 0.52 },
      { count: 7600, color: [1.00, 0.79, 0.34], size: 3.2, alpha: 0.90, min: 0.215, max: 0.56, speed: 0.94, depth: 0.018, shape: 0, clumps: 0.38 },
      { count: 2200, color: [0.92, 0.97, 1.00], size: 4.8, alpha: 0.97, min: 0.28, max: 2.40, speed: 0.85, depth: 0.050, shape: 2, clumps: 0.65 }
    ];
    const stride = 11;
    const particles = new Float32Array(layers.reduce((sum, layer) => sum + layer.count, 0) * stride);
    let cursor = 0;
    layers.forEach((layer) => {
      layer.first = cursor / stride;
      const knots = clusters.filter((knot) => knot.radius >= layer.min && knot.radius <= layer.max);
      for (let index = 0; index < layer.count; index += 1) {
        let radius;
        let angle;
        if (knots.length && random() < layer.clumps) {
          const knot = knots[Math.floor(random() * knots.length)];
          radius = clamp(knot.radius + normal() * knot.spread, layer.min, layer.max);
          angle = knot.angle + normal() * knot.spread / radius;
        } else {
          radius = layer.min + (layer.max - layer.min) * Math.pow(random(), 0.9);
          angle = random() * Math.PI * 2;
        }
        const grain = random();
        const light = 0.80 + random() * 0.20;
        particles.set([
          Math.cos(angle) * radius,
          normal() * layer.depth,
          Math.sin(angle) * radius,
          layer.size * (0.50 + grain * grain * 0.50),
          grain,
          layer.speed * (0.97 + grain * 0.06),
          layer.shape,
          layer.color[0] * light,
          layer.color[1] * light,
          layer.color[2] * light,
          layer.alpha * (0.72 + grain * 0.28)
        ], cursor);
        cursor += stride;
      }
    });

    let program;
    let buffer;
    let uniforms;
    let available = false;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };
    const initialize = () => {
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, particles, gl.STATIC_DRAW);
      [["aPosition", 3, 0], ["aParticle", 4, 3], ["aColor", 4, 7]].forEach(([name, size, offset]) => {
        const location = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, offset * 4);
      });
      uniforms = Object.fromEntries(["uViewport", "uCenter", "uScale", "uDpr", "uTime", "uWordPulse"]
        .map((name) => [name, gl.getUniformLocation(program, name)]));
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
      available = true;
    };
    try {
      initialize();
    } catch (error) {
      console.warn("Research galaxy could not initialize:", error);
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      return null;
    }
    surface.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      available = false;
    });
    surface.addEventListener("webglcontextrestored", () => {
      try { initialize(); }
      catch (error) { console.warn("Research galaxy could not restore:", error); }
    });

    return {
      // The existing Research loop owns time, visibility, resize and reduced
      // motion. This renderer never starts a second animation loop.
      draw(context, width, height, dpr, time, centerX, centerY, wordPulse) {
        if (!available) return;
        const narrow = width < 720;
        const pixelRatio = Math.min(dpr, 1.75, Math.sqrt(2200000 / (width * height)));
        const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
        const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
        if (surface.width !== pixelWidth || surface.height !== pixelHeight) {
          surface.width = pixelWidth;
          surface.height = pixelHeight;
        }
        gl.viewport(0, 0, pixelWidth, pixelHeight);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        const radius = narrow ? Math.min(width * 0.64, height * 0.44)
          : Math.min(width * 0.43, height * 0.94);
        gl.uniform2f(uniforms.uViewport, width, height);
        gl.uniform2f(uniforms.uCenter, centerX, centerY);
        gl.uniform1f(uniforms.uScale, radius / 2.4);
        gl.uniform1f(uniforms.uDpr, pixelRatio);
        gl.uniform1f(uniforms.uTime, time / 1000);
        gl.uniform1f(uniforms.uWordPulse, wordPulse);
        layers.forEach((layer) => gl.drawArrays(gl.POINTS, layer.first, Math.round(layer.count * (narrow ? 0.6 : 1))));
        context.drawImage(surface, 0, 0, width, height);
      }
    };
  };
})();
