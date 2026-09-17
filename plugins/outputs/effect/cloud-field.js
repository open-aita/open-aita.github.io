/*
  AITA Cloud Field — the particle flock behind the Outputs banner.

  Original WebGL2 implementation written for this site. It renders one cloud of
  agents that continuously reshapes itself between three formations (a flowing
  ribbon, a crossed exchange figure and a ring halo) and focuses the result with
  a depth-of-field pass. Outside the viewport playback stops entirely; inside it,
  an adaptive budget trades resolution and particle count for frame time.

  Design notes:
  - Agents are generated, never stored. A golden-ratio sequence spaces them along
    the shape and a sine hash gives each one its across / depth / character.
  - The formation is evaluated entirely in the vertex shader. The CPU samples a
    few hundred agents per scene second only to keep the camera framing the mass.
  - No runtime dependency beyond the shared effect-budget helper.

  Coordinate conventions follow WebGL: right-handed, camera looks down -Z, and
  matrices are column-major with element index col * 4 + row.
*/

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/* ---------------------------------------------------------------- constants */

const CAMERA_DISTANCE = 8;
const CAMERA_FOV = 39;
const CAMERA_NEAR = 0.04;
const CAMERA_FAR = 45;
// Height of the camera frustum at the focal plane; every world-space size in
// this effect is expressed as a fraction of it, so the layout survives resizes.
const FOCAL_PLANE_HEIGHT = 2 * CAMERA_DISTANCE * Math.tan(CAMERA_FOV * DEG / 2);

const AGENT_COUNT = 32000;
const SHAPE_SPEED = 0.33;
const REVEAL_SECONDS = 1.2;
const FORMATION_MORPH_PERIOD = 36;
const FORMATION_MORPH_SPAN = 36;
const FORMATION_TIME_OFFSET = 43.8;
// Scene time runs slower than real time.
const CLOCK_SCALE = REVEAL_SECONDS / 10;

const MAX_SWARM_WIDTH = 1920;
const NARROW_BREAKPOINT = 704;
const FRAMING_SAMPLES = 512;
const FRAMING_STEP = 2.4;          // scene seconds between camera-fitting knots
const FRAMING_TAIL = 0.02;         // fraction trimmed from each end when fitting
const PARTICLE_FLOOR = 1000;
const PARTICLE_STEP = 500;
const REFERENCE_WIDTH = 1440;
const REFERENCE_HEIGHT = 800;

/* --------------------------------------------------------------------- math */

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
// Deterministic point hash: integer in, [0,1) out, no state and no table.
const hash = i => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453123;
  return v - Math.floor(v);
};

const m4 = () => new Float32Array(16);

function setRotationX(out, radians) {
  const c = Math.cos(radians), s = Math.sin(radians);
  out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = c; out[6] = s; out[7] = 0;
  out[8] = 0; out[9] = -s; out[10] = c; out[11] = 0;
  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  return out;
}

function setRotationZ(out, radians) {
  const c = Math.cos(radians), s = Math.sin(radians);
  out[0] = c; out[1] = s; out[2] = 0; out[3] = 0;
  out[4] = -s; out[5] = c; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  return out;
}

