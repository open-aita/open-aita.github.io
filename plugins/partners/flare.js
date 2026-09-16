/* The Network maps fire one burst of arcs out of an origin anchor, then it is gone.
   Kept out of client.js because the geometry, the timing and the layer are local to the
   effect: the caller hands over points it has already projected. */

const FLIGHT = 1500;     // every arc is in the air for the same time, so they all land together
const HOLD = 2000;       // the completed fan sits lit before it leaves
const FADE = 1100;
const PULSE = 1400;
const MIN_ARC = 4;       // targets sitting on the origin have no arc to draw

export function createFlare(reducedMotion) {
  // One burst per layer: the two maps fire at different moments, and the later one must not
  // wipe the arcs the earlier one still has in the air.
  const bursts = new Map();

  function stop(burst) {
    for (const animation of burst.playing) { try { animation.cancel(); } catch { /* already finished */ } }
    for (const node of burst.nodes) node.remove();
  }

  function clearLayer(svg) {
    const burst = svg && bursts.get(svg);
    if (!burst) return;
    stop(burst);
    bursts.delete(svg);
  }

  function clear() {
    for (const svg of [...bursts.keys()]) clearLayer(svg);
  }

  // Both tangents are stated as angles off the arc's own chord and turn the same way round: the
  // arc leaves pitched up and arrives pitched down, coming onto its marker like something
  // thrown. Pitching the arrival the other way is what removes the reversed flick at the tip —
  // an arc that leaves climbing and arrives level has to turn back on itself to get there.
  const LAUNCH_MIN = 14 * Math.PI / 180, LAUNCH_MAX = 62 * Math.PI / 180;
  const ARRIVE_MIN = 6 * Math.PI / 180, ARRIVE_MAX = 26 * Math.PI / 180;
  const TANGENT_MAX = 0.40, TANGENT_MIN = 0.22;   // control lengths, as fractions of the chord

  const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

  function pointAt(p0, p1, p2, p3, t) {
    const m = 1 - t;
    return {
      x: m*m*m*p0.x + 3*m*m*t*p1.x + 3*m*t*t*p2.x + t*t*t*p3.x,
      y: m*m*m*p0.y + 3*m*m*t*p1.y + 3*m*t*t*p2.y + t*t*t*p3.y,
    };
  }

  function inside(p0, p1, p2, p3, box) {
    for (let i = 0; i <= 24; i += 1) {
      const point = pointAt(p0, p1, p2, p3, i / 24);
      if (point.x < 8 || point.x > box.width - 8 || point.y < 8 || point.y > box.height - 8) return false;
    }
    return true;
  }

  // A cubic doubles back where its heading stops turning one way. Reining in both controls keeps
  // the heading sweeping in a single direction, so the arc stays one clean bend.
  function oneWay(p0, p1, p2, p3) {
    let sign = 0, previous = 0;
    for (let i = 1; i <= 48; i += 1) {
      const t = i / 49, m = 1 - t;
      const vx = m*m*(p1.x - p0.x) + 2*m*t*(p2.x - p1.x) + t*t*(p3.x - p2.x);
      const vy = m*m*(p1.y - p0.y) + 2*m*t*(p2.y - p1.y) + t*t*(p3.y - p2.y);
      const angle = Math.atan2(vy, vx);
      if (i === 1) { previous = angle; continue; }
      let delta = angle - previous;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      previous = angle;
      if (Math.abs(delta) < 1e-4) continue;
      const direction = Math.sign(delta);
      if (!sign) sign = direction;
      else if (direction !== sign) return false;
    }
    return true;
  }

  // Arcs leaving in nearly the same direction are the ones that need telling apart, so the
  // pitch is graded inside each direction band rather than across the whole fan: a band of four
  // still spans the entire range, where a global ranking would have squeezed it into a corner.
  const BAND = 35 * Math.PI / 180;

  function bands(aimed) {
    const out = [];
    let band = null;
    for (const point of aimed) {
      if (!band || point.bearing - band[band.length - 1].bearing > BAND) out.push(band = []);
      band.push(point);
    }
    return out;
  }

  function arcPath(from, to, rank, box) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length, uy = dy / length;
    const launch = LAUNCH_MIN + (LAUNCH_MAX - LAUNCH_MIN) * rank;
    const arrive = ARRIVE_MIN + (ARRIVE_MAX - ARRIVE_MIN) * rank;
    const reach = length * (TANGENT_MAX - (TANGENT_MAX - TANGENT_MIN) * rank);
    let scale = 1;
    let c1, c2;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const [lx, ly] = rot(ux, uy, launch);
      const [ax, ay] = rot(ux, uy, -arrive);
      c1 = { x: from.x + lx * reach * scale, y: from.y + ly * reach * scale };
      c2 = { x: to.x - ax * reach * scale, y: to.y - ay * reach * scale };
      // A steep ray can swing out of the frame, which clips it mid-flight; pull it back in.
      if ((!box || inside(from, c1, c2, to, box)) && oneWay(from, c1, c2, to)) break;
      scale *= 0.8;
    }
    return `M ${from.x} ${from.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`;
  }

  function element(tag, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    return node;
  }

  /** @returns {number} ms until the burst has fully left, or 0 when nothing was fired. */
  function fire(svg, from, points) {
    if (!svg || !from || reducedMotion.matches) return 0;
    clearLayer(svg);
    const aimed = points
      .filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y)
        && Math.hypot(point.x - from.x, point.y - from.y) >= MIN_ARC)
      .map(point => {
        const dx = point.x - from.x, dy = point.y - from.y;
        return { x: point.x, y: point.y, length: Math.hypot(dx, dy), bearing: Math.atan2(dy, dx) };
      })
      .sort((a, b) => a.bearing - b.bearing);
    if (!aimed.length) return 0;

    const box = svg.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);

    // The fan leaves in arrival order but holds as one figure: a short arc waits for the far
    // ones instead of fading out while they are still in flight.
    const arcs = [];
    for (const band of bands(aimed)) {
      band.forEach((point, index) => {
        arcs.push(arcPath(from, point, band.length > 1 ? index / (band.length - 1) : .5, box));
      });
    }

    const burst = { playing: [], nodes: [] };
    bursts.set(svg, burst);
    for (const arc of arcs) {
      // A wide, dim copy under the bright stroke reads as glow without an SVG filter.
      for (const layer of [{ cls: 'flare-glow', peak: .26 }, { cls: 'flare-line', peak: 1 }]) {
        const node = element('path', { class: layer.cls, d: arc });
        svg.append(node);
        burst.nodes.push(node);
        const total = node.getTotalLength();
        node.style.strokeDasharray = `${total}`;
        node.style.strokeDashoffset = `${total}`;
        burst.playing.push(node.animate(
          [{ strokeDashoffset: total }, { strokeDashoffset: 0 }],
          { duration: FLIGHT, easing: 'linear', fill: 'forwards' }));
        burst.playing.push(node.animate(
          [{ opacity: layer.peak }, { opacity: 0 }],
          { duration: FADE, delay: FLIGHT + HOLD, easing: 'ease-out', fill: 'forwards' }));
      }
    }

    const pulse = element('circle', { class: 'flare-origin', cx: from.x, cy: from.y, r: 44 });
    svg.append(pulse);
    burst.nodes.push(pulse);
    burst.playing.push(pulse.animate(
      [{ transform: 'scale(.06)', opacity: .85 }, { transform: 'scale(1)', opacity: 0 }],
      { duration: PULSE, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' }));

    return FLIGHT + HOLD + FADE + 60;
  }

  return { fire, clear, clearLayer };
}
