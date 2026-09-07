const doc = document;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Queue nearby WebGL startup; loading is separate from visibility and playback.
  const effectJobs = [];
  let effectBusy = false, effectScheduled = false, pageActive = true;
  const effectSync = [];
  const runEffectJob = () => {
    effectScheduled = false;
    if (effectBusy || doc.hidden || !pageActive || !effectJobs.length) return;
    effectBusy = true;
    Promise.resolve(effectJobs.shift()()).finally(() => {
      effectBusy = false;
      scheduleEffectJob();
    });
  };
  const scheduleEffectJob = () => {
    if (effectBusy || effectScheduled || !effectJobs.length || doc.hidden || !pageActive) return;
    effectScheduled = true;
    if ('requestIdleCallback' in window) window.requestIdleCallback(runEffectJob, { timeout: 1200 });
    else window.setTimeout(runEffectJob, 100);
  };
  export const prepareEffect = (frame, prefix, { warmup = false } = {}) => {
    if (!(frame instanceof HTMLIFrameElement) || reduceMotion) return;
    let visible = false, queued = false;
    const sync = () => {
      if (!frame.hasAttribute('src')) return;
      frame.contentWindow?.postMessage({
        type: `${prefix}-active`, active: visible && !doc.hidden && pageActive
      }, '*');
    };
    effectSync.push(sync);
    const enqueue = () => {
      if (queued || !frame.dataset.src) return;
      queued = true;
      effectJobs.push(() => new Promise(resolve => {
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          clearTimeout(timeout);
          resolve();
        };
        const ready = event => {
          if (event.source !== frame.contentWindow || event.data !== `${prefix}-ready`) return;
          frame.classList.add('is-loaded');
          sync();
          window.removeEventListener('message', ready);
          release();
        };
        window.addEventListener('message', ready);
        // An unavailable effect must not hold up the next chapter's startup.
        const timeout = window.setTimeout(release, 5000);
        frame.addEventListener('load', sync, { once: true });
        frame.addEventListener('error', release, { once: true });
        frame.src = frame.dataset.src;
      }));
      scheduleEffectJob();
    };
    // Warm requested effects only after critical page resources finish loading.
    // The existing idle queue limits initialization; sync still pauses offscreen playback.
    if (warmup) {
      if (doc.readyState === 'complete') enqueue();
      else window.addEventListener('load', enqueue, { once: true });
    }
    if ('IntersectionObserver' in window) {
      const preload = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        enqueue();
        preload.disconnect();
      }, { rootMargin: '400px 0px' });
      preload.observe(frame);
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) enqueue();
        sync();
      }, { threshold: 0 }).observe(frame);
    } else {
      visible = true;
      enqueue();
    }
  };
  const syncEffects = () => { effectSync.forEach(sync => sync()); scheduleEffectJob(); };
  doc.addEventListener('visibilitychange', syncEffects);
  window.addEventListener('pagehide', () => { pageActive = false; syncEffects(); });
  window.addEventListener('pageshow', () => { pageActive = true; syncEffects(); });
