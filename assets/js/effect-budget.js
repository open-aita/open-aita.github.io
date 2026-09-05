/* Shared by the two standalone effects. No timer or animation loop of its own. */
(() => {
  'use strict';
  window.createAitaEffectBudget = ({ initial = 1, min = 0, max = 2, onChange = () => {} } = {}) => {
    let level = Math.max(min, Math.min(max, initial));
    let last = null, warmup = 0, elapsed = 0, frames = 0, slow = 0, fast = 0;
    const reset = () => { last = null; warmup = elapsed = frames = slow = fast = 0; };
    return {
      get level() { return level; },
      reset,
      sample(now) {
        if (last === null) { last = now; return level; }
        const delta = now - last;
        last = now;
        if (!(delta > 0)) return level;
        // Measure real callback intervals, never the clamped simulation timestep.
        if (warmup < 2000) { warmup += delta; return level; }
        elapsed += delta;
        frames++;
        if (elapsed < 2000) return level;
        const fps = frames * 1000 / elapsed;
        slow = fps < 45 ? slow + 1 : 0;
        fast = fps >= 55 ? fast + 1 : 0;
        elapsed = frames = 0;
        let next = level;
        if (slow >= 2 && level > min) next--;
        // Recovery requires 20 seconds of sustained headroom, avoiding oscillation.
        else if (fast >= 10 && level < max) next++;
        if (next !== level) {
          level = next;
          reset();
          onChange(level);
        }
        return level;
      }
    };
  };
})();