function multiply(out, a, b) {
  for (let col = 0; col < 4; col++) {
    const b0 = b[col * 4], b1 = b[col * 4 + 1], b2 = b[col * 4 + 2], b3 = b[col * 4 + 3];
    out[col * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[col * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[col * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[col * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

function invertRigid(out, m) {
  // The camera world matrix is a pure rotation plus translation, so the inverse
  // is the transposed rotation with the translated origin.
  const tx = m[12], ty = m[13], tz = m[14];
  out[0] = m[0]; out[4] = m[1]; out[8] = m[2]; out[12] = -(m[0] * tx + m[1] * ty + m[2] * tz);
  out[1] = m[4]; out[5] = m[5]; out[9] = m[6]; out[13] = -(m[4] * tx + m[5] * ty + m[6] * tz);
  out[2] = m[8]; out[6] = m[9]; out[10] = m[10]; out[14] = -(m[8] * tx + m[9] * ty + m[10] * tz);
  out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
  return out;
}

function setPerspective(out, left, right, top, bottom, near, far) {
  const x = 2 * near / (right - left);
  const y = 2 * near / (top - bottom);
  const a = (right + left) / (right - left);
  const b = (top + bottom) / (top - bottom);
  out[0] = x; out[4] = 0; out[8] = a; out[12] = 0;
  out[1] = 0; out[5] = y; out[9] = b; out[13] = 0;
  out[2] = 0; out[6] = 0; out[10] = -(far + near) / (far - near); out[14] = -2 * far * near / (far - near);
  out[3] = 0; out[7] = 0; out[11] = -1; out[15] = 0;
  return out;
}

/* -------------------------------------------------------------- agent field */

// Four channels per agent: position along the shape, spread across it, spread
// through its depth, and an individual character in [0,1).
const AGENTS = (() => {
  const field = new Float32Array(AGENT_COUNT * 4);
  for (let i = 0; i < AGENT_COUNT; i++) {
    const o = i * 4;
    const h0 = hash(i + 0.31);
    const h1 = hash(i + 9.17);
    const h2 = hash(i + 28.63);
    const h3 = hash(i + 71.91);
    field[o] = (0.618033988749895 * i) % 1;
    field[o + 1] = (h0 + h1 + h2 - 1.5) * 1.13;
    field[o + 2] = (h1 + h2 + h3 - 1.5) * 1.08;
    field[o + 3] = hash(i + 113.47);
  }
  return field;
})();

// Reduce the field to a capacity the way the draw buffer is reduced, so the
// framing pass and the render pass see the same silhouette.
function thinAgents(source, count) {
  const total = source.length / 4;
  const keep = Math.max(0, Math.min(total, Math.floor(count)));
  if (keep === total) return source;
  if (keep === 0) return new Float32Array(0);
  const out = new Float32Array(keep * 4);
  for (let i = 0; i < keep; i++) {
    const from = Math.floor((i + 0.5) * total / keep);
    out.set(source.subarray(from * 4, from * 4 + 4), i * 4);
  }
  return out;
}

/* ------------------------------------------------------------------ the shape */

// Real seconds drive the entrance; the shape itself runs on its own slower clock.
const sceneClock = elapsed => Math.max(0, elapsed) * CLOCK_SCALE;
const revealAmount = elapsed => 1 - (1 - clamp01(elapsed / 5)) ** 2;

const shapeTime = sceneTime => SHAPE_SPEED * sceneTime;
// After the reveal the shape eases between morphs on a fixed period.
const formationElapsed = (sceneTime) => {
  const shape = shapeTime(sceneTime);
  if (shape <= REVEAL_SECONDS) return shape;
  const phase = ((shape - REVEAL_SECONDS) % FORMATION_MORPH_PERIOD) / FORMATION_MORPH_PERIOD;
  return REVEAL_SECONDS + FORMATION_MORPH_SPAN * Math.sin(phase * Math.PI) ** 2;
};

// Whole-flock tilt: a single slow rocking around X, ramped in after the reveal.
const swarmRoll = (sceneTime) => {
  const shape = formationElapsed(sceneTime);
  const amount = smoothstep(0, 1, 0.5 + 0.5 * Math.sin(0.105 * (shape + FORMATION_TIME_OFFSET) - 0.5));
  return 0.5 * (1 - amount) * smoothstep(REVEAL_SECONDS, 12, shape);
};

// CPU twin of the vertex-shader formation, used only for camera fitting.
function sampleFormation(agent, sceneTime, out, thickness) {
  const along = agent[0];
  const across = agent[1] * thickness;
  const depth = agent[2] * thickness;
  const character = agent[3];

  const shape = shapeTime(sceneTime);
  const time = formationElapsed(sceneTime) + FORMATION_TIME_OFFSET;
  const flow = shape + FORMATION_TIME_OFFSET;

  const angle = along * TAU + flow * (0.151 + character * 0.025);
  const pulse = time * 0.14;
  const crossSection = 0.10 + 0.15 * Math.abs(Math.sin(angle * 1.5 + pulse)) ** 1.6;
  const filament = Math.sin(angle * 5 + depth * 4 - time * 0.36) * 0.022;

  // Ring halo: the widest and calmest of the three.
  const haloX = Math.cos(angle) * (1.03 + Math.sin(angle * 2 - pulse) * 0.10) + Math.cos(angle) * across * crossSection;
  const haloY = Math.sin(angle) * 0.42 + Math.sin(angle * 2 + pulse) * 0.085 + across * crossSection * 0.74 + filament;
  const haloZ = Math.sin(angle + pulse * 0.65) * 0.76 + depth * crossSection * 1.72;

  // Ribbon: a swept band that reads as one continuous stream.
  const envelope = 0.58 + (0.5 + 0.5 * Math.cos(angle * 2)) * 0.42;
  const ribbonX = Math.sin(angle) * 1.34 + across * Math.cos(angle) * 0.09;
  const ribbonY = Math.sin(angle * 2 + pulse) * 0.27 + Math.sin(angle * 3 - pulse * 0.6) * 0.08 + across * envelope * 0.22 + filament;
  const ribbonZ = Math.cos(angle) * 0.72 + Math.sin(angle * 2 - pulse * 0.7) * 0.12 + depth * envelope * 0.43;

  // Exchange: the crossed figure that sits between the other two.
  const figure = angle + Math.sin(angle * 2 + pulse) * 0.20;
  const exchangeX = Math.sin(figure) * 1.08 + across * Math.cos(figure) * 0.14;
  const exchangeY = Math.sin(figure * 2) * 0.31 + across * 0.17 + filament;
  const exchangeZ = Math.cos(figure) * 0.86 + depth * (0.17 + Math.abs(Math.sin(figure)) * 0.13);

  const ringWeight = 0.5 + 0.5 * Math.sin(time * 0.105 - 0.5);
  const exchangeWeight = 0.5 + 0.5 * Math.sin(time * 0.074 + 1.3);
  const toHalo = ringWeight * ringWeight * (3 - 2 * ringWeight);
  const toExchange = exchangeWeight * exchangeWeight * (3 - 2 * exchangeWeight) * 0.72;

  const mx = ribbonX + (exchangeX - ribbonX) * toExchange;
  const my = ribbonY + (exchangeY - ribbonY) * toExchange;
  const mz = ribbonZ + (exchangeZ - ribbonZ) * toExchange;

  out[0] = mx + (haloX - mx) * toHalo + Math.sin(angle * 3 + depth * 1.6 - time * 0.19) * 0.035;
  out[1] = my + (haloY - my) * toHalo + Math.sin(angle * 2 + across * 2.1 + time * 0.14) * 0.028;
  out[2] = mz + (haloZ - mz) * toHalo + Math.cos(angle * 4 + across * 0.9 - time * 0.17) * 0.055;
  return out;
}

/* -------------------------------------------------------------------- layout */

const NARROW_CAMERA = [0.8, 0.3, 9.6];
const NARROW_DISTANCE = Math.hypot(NARROW_CAMERA[0], NARROW_CAMERA[1], NARROW_CAMERA[2]);
const NARROW_PITCH = Math.asin(NARROW_CAMERA[1] / NARROW_DISTANCE);
const NARROW_REFERENCE_RATIO = 378 / 359.09375;
const NARROW_ROLL = 35 * DEG;
// Wider than the desktop lens: a narrow viewport needs more field to hold the
// same silhouette without shrinking the flock.
const NARROW_PLANE_HEIGHT = 2 * NARROW_DISTANCE * Math.tan(CAMERA_FOV * DEG / 2);

const narrowRoll = ratio => NARROW_ROLL * Math.atan2(1, ratio) / Math.atan2(1, NARROW_REFERENCE_RATIO);

function narrowFit(ratio) {
  const roll = narrowRoll(ratio);
  const shorten = Math.hypot(0.83 * Math.cos(NARROW_PITCH), Math.sin(NARROW_PITCH));
  const stretch = Math.hypot(0.83 * Math.sin(NARROW_PITCH), Math.cos(NARROW_PITCH));
  const extent = (width, depth) => {
    const mass = 0.44 * width;
    return NARROW_DISTANCE * mass / Math.hypot(NARROW_DISTANCE * depth, mass * stretch);
  };
  const acrossDepth = Math.hypot(1.4 * Math.cos(roll), shorten * Math.sin(roll));
  const alongDepth = Math.hypot(1.4 * Math.sin(roll), shorten * Math.cos(roll));
  return Math.min(
    1.8 * extent(NARROW_PLANE_HEIGHT * ratio, acrossDepth),
    1.5 * extent(NARROW_PLANE_HEIGHT, alongDepth),
  );
}

const NARROW_REFERENCE_FIT = narrowFit(NARROW_REFERENCE_RATIO);

function swarmLayout(width, height, maxWidth) {
  if (width >= NARROW_BREAKPOINT) {
    return {
      scale: Math.min(FOCAL_PLANE_HEIGHT * Math.min(width, maxWidth) / Math.max(height, 1) * 0.34, 0.41 * FOCAL_PLANE_HEIGHT),
      centerY: -0.045 * FOCAL_PLANE_HEIGHT,
      shortAxisScale: 1,
      thickness: 1,
      roll: 0,
      camera: [0, 0, CAMERA_DISTANCE],
    };
  }
  const ratio = Math.max(width, 1) / Math.max(height, 1);
  return {
    scale: 2.6 * narrowFit(ratio) / NARROW_REFERENCE_FIT,
    centerY: 0,
    shortAxisScale: 1,
    thickness: 0.65,
    roll: narrowRoll(ratio),
    camera: NARROW_CAMERA,
  };
}

/* -------------------------------------------------------------------- camera */

const cameraWorld = m4();
const cameraInverse = m4();
const cameraProjection = m4();
const viewProjection = m4();
const cameraState = {
  aspect: 1,
  zoom: 1,
  view: null,
};

function updateCameraTransform(layout) {
  const eye = layout.camera;
  const len = Math.hypot(eye[0], eye[1], eye[2]) || 1;
  // Look at the origin, then add the narrow-layout roll.
  const zx = eye[0] / len, zy = eye[1] / len, zz = eye[2] / len;
  let xx = zz, xy = 0, xz = -zx;
  const xlen = Math.hypot(xx, xy, xz) || 1;
  xx /= xlen; xy /= xlen; xz /= xlen;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  cameraWorld[0] = xx; cameraWorld[4] = yx; cameraWorld[8] = zx; cameraWorld[12] = eye[0];
  cameraWorld[1] = xy; cameraWorld[5] = yy; cameraWorld[9] = zy; cameraWorld[13] = eye[1];
  cameraWorld[2] = xz; cameraWorld[6] = yz; cameraWorld[10] = zz; cameraWorld[14] = eye[2];
  cameraWorld[3] = 0; cameraWorld[7] = 0; cameraWorld[11] = 0; cameraWorld[15] = 1;
  if (layout.roll) {
    const rolled = setRotationZ(m4(), layout.roll);
    multiply(cameraWorld, cameraWorld, rolled);
  }
  invertRigid(cameraInverse, cameraWorld);
}

function updateCameraProjection() {
  const halfHeight = CAMERA_NEAR * Math.tan(CAMERA_FOV * DEG / 2) / cameraState.zoom;
  const fullHeight = 2 * halfHeight;
  const fullWidth = cameraState.aspect * fullHeight;
  let left = -0.5 * fullWidth;
  let top = halfHeight;
  let width = fullWidth;
  let height = fullHeight;
  const view = cameraState.view;
  if (view) {
    left += view.offsetX * fullWidth / view.fullWidth;
    top -= view.offsetY * fullHeight / view.fullHeight;
    width = fullWidth * view.width / view.fullWidth;
    height = fullHeight * view.height / view.fullHeight;
  }
  setPerspective(cameraProjection, left, left + width, top, top - height, CAMERA_NEAR, CAMERA_FAR);
  multiply(viewProjection, cameraProjection, cameraInverse);
}

function setViewOffset(offsetX, offsetY, width, height) {
  cameraState.aspect = width / Math.max(height, 1);
  cameraState.view = { fullWidth: width, fullHeight: height, offsetX, offsetY, width, height };
  updateCameraProjection();
}

function projectPoint(x, y, z, out) {
  const m = viewProjection;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
}

// Distance from the camera plane to a world point, in the camera's own frame.
function viewDistance(x, y, z) {
  return -(
    cameraInverse[2] * x + cameraInverse[6] * y + cameraInverse[10] * z + cameraInverse[14]
  );
}

/* ------------------------------------------------------------------ shaders */

// WebGL2 context, so the shaders are written for GLSL ES 3.00: derivatives such
// as fwidth() are core there instead of an extension, and the fragment stage
// declares its own output.
const es3 = source => `#version 300 es\n${source.replace(/^\n/, '')}`;

// Shared by the vertex pass and kept in sync with sampleFormation() above.
const FORMATION_GLSL = `
  uniform float uTime;
  uniform float uReveal;
  uniform float uScale;
  uniform float uShapeThickness;

  float ease(float value) {
    float progress = clamp(value, 0.0, 1.0);
    return progress * progress * (3.0 - 2.0 * progress);
  }

  vec3 formationPositionAt(vec4 agent, float elapsed) {
    float along = agent.x;
    float across = agent.y * uShapeThickness;
    float depth = agent.z * uShapeThickness;
    float character = agent.w;
    float shapeElapsed = elapsed * ${SHAPE_SPEED.toFixed(4)};
    float formationElapsed = shapeElapsed;
    if (shapeElapsed > ${REVEAL_SECONDS.toFixed(4)}) {
      float phase = mod(shapeElapsed - ${REVEAL_SECONDS.toFixed(4)}, ${FORMATION_MORPH_PERIOD.toFixed(4)}) / ${FORMATION_MORPH_PERIOD.toFixed(4)};
      float excursion = sin(3.14159265359 * phase);
      formationElapsed = ${REVEAL_SECONDS.toFixed(4)} + ${FORMATION_MORPH_SPAN.toFixed(4)} * excursion * excursion;
    }
    float time = formationElapsed + ${FORMATION_TIME_OFFSET.toFixed(4)};
    float flowTime = shapeElapsed + ${FORMATION_TIME_OFFSET.toFixed(4)};

    float angle = along * 6.28318530718 + flowTime * (0.151 + character * 0.025);
    float pulse = time * 0.14;
    float crossSection = 0.10 + 0.15 * pow(abs(sin(angle * 1.5 + pulse)), 1.6);
    float filament = sin(angle * 5.0 + depth * 4.0 - time * 0.36) * 0.022;

    vec3 halo = vec3(
      cos(angle) * (1.03 + sin(angle * 2.0 - pulse) * 0.10),
      sin(angle) * 0.42 + sin(angle * 2.0 + pulse) * 0.085,
      sin(angle + pulse * 0.65) * 0.76
    );
    halo += vec3(
      cos(angle) * across * crossSection,
      across * crossSection * 0.74 + filament,
      depth * crossSection * 1.72
    );

    float envelope = 0.58 + (0.5 + 0.5 * cos(angle * 2.0)) * 0.42;
    vec3 ribbon = vec3(
      sin(angle) * 1.34,
      sin(angle * 2.0 + pulse) * 0.27 + sin(angle * 3.0 - pulse * 0.6) * 0.08,
      cos(angle) * 0.72 + sin(angle * 2.0 - pulse * 0.7) * 0.12
    );
    ribbon += vec3(
      across * cos(angle) * 0.09,
      across * envelope * 0.22 + filament,
      depth * envelope * 0.43
    );

    float figureAngle = angle + sin(angle * 2.0 + pulse) * 0.20;
    vec3 exchange = vec3(
      sin(figureAngle) * 1.08,
      sin(figureAngle * 2.0) * 0.31,
      cos(figureAngle) * 0.86
    );
    exchange += vec3(
      across * cos(figureAngle) * 0.14,
      across * 0.17 + filament,
      depth * (0.17 + abs(sin(figureAngle)) * 0.13)
    );

    float ringWeight = 0.5 + 0.5 * sin(time * 0.105 - 0.5);
    float exchangeWeight = 0.5 + 0.5 * sin(time * 0.074 + 1.3);
    vec3 formation = mix(ribbon, exchange, ease(exchangeWeight) * 0.72);
    formation = mix(formation, halo, ease(ringWeight));
    formation += vec3(
      sin(angle * 3.0 + depth * 1.6 - time * 0.19) * 0.035,
      sin(angle * 2.0 + across * 2.1 + time * 0.14) * 0.028,
      cos(angle * 4.0 + across * 0.9 - time * 0.17) * 0.055
    );

    return formation;
  }

  vec3 agentPosition(vec4 agent) {
    return formationPositionAt(agent, uTime) * uScale;
  }
`;

const POINT_VERTEX = `
  ${FORMATION_GLSL}

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uPixelRatio;
  uniform float uPointGain;

  in vec4 aAgent;

  out float vOpacity;
  out float vStreak;
  out vec2 vStreakDir;
  out float vStreakPurple;

  void main() {
    float character = aAgent.w;
    vec3 point = agentPosition(aAgent);
    vec4 viewPosition = modelViewMatrix * vec4(point, 1.0);

    // A small share of agents draw as short motion streaks, and half of those
    // carry the second streak ink.
    float streakHash = fract(aAgent.x * 5.391 + character * 11.77 + aAgent.y * 3.31);
    vStreak = step(0.972, streakHash);
    vStreakPurple = step(0.5, fract(streakHash * 977.0));
    vec3 streakAhead = formationPositionAt(aAgent, uTime + 0.3) * uScale;
    vec2 streakDelta = (modelViewMatrix * vec4(streakAhead, 1.0)).xy - viewPosition.xy;
    float streakDeltaLen = length(streakDelta);
    vStreakDir = streakDeltaLen > 1e-5 ? streakDelta / streakDeltaLen : vec2(1.0, 0.0);

    // Dimmer behind the focal plane and faded out where agents crowd the lens.
    float focalDepth = smoothstep(11.0, 6.1, -viewPosition.z);
    float cameraClearance = smoothstep(4.3, 6.0, -viewPosition.z);

    // Scattered start times keep the entrance immediate without revealing the
    // whole flock at once.
    float revealSeed = fract(aAgent.x * 17.13 + character * 7.41);
    float revealStart = pow(revealSeed, 1.6) * 0.9;
    float revealEnd = min(1.0, revealStart + mix(0.18, 0.34, fract(character * 13.17 + aAgent.x * 3.71)));
    float dotProgress = clamp((uReveal - revealStart) / (revealEnd - revealStart), 0.0, 1.0);
    float formationVisibility = 1.0 - (1.0 - dotProgress) * (1.0 - dotProgress);

    float size = mix(0.86, 2.05, pow(character, 2.4));
    size += smoothstep(0.976, 1.0, character) * 1.2;

    vOpacity = mix(0.57, 0.88, focalDepth) *
      mix(0.74, 1.0, character) * cameraClearance * formationVisibility;

    // Scattered phases give the coloured filaments a soft, independent twinkle;
    // scene time drives it, so pausing pauses the shimmer too.
    float twinklePhase = fract(aAgent.x * 31.73 + character * 19.17) * 6.28318530718;
    float twinkleRate = mix(1.8, 3.2, fract(character * 23.41));
    float twinkleWave = 0.5 + 0.5 * sin(uTime * twinkleRate + twinklePhase);
    float twinkle = mix(0.24, 1.0, twinkleWave * twinkleWave);
    vOpacity *= mix(1.0, twinkle, vStreak);

    float scaled = 8.0 / max(-viewPosition.z, 0.12);
    float dotPointSize = min(size * uPixelRatio * uPointGain * mix(scaled, 1.0, 0.28), 5.0 * uPixelRatio);
    gl_PointSize = vStreak > 0.5 ? min(max(dotPointSize * 3.4, 6.5 * uPixelRatio), 9.0 * uPixelRatio) : dotPointSize;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const POINT_FRAGMENT = `
  precision highp float;
  uniform vec3 uInk;
  uniform float uInkContrast;
  in float vOpacity;
  in float vStreak;
  in vec2 vStreakDir;
  in float vStreakPurple;

  out vec4 fragColor;

  void main() {
    vec2 spriteCoord = gl_PointCoord - vec2(0.5);
    float radius = length(spriteCoord);
    // Antialias the dot inside the sprite so small points stay round.
    float edgeWidth = clamp(fwidth(radius), 0.08, 0.5);
    float circleCoverage = 1.0 - smoothstep(0.5 - edgeWidth, 0.5, radius);

    // Short thin capsule aligned to screen-space motion (PointCoord.y points down).
    vec2 streakDir = vec2(vStreakDir.x, -vStreakDir.y);
    vec2 streakAxes = vec2(dot(spriteCoord, streakDir), dot(spriteCoord, vec2(-streakDir.y, streakDir.x)));
    float streakSd = length(vec2(max(abs(streakAxes.x) - 0.30, 0.0), streakAxes.y)) - 0.038;
    float streakEdge = clamp(fwidth(streakSd), 0.02, 0.2);
    float streakCoverage = 1.0 - smoothstep(-streakEdge, streakEdge, streakSd);
    float coverage = mix(circleCoverage, streakCoverage, vStreak);

    vec3 streakInk = mix(vec3(0.13, 0.83, 0.91), vec3(0.65, 0.55, 0.98), vStreakPurple);
    vec3 ink = mix(uInk, streakInk, vStreak);
    float opacity = min(vOpacity * uInkContrast, 1.0) * coverage;
    if (opacity < 0.01) discard;
    fragColor = vec4(ink, opacity);
  }
`;

const QUAD_VERTEX = `
  in vec2 aPosition;
  out vec2 vUv;
  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const COC_FRAGMENT = `
  precision highp float;
  uniform sampler2D uDepth;
  uniform float uNear;
  uniform float uFar;
  uniform float uFocusDistance;
  uniform float uFocusRange;
  in vec2 vUv;

  out vec4 fragColor;

  void main() {
    // The depth buffer is non-linear, so recover the view distance first.
    float depth = texture(uDepth, vUv).x * 2.0 - 1.0;
    float distance_ = (2.0 * uNear * uFar) / (uFar + uNear - depth * (uFar - uNear));
    fragColor = vec4(vec3(smoothstep(0.0, uFocusRange, abs(distance_ - uFocusDistance))), 1.0);
  }
`;

const BOKEH_FRAGMENT = `
  precision highp float;
  uniform sampler2D uScene;
  uniform sampler2D uCoc;
  uniform vec2 uTexel;
  uniform float uMaxRadius;
  uniform float uCentreWeight;
  uniform float uContrast;
  uniform float uInvert;
  in vec2 vUv;

  out vec4 fragColor;

  const int TAPS = 24;
  const float GOLDEN_ANGLE = 2.39996323;
  const float RADIAL_SEQUENCE = 0.7548776662;

  void main() {
    float centreCoc = clamp(texture(uCoc, vUv).x, 0.0, 1.0);
    float radius = centreCoc * uMaxRadius;

    // Aperture disc with a bright rim. Taps sit on the rim rather than filling
    // the disc, so a defocused point keeps a defined edge instead of dissolving
    // into a grey wash; the small centre weight keeps in-focus dots solid.
    vec3 accumulated = texture(uScene, vUv).rgb * uCentreWeight;
    float weight = uCentreWeight;
    for (int i = 0; i < TAPS; i++) {
      float fi = float(i);
      float angle = fi * GOLDEN_ANGLE;
      float ring = mix(0.78, 1.0, fract(fi * RADIAL_SEQUENCE));
      vec2 offset = vec2(cos(angle), sin(angle)) * ring * radius * uTexel;
      // A sharp neighbour must not bleed into a blurred pixel; a blurred one may
      // bleed into a sharp one so in-focus edges still soften.
      float neighbourCoc = texture(uCoc, vUv + offset).x;
      float accept = step(neighbourCoc - 0.05, centreCoc);
      accumulated += texture(uScene, vUv + offset).rgb * accept;
      weight += accept;
    }

    vec3 color = accumulated / weight;
    color = 1.0 - pow(1.0 - clamp(color, 0.0, 1.0), vec3(uContrast));
    fragColor = vec4(mix(color, 1.0 - color, uInvert), 1.0);
  }
`;

const BLIT_FRAGMENT = `
  precision highp float;
  uniform sampler2D uScene;
  in vec2 vUv;
  out vec4 fragColor;
  void main() { fragColor = vec4(texture(uScene, vUv).rgb, 1.0); }
`;

/* --------------------------------------------------------------------- theme */

const THEME_VARIABLES = [['--color-background', '#ffffff'], ['--color-primary-100', '#000000']];

function parseColor(value) {
  const hex = String(value).trim().replace('#', '');
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const toLinear = channel => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);

function readTheme() {
  const style = getComputedStyle(document.body);
  const read = ([name, fallback]) => parseColor(style.getPropertyValue(name)) ?? parseColor(fallback);
  const background = read(THEME_VARIABLES[0]);
  const ink = read(THEME_VARIABLES[1]).map(toLinear);
  const luminance = 0.2126 * ink[0] + 0.7152 * ink[1] + 0.0722 * ink[2];
  // A bright primary means the surrounding page is dark.
  const dark = luminance > 0.5;
  return {
    background,
    ink,
    dark,
    // Darker ink needs slightly more opacity to read against a light ground.
    contrast: 1.18 + (1.0 - 1.18) * smoothstep(0.25, 0.75, luminance),
  };
}

/* ------------------------------------------------------------------ defaults */

const DEFAULT_SETTINGS = {
  maxWidth: MAX_SWARM_WIDTH,
  postprocessing: true,
  // Sprite size in device pixels per unit of agent size.
  pointGain: 1.3,
  // Radius, in render-target texels, of the widest bokeh disc, and how much of
  // the sharp centre survives in a defocused pixel.
  bokehRadius: 1,
  bokehCentre: 0.3,
  bokehScale: 0.9,
  // World units either side of the focal plane that stay sharp. The flock is
  // only a few units deep, so most agents sit inside this and stay crisp.
  focusRange: 4,
  focusDepth: 0.3,
  // The flock renders into a smaller target and is scaled up on present. That
  // magnification is what keeps the colour filaments legible: at full drawing
  // buffer resolution a one-pixel-wide streak disappears into the dot field.
  resolutionScale: 0.75,
  blurContrast: 1,
};

function dynamicCount(width, height, capacity, settings) {
  const limit = Math.min(AGENT_COUNT, capacity);
  if (width <= 0 || height <= 0 || limit <= 0) return 0;
  const layout = swarmLayout(width, height, settings.maxWidth);
  const reference = swarmLayout(REFERENCE_WIDTH, REFERENCE_HEIGHT, settings.maxWidth);
  const relative = height * layout.scale / FOCAL_PLANE_HEIGHT;
  const baseline = REFERENCE_HEIGHT * reference.scale / FOCAL_PLANE_HEIGHT;
  const scaled = AGENT_COUNT * (relative / baseline) ** 2 * layout.shortAxisScale;
  return Math.min(limit, Math.max(PARTICLE_FLOOR, PARTICLE_STEP * Math.round(scaled / PARTICLE_STEP)));
}

/* ------------------------------------------------------------------- program */

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

function buildProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, es3(vertexSource)));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, es3(fragmentSource)));
  // Every program in this file draws from attribute slot 0, which keeps the
  // attribute state trivial to switch between passes.
  gl.bindAttribLocation(program, 0, vertexSource.includes('aAgent') ? 'aAgent' : 'aPosition');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
  }
  const locations = {};
  const total = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < total; i++) {
    const name = gl.getActiveUniform(program, i).name;
    locations[name] = gl.getUniformLocation(program, name);
  }
  return { program, locations };
}

