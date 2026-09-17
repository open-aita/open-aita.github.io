/*
  Mounts the cloud field inside its iframe and keeps it in step with the page.

  The host owns playback: it posts aita:output-cloud-active as the banner enters
  and leaves the viewport, and waits for aita:output-cloud-ready before fading
  the frame in. A shared budget watches real frame intervals and steps the
  quality level down or back up; the field reconfigures without restarting, so
  the flock never jumps.
*/
import { createCloudField } from './cloud-field.js';

const HOST_MESSAGE = 'aita:output-cloud-active';
const READY_MESSAGE = 'aita:output-cloud-ready';
const OVERRIDE_KEY = 'aita.cloudField.quality';
const OVERRIDE_PARAM = 'quality';
const POST_PARAM = 'post';
const BOKEH_PARAM = 'bokeh';
const FOCUS_PARAM = 'focus';
const GAIN_PARAM = 'gain';
const RES_PARAM = 'res';

// One step per quality level: how many agents, how dense the pixels, and whether
// the depth-of-field pass runs at all.
const LEVELS = [
  { capacity: 12000, maxPixelRatio: 1, postprocessing: false, multisampling: 0 },
  { capacity: 28000, maxPixelRatio: 1.25, postprocessing: true, multisampling: 0 },
  { capacity: 40000, maxPixelRatio: 1.5, postprocessing: true, multisampling: 2 },
];

const root = document.getElementById('hero-root');

function readOverride() {
  const params = new URLSearchParams(window.location.search); let stored = null;
  try {
    stored = window.localStorage.getItem(OVERRIDE_KEY);
  } catch {
    // Storage can be blocked; the override is optional either way.
  }
  const value = params.has(OVERRIDE_PARAM) ? params.get(OVERRIDE_PARAM) : stored;
  if (value === null) return null; const level = Number(value);
  return Number.isInteger(level) && level >= 0 && level <= 3 ? level : null;
}

function showFallback() {
  root.textContent = ''; const notice = document.createElement('p'); notice.className = 'fallback';
  notice.textContent = '当前浏览器无法渲染粒子云，页面其余内容不受影响。'; root.append(notice);
}

function mount() {
  const override = readOverride();
  if (override === 0) { showFallback(); return; }

  const canvas = document.createElement('canvas'); canvas.className = 'size-full';
  canvas.setAttribute('aria-hidden', 'true'); const host = document.createElement('div');
  host.className = 'size-full'; host.dataset.effect = 'monochrome-murmuration';
  host.dataset.engine = 'webgl2'; host.dataset.particleCount = '0'; host.append(canvas); root.append(host);

  let quality = override === null ? 1 : Math.min(override, LEVELS.length) - 1; const level = LEVELS[quality];
  // ?post=0 renders without the depth-of-field pass; ?bokeh=, ?focus= and ?gain=
  // override its shaping values. Useful when comparing the flock against a
  // reference render.
  const params = new URLSearchParams(window.location.search); const postParam = params.get(POST_PARAM);
  const numeric = key => {
    if (!params.has(key)) return null; const value = Number(params.get(key));
    return Number.isFinite(value) ? value : null;
  }; const bokeh = numeric(BOKEH_PARAM); const focus = numeric(FOCUS_PARAM); const gain = numeric(GAIN_PARAM);
  const res = numeric(RES_PARAM);
  const tuning = {
    ...(bokeh === null ? {} : { bokehScale: bokeh }),
    ...(focus === null ? {} : { focusRange: focus }),
    ...(gain === null ? {} : { pointGain: gain }),
    ...(res === null ? {} : { resolutionScale: res }),
  };
  const field = createCloudField(canvas, {
    capacity: level.capacity, maxPixelRatio: level.maxPixelRatio,
    postprocessing: level.postprocessing && postParam !== '0', multisampling: level.multisampling,
    settings: tuning,
  });
  if (!field) { showFallback(); return; }

  let requested = window.parent === window; let active = false; let announced = false; let sampling = false;

  // Frame-interval sampling only: the field's own loop is the thing measured, so
  // the sampler runs exactly when that loop does.
  const budget = (override === null && window.createAitaEffectBudget)
    ? window.createAitaEffectBudget({
      initial: quality, min: 0, max: LEVELS.length - 1,
      onChange: next => { quality = next; applyQuality(); },
    })
    : null;

  function sample(now) {
    if (!sampling) return; budget.sample(now); window.requestAnimationFrame(sample);
  }

  function sync() {
    const next = requested && !document.hidden;
    // Written before the early return: readers rely on the attribute being
    // present from the first frame, not only after the first transition.
    document.body.dataset.active = String(next); if (next === active) return; active = next;
    if (active) {
      field.start();
      if (budget && !sampling) { sampling = true; budget.reset(); window.requestAnimationFrame(sample); }
    } else {
      field.stop(); sampling = false;
    }
  }

  function applyQuality() {
    const level = LEVELS[quality];
    field.configure({
      ...level, postprocessing: level.postprocessing && postParam !== '0',
    }); document.body.dataset.quality = String(quality);
    host.dataset.particleCount = String(field.particleCount);
    if (!announced && field.particleCount > 0) {
      announced = true; // The host fades the frame in on this signal; the count is already live,
      // so readers of data-particle-count never see a half-built flock.
      window.parent.postMessage(READY_MESSAGE, '*');
    }
  }

  window.addEventListener('message', event => {
    if (event.source !== window.parent || !event.data || event.data.type !== HOST_MESSAGE) return;
    requested = Boolean(event.data.active); sync();
  }); document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { requested = false; sync(); });
  window.addEventListener('pageshow', sync);

  applyQuality(); sync();
}

mount();