/* -------------------------------------------------------------- the renderer */

export function createCloudField(canvas, options = {}) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: true,
    depth: true,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;

  const settings = { ...DEFAULT_SETTINGS, ...(options.settings ?? {}) };
  let multisample = Math.max(0, Math.min(4, options.multisampling ?? 0));
  let maxPixelRatio = options.maxPixelRatio ?? 1.6;
  let capacity = Math.min(AGENT_COUNT, options.capacity ?? AGENT_COUNT);
  let usePost = settings.postprocessing && (options.postprocessing !== false);

  const point = buildProgram(gl, POINT_VERTEX, POINT_FRAGMENT);
  const coc = buildProgram(gl, QUAD_VERTEX, COC_FRAGMENT);
  const bokeh = buildProgram(gl, QUAD_VERTEX, BOKEH_FRAGMENT);
  const blit = buildProgram(gl, QUAD_VERTEX, BLIT_FRAGMENT);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const agents = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, agents);
  gl.bufferData(gl.ARRAY_BUFFER, AGENTS, gl.STATIC_DRAW);
  let uploadedCapacity = AGENT_COUNT;

  const targets = { width: 0, height: 0 };

  function makeTexture(width, height, internal, format, type, filter) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  function makeTarget(width, height) {
    const color = makeTexture(width, height, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    return { color, framebuffer };
  }

  function releaseTargets() {
    for (const key of ['scene', 'coc', 'bokeh']) {
      const entry = targets[key];
      if (!entry) continue;
      gl.deleteFramebuffer(entry.framebuffer);
      gl.deleteTexture(entry.color);
      targets[key] = null;
    }
    if (targets.depth) { gl.deleteTexture(targets.depth); targets.depth = null; }
    if (targets.multisample) {
      gl.deleteFramebuffer(targets.multisample.framebuffer);
      gl.deleteRenderbuffer(targets.multisample.color);
      gl.deleteRenderbuffer(targets.multisample.depth);
      targets.multisample = null;
    }
  }

  function resizeTargets(width, height) {
    releaseTargets();
    targets.scene = makeTarget(width, height);
    targets.depth = makeTexture(width, height, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets.scene.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, targets.depth, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    targets.coc = makeTarget(width, height);
    targets.bokeh = makeTarget(width, height);
    if (multisample > 0) {
      const color = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, color);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, multisample, gl.RGBA8, width, height);
      const depth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, multisample, gl.DEPTH_COMPONENT24, width, height);
      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      targets.multisample = { framebuffer, color, depth };
    }
    targets.width = width;
    targets.height = height;
  }

  /* ------------------------------------------------------------ framing state */

  const framingCache = new Map();
  const framingScratch = new Float32Array(3);
  const framingProjected = new Float32Array(3);
  const framingRotation = m4();
  const samplePoints = [];
  for (let i = 0; i < FRAMING_SAMPLES; i++) {
    const base = 4 * Math.floor(i * AGENT_COUNT / FRAMING_SAMPLES);
    samplePoints.push([AGENTS[base], AGENTS[base + 1], AGENTS[base + 2], AGENTS[base + 3]]);
  }

  const state = {
    width: 1, height: 1, dpr: 1,
    count: 0,
    elapsed: 0,
    running: false, handle: 0, lastFrame: 0,
    narrowBox: { x: 0, y: 0, width: 1, height: 1 },
    framingReference: null,
    theme: readTheme(),
  };

  function layoutNow() {
    return swarmLayout(state.width, state.height, settings.maxWidth);
  }

  function measureFraming(sceneTime) {
    const layout = layoutNow();
    const xs = [], ys = [];
    let weightedX = 0, weightTotal = 0;
    const roll = swarmRoll(sceneTime);
    setRotationX(framingRotation, roll);
    for (const agent of samplePoints) {
      sampleFormation(agent, sceneTime, framingScratch, layout.thickness);
      // Scale, then the node's own short-axis squeeze, then tilt and lift.
      const x = framingScratch[0] * layout.scale;
      const sy = framingScratch[1] * layout.scale * layout.shortAxisScale;
      const sz = framingScratch[2] * layout.scale;
      const y = framingRotation[5] * sy + framingRotation[9] * sz + layout.centerY;
      const z = framingRotation[6] * sy + framingRotation[10] * sz;
      const depth = viewDistance(x, y, z);
      const weight = (CAMERA_DISTANCE / depth) ** 3 * smoothstep(4.3, 6, depth);
      projectPoint(x, y, z, framingProjected);
      xs.push(framingProjected[0]);
      ys.push(framingProjected[1]);
      weightedX += framingProjected[0] * weight;
      weightTotal += weight;
    }
    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);
    const narrow = state.width < NARROW_BREAKPOINT;
    const trim = narrow ? 0 : Math.floor(FRAMING_TAIL * xs.length);
    const low = trim, high = xs.length - trim - 1;
    const centerX = (xs[low] + xs[high]) / 2;
    return {
      width: Math.max(xs[high] - xs[low], 1e-4),
      height: Math.max(ys[high] - ys[low], 1e-4),
      x: narrow ? centerX : (centerX + weightedX / (weightTotal || 1)) / 2,
      y: (ys[low] + ys[high]) / 2,
    };
  }

  function framingAt(knot) {
    const narrow = state.width < NARROW_BREAKPOINT;
    if (knot <= 1 && !narrow) return [1, 0, 0];
    const cached = framingCache.get(knot);
    if (cached) return cached;
    const measured = (knot <= 1 || !state.framingReference) ? state.framingReference : measureFraming(knot * FRAMING_STEP);
    const target = narrow ? state.narrowBox : state.framingReference;
    const zoom = Math.min(target.width / measured.width, target.height / measured.height);
    const value = [
      zoom,
      (measured.x * zoom - target.x) * state.width / 2,
      (target.y - measured.y * zoom) * state.height / 2,
    ];
    framingCache.set(knot, value);
    return value;
  }

  function updateFraming(sceneTime) {
    const step = Math.max(0, sceneTime) / FRAMING_STEP;
    const base = Math.floor(step);
    const frac = step - base;
    const weights = [
      (1 - frac) ** 3 / 6,
      (3 * frac ** 3 - 6 * frac ** 2 + 4) / 6,
      (-3 * frac ** 3 + 3 * frac ** 2 + 3 * frac + 1) / 6,
      frac ** 3 / 6,
    ];
    let zoom = 0, offsetX = 0, offsetY = 0;
    for (let i = 0; i < 4; i++) {
      const value = framingAt(base + i - 1);
      zoom += weights[i] * value[0];
      offsetX += weights[i] * value[1];
      offsetY += weights[i] * value[2];
    }
    for (const key of [...framingCache.keys()]) {
      if (key < base - 1 || key > base + 2) framingCache.delete(key);
    }
    cameraState.zoom = zoom;
    setViewOffset(offsetX, offsetY, state.width, state.height);
  }

  /* ------------------------------------------------------------------ drawing */

  function bindQuad() {
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  function drawScene(targetFramebuffer, viewWidth, viewHeight) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.viewport(0, 0, viewWidth, viewHeight);
    gl.clearColor(state.theme.background[0], state.theme.background[1], state.theme.background[2], 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (state.count <= 0) return;

    const sceneNow = sceneClock(state.elapsed);
    const layout = layoutNow();
    const group = setRotationX(m4(), swarmRoll(sceneNow));
    // Column 1 of the rotation carries the node's own vertical squeeze.
    group[4] *= layout.shortAxisScale;
    group[5] *= layout.shortAxisScale;
    group[6] *= layout.shortAxisScale;
    group[7] *= layout.shortAxisScale;
    group[13] = layout.centerY;

    const modelView = multiply(m4(), cameraInverse, group);

    gl.useProgram(point.program);
    gl.uniformMatrix4fv(point.locations.modelViewMatrix, false, modelView);
    gl.uniformMatrix4fv(point.locations.projectionMatrix, false, cameraProjection);
    gl.uniform1f(point.locations.uTime, sceneNow);
    gl.uniform1f(point.locations.uReveal, revealAmount(state.elapsed));
    gl.uniform1f(point.locations.uScale, layout.scale);
    gl.uniform1f(point.locations.uShapeThickness, layout.thickness);
    gl.uniform1f(point.locations.uPixelRatio, state.dpr);
    gl.uniform1f(point.locations.uPointGain, settings.pointGain);
    gl.uniform1f(point.locations.uInkContrast, state.theme.contrast);
    gl.uniform3fv(point.locations.uInk, state.theme.ink);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindBuffer(gl.ARRAY_BUFFER, agents);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, state.count);
  }

  function drawFullscreen(entry, bind) {
    gl.useProgram(entry.program);
    bindQuad();
    bind(entry.locations);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function render() {
    if (!usePost) {
      drawScene(null, canvas.width, canvas.height);
      return;
    }

    if (targets.multisample) {
      drawScene(targets.multisample.framebuffer, targets.width, targets.height);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, targets.multisample.framebuffer);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, targets.scene.framebuffer);
      gl.blitFramebuffer(0, 0, targets.width, targets.height, 0, 0, targets.width, targets.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      drawScene(targets.scene.framebuffer, targets.width, targets.height);
    }

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // Circle of confusion, then one bokeh pass, then present. Both run at the
    // reduced scale so the disc sampling stays cheap.
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets.coc.framebuffer);
    gl.viewport(0, 0, targets.width, targets.height);
    drawFullscreen(coc, locations => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets.depth);
      gl.uniform1i(locations.uDepth, 0);
      gl.uniform1f(locations.uNear, CAMERA_NEAR);
      gl.uniform1f(locations.uFar, CAMERA_FAR);
      gl.uniform1f(locations.uFocusDistance, viewDistance(0, 0, settings.focusDepth));
      gl.uniform1f(locations.uFocusRange, settings.focusRange);
    });

    gl.bindFramebuffer(gl.FRAMEBUFFER, targets.bokeh.framebuffer);
    gl.viewport(0, 0, targets.width, targets.height);
    drawFullscreen(bokeh, locations => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets.scene.color);
      gl.uniform1i(locations.uScene, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, targets.coc.color);
      gl.uniform1i(locations.uCoc, 1);
      gl.uniform2f(locations.uTexel, 1 / targets.width, 1 / targets.height);
      gl.uniform1f(locations.uMaxRadius, settings.bokehScale * settings.bokehRadius);
      gl.uniform1f(locations.uCentreWeight, settings.bokehCentre);
      gl.uniform1f(locations.uContrast, settings.blurContrast);
      gl.uniform1f(locations.uInvert, state.theme.dark ? 0 : 1);
    });

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    drawFullscreen(blit, locations => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets.bokeh.color);
      gl.uniform1i(locations.uScene, 0);
    });
  }

  /* --------------------------------------------------------------- the clock */

  function tick(now) {
    state.handle = requestAnimationFrame(tick);
    const delta = state.lastFrame ? Math.min((now - state.lastFrame) / 1000, 0.05) : 0;
    state.lastFrame = now;
    state.elapsed += delta;
    updateFraming(sceneClock(state.elapsed));
    render();
  }

  function syncAgents() {
    if (uploadedCapacity === capacity) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, agents);
    // Reallocate rather than update: the framing pass and the draw pass have to
    // see the same silhouette, and a shorter field means a different buffer.
    gl.bufferData(gl.ARRAY_BUFFER, thinAgents(AGENTS, capacity), gl.STATIC_DRAW);
    uploadedCapacity = capacity;
  }

  function measure() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(maxPixelRatio, window.devicePixelRatio || 1);
    const geometryChanged = width !== state.width || height !== state.height || dpr !== state.dpr || !targets.scene;

    state.count = dynamicCount(width, height, capacity, settings);
    if (!geometryChanged) { syncAgents(); return false; }

    state.width = width;
    state.height = height;
    state.dpr = dpr;
    state.narrowBox = { x: 0, y: 0, width: 2 * Math.max(1, width - 48) / width, height: 1.35 };
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    cameraState.aspect = width / Math.max(height, 1);
    updateCameraProjection();
    updateCameraTransform(layoutNow());
    framingCache.clear();
    state.framingReference = measureFraming(0);

    syncAgents();
    resizeTargets(
      Math.max(1, Math.round(canvas.width * settings.resolutionScale)),
      Math.max(1, Math.round(canvas.height * settings.resolutionScale)),
    );
    render();
    return true;
  }

  // Applied when the shared budget changes how much the effect may spend.
  function configure(next = {}) {
    if (next.capacity != null) capacity = Math.max(0, Math.min(AGENT_COUNT, next.capacity));
    if (next.maxPixelRatio != null) maxPixelRatio = Math.max(1, next.maxPixelRatio);
    if (next.postprocessing != null) usePost = settings.postprocessing && next.postprocessing !== false;
    if (next.multisampling != null) multisample = Math.max(0, Math.min(4, next.multisampling));
    measure();
  }

  function start() {
    if (state.running) return;
    state.running = true;
    state.lastFrame = 0;
    state.handle = requestAnimationFrame(tick);
  }

  function stop() {
    if (!state.running) return;
    state.running = false;
    cancelAnimationFrame(state.handle);
  }

  const onResize = () => { measure(); };
  window.addEventListener('resize', onResize, { passive: true });
  const observer = 'ResizeObserver' in window ? new ResizeObserver(onResize) : null;
  observer?.observe(canvas);

  updateCameraTransform(layoutNow());
  measure();

  return {
    start,
    stop,
    configure,
    get particleCount() { return state.count; },
  };
}
