// Adapted from the user-supplied aita-paths.html; no external assets.
export function mount(root) {
  // Growing branch geometry and animation retained from the supplied artwork.
  const CONFIG = Object.freeze({
    seed: 7822,
    speed: 1,                 // 整体速度倍率；建议 0.7 ~ 1.4
    cornerRadius: 13,         // 1440 × 480 设计坐标中的圆角半径
    lineWidth: 1.15,
    maxGrowing: 6,            // 同时明显生长的前端上限
    maxDpr: 2,                // 限制高分屏绘制成本
    fps: 60,
    loop: true,
    lineColor: '168, 187, 209',
    lightColor: '224, 237, 250',
  });
  const W = 1440, H = 480, TAU = Math.PI * 2, STEP = 1 / 60;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const smooth = v => { const x = clamp(v); return x * x * (3 - 2 * x); };
  const mix = (a, b, t) => a + (b - a) * t;
  const rgba = (rgb, a) => `rgba(${rgb},${clamp(a)})`;
  function random(seed) {
    let n = seed >>> 0;
    return () => {
      n += 0x6D2B79F5;
      let t = Math.imul(n ^ n >>> 15, 1 | n);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // 弧长参数化：生长速度通过转角时保持稳定，不以贝塞尔参数近似速度。
  class Route {
    constructor(a, b, pivot, radius) {
      this.parts = [];
      this.length = 0;
      const add = part => {
        if (part.length < 1e-6) return;
        part.from = this.length;
        this.length += part.length;
        part.to = this.length;
        this.parts.push(part);
      };
      const line = (x0, y0, x1, y1) => add({
        kind: 'line', x0, y0, x1, y1, length: Math.hypot(x1 - x0, y1 - y0)
      });
      const arc = (cx, cy, r, angle, sweep) => add({
        kind: 'arc', cx, cy, r, angle, sweep, length: Math.abs(sweep * r)
      });
      if (Math.abs(b.y - a.y) < .01) {
        line(a.x, a.y, b.x, a.y);
      } else {
        const sign = Math.sign(b.y - a.y);
        const p = clamp(pivot, a.x + 8, b.x - 8);
        const r = Math.min(radius, Math.abs(b.y - a.y) / 2, (p - a.x) * .82, (b.x - p) * .82);
        line(a.x, a.y, p - r, a.y);
        arc(p - r, a.y + sign * r, r, -sign * Math.PI / 2, sign * Math.PI / 2);
        line(p, a.y + sign * r, p, b.y - sign * r);
        arc(p + r, b.y - sign * r, r, Math.PI, -sign * Math.PI / 2);
        line(p + r, b.y, b.x, b.y);
      }
      this.path = new Path2D();
      this.trace(this.path, 0, this.length);
    }
    pointOn(p, fraction) {
      const t = clamp(fraction);
      if (p.kind === 'line') return { x: mix(p.x0, p.x1, t), y: mix(p.y0, p.y1, t) };
      const angle = p.angle + p.sweep * t;
      return { x: p.cx + p.r * Math.cos(angle), y: p.cy + p.r * Math.sin(angle) };
    }
    pointAt(distance) {
      const d = clamp(distance, 0, this.length);
      const p = this.parts.find(s => s.to >= d) || this.parts[this.parts.length - 1];
      return this.pointOn(p, (d - p.from) / p.length);
    }
    trace(target, from, to) {
      if (to <= from) return;
      let first = true;
      for (const p of this.parts) {
        const lo = Math.max(from, p.from), hi = Math.min(to, p.to);
        if (hi <= lo) continue;
        const t0 = (lo - p.from) / p.length, t1 = (hi - p.from) / p.length;
        if (first) { const v = this.pointOn(p, t0); target.moveTo(v.x, v.y); first = false; }
        if (p.kind === 'line') {
          const v = this.pointOn(p, t1); target.lineTo(v.x, v.y);
        } else {
          target.arc(p.cx, p.cy, p.r, p.angle + p.sweep * t0, p.angle + p.sweep * t1, p.sweep < 0);
        }
      }
    }
    stroke(ctx, from = 0, to = this.length) {
      if (to <= from) return;
      if (from <= 0 && to >= this.length) ctx.stroke(this.path);
      else { ctx.beginPath(); this.trace(ctx, from, to); ctx.stroke(); }
    }
  }

  class Paths {
    constructor(host) {
      this.host = host;
      this.canvas = host.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d', { alpha: true });
      if (!this.ctx) throw new Error('Canvas 2D unavailable');
      this.media = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced = this.media.matches;
      this.paused = false;
      this.inView = true;
      this.destroyed = false;
      this.raf = null;
      this.lastStamp = null;
      this.lastPaint = 0;
      this.accumulator = 0;
      this.frame = this.frame.bind(this);
      this.onVisibility = () => this.sync();
      this.onMotion = () => {
        this.reduced = this.media.matches;
        this.reset();
        if (this.reduced) this.makeStatic();
        this.render(); this.sync();
      };
      this.resize();
      this.glow = this.makeGlow();
      this.reset();
      if (this.reduced) this.makeStatic();
      this.resizeObserver = new ResizeObserver(() => { this.resize(); this.render(); });
      this.resizeObserver.observe(host);
      this.intersectionObserver = new IntersectionObserver(entries => {
        this.inView = entries[0].isIntersecting;
        this.sync();
      }, { threshold: 0 });
      this.intersectionObserver.observe(host);
      document.addEventListener('visibilitychange', this.onVisibility);
      this.media.addEventListener('change', this.onMotion);
      host.setAttribute('data-ready', '');
      this.render();
      this.sync();
    }
    resize() {
      const rect = this.host.getBoundingClientRect();
      const dpr = Math.min(CONFIG.maxDpr, window.devicePixelRatio || 1);
      this.scale = Math.max(rect.width / W, .01);
      this.compact = rect.width < 640;
      this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      this.tx = this.canvas.width / W;
      this.ty = this.canvas.height / H;
      // 右侧自然渐隐，路径继续延伸到可见画布之外。
      this.edgeMask = this.ctx.createLinearGradient(0, 0, W, 0);
      this.edgeMask.addColorStop(0, '#000');
      this.edgeMask.addColorStop(.87, '#000');
      this.edgeMask.addColorStop(.95, 'rgba(0,0,0,.65)');
      this.edgeMask.addColorStop(1, 'rgba(0,0,0,0)');
    }
    makeGlow() {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 96;
      const ctx = canvas.getContext('2d');
      const g = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
      g.addColorStop(0, 'rgba(225,240,255,.34)');
      g.addColorStop(.14, 'rgba(185,216,248,.17)');
      g.addColorStop(.4, 'rgba(136,178,224,.055)');
      g.addColorStop(1, 'rgba(120,160,205,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 96, 96);
      return canvas;
    }
    node(x, y, depth = 0, terminal = false) {
      return { id: this.serial++, x, y, depth, terminal, born: Infinity, incoming: null };
    }
    edge(from, to, options = {}) {
      const rng = this.rng;
      const path = new Route(from, to, options.pivot ?? from.x + 30 + rng() * 35, CONFIG.cornerRadius);
      const edge = {
        id: this.serial++, from, to, path,
        depth: options.depth ?? to.depth,
        permanent: options.permanent || false,
        exit: options.exit || false,
        group: options.group || null,
        delay: options.delay ?? .18 + rng() * .3,
        velocity: (options.velocity ?? 178) * (.88 + rng() * .26),
        start: Infinity, end: Infinity, state: 'waiting',
      };
      to.incoming = edge;
      return edge;
    }
    reset() {
      this.time = 0;
      this.serial = 0;
      this.rng = random(CONFIG.seed);
      this.accumulator = 0;
      this.lastStamp = null;
      this.origin = this.node(80, 250);
      this.origin.born = 0;
      const fork = this.node(250, 250, 1);
      const upper = this.node(466, 142, 2), lower = this.node(494, 346, 2);
      const anchors = [
        this.node(700, 87, 3), this.node(678, 200, 3),
        this.node(724, 302, 3), this.node(690, 414, 3),
      ];
      const fixed = (a, b, pivot, delay) => this.edge(a, b, { permanent: true, pivot, delay });
      this.base = [
        fixed(this.origin, fork, 150, .32),
        fixed(fork, upper, 290, .20), fixed(fork, lower, 324, .51),
        fixed(upper, anchors[0], 516, .22), fixed(upper, anchors[1], 549, .53),
        fixed(lower, anchors[2], 562, .38), fixed(lower, anchors[3], 538, .19),
      ];
      this.regions = anchors.map((anchor, index) => ({
        anchor, index, generation: 0, garden: null,
        band: [[35, 135], [151, 241], [255, 349], [363, 465]][index],
      }));
      this.edges = [...this.base];
    }
    makeGarden(region) {
      const generation = region.generation++;
      const rng = random(CONFIG.seed + 977 * region.index + 7907 * generation);
      const garden = {
        edges: [], index: region.index, generation, maxDepth: 0,
        retire: Infinity, remove: Infinity, completed: Infinity,
        hold: 3.2 + region.index * 1.25 + rng() * 3.0,
      };
      const [low, high] = region.band;
      const count = this.compact ? 3 : 5 + (rng() > .45 ? 1 : 0);
      const rows = Array.from({ length: count }, (_, i) => mix(low + 6, high - 6, i / (count - 1)) + (rng() - .5) * 3);
      const attach = (parent, child, depth, exit = false) => {
        const edge = this.edge(parent, child, {
          depth, exit, group: garden,
          pivot: parent.x + 25 + rng() * 31,
          delay: .2 + rng() * .38,
          velocity: exit ? 162 : 153 + rng() * 34,
        });
        garden.edges.push(edge);
        garden.maxDepth = Math.max(garden.maxDepth, depth);
      };
      const grow = (parent, indices, depth) => {
        if (indices.length === 1) {
          const y = rows[indices[0]];
          // 中继节点保留较长的水平段；部分节点继续前进，部分节点才分叉。
          let last = parent;
          if (depth < 3) {
            const relay = this.node(1028 + rng() * 83, y, depth);
            attach(parent, relay, depth);
            last = relay;
            depth++;
          }
          const tip = this.node(1240 + rng() * 114, y, depth, true);
          attach(last, tip, depth);
          const beyond = this.node(1500 + rng() * 90, y, depth + 1, true);
          attach(tip, beyond, depth + 1, true);
          return;
        }
        const cut = Math.max(1, Math.min(indices.length - 1,
          Math.round(indices.length * (.44 + rng() * .12))));
        const groups = [indices.slice(0, cut), indices.slice(cut)];
        for (const subset of groups) {
          // 递归划分不重叠的纵向区间，避免独立分支在画面中交叉。
          const y = (rows[subset[0]] + rows[subset[subset.length - 1]]) / 2;
          if (subset.length === 1) {
            grow(parent, subset, depth);
          } else {
            const x = (depth === 1 ? 850 : 1030) + rng() * 59;
            const child = this.node(x, y, depth);
            attach(parent, child, depth);
            grow(child, subset, depth + 1);
          }
        }
      };
      grow(region.anchor, rows.map((_, i) => i), 1);
      region.garden = garden;
      return garden;
    }
    update(dt) {
      this.time += dt;
      const t = this.time;
      for (const edge of this.edges) {
        if (edge.state === 'growing' && t >= edge.end) {
          edge.state = 'done'; edge.to.born = edge.end;
        }
      }
      for (const region of this.regions) {
        if (!Number.isFinite(region.anchor.born)) continue;
        if (!region.garden) {
          this.makeGarden(region);
        } else {
          const g = region.garden;
          if (!Number.isFinite(g.completed) && g.edges.every(e => e.state === 'done')) {
            g.completed = t;
            if (CONFIG.loop) {
              g.retire = t + g.hold;
              g.remove = g.retire + g.maxDepth * .52 + 2.6;
            }
          }
          if (t >= g.remove) this.makeGarden(region);
        }
      }
      this.edges = this.base.concat(...this.regions.map(r => r.garden ? r.garden.edges : []));
      const limit = this.compact ? Math.min(4, CONFIG.maxGrowing) : CONFIG.maxGrowing;
      let free = limit - this.edges.filter(e => e.state === 'growing').length;
      if (free > 0) {
        const ready = this.edges.filter(e => e.state === 'waiting' && t >= e.from.born + e.delay);
        ready.sort((a, b) => (a.from.born + a.delay) - (b.from.born + b.delay) || a.id - b.id);
        for (const edge of ready) {
          if (free-- <= 0) break;
          edge.state = 'growing';
          edge.start = t;
          edge.end = t + edge.path.length / edge.velocity;
        }
      }
    }
    makeStatic() {
      this.time = 20;
      this.origin.born = -20;
      for (const edge of this.base) {
        edge.state = 'done'; edge.start = -20; edge.end = -10; edge.to.born = -10;
      }
      for (const region of this.regions) {
        const g = this.makeGarden(region);
        for (const edge of g.edges) {
          edge.state = 'done'; edge.start = -20; edge.end = -10; edge.to.born = -10;
        }
      }
      this.edges = this.base.concat(...this.regions.map(r => r.garden.edges));
    }
    opacity(edge) {
      if (!edge.group || this.time < edge.group.retire) return 1;
      // 先淡出叶端，再逐级向父路径收敛，避免父路径消失、子节点悬空。
      const begin = edge.group.retire + (edge.group.maxDepth - edge.depth) * .52;
      return 1 - smooth((this.time - begin) / 2.6);
    }
    distance(edge) {
      return edge.state === 'done' ? edge.path.length
        : clamp((this.time - edge.start) / (edge.end - edge.start)) * edge.path.length;
    }
    glowAt(x, y, diameter, alpha = 1) {
      this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(this.glow, x - diameter / 2, y - diameter / 2, diameter, diameter);
      this.ctx.globalAlpha = 1;
    }
    drawNode(node, edge) {
      const age = this.time - node.born;
      if (age < 0 || !Number.isFinite(age) || edge?.exit) return;
      const alpha = edge ? this.opacity(edge) : 1;
      if (alpha < .005) return;
      const ctx = this.ctx;
      const arrived = smooth(age / .2);
      const flash = Math.exp(-age * 2.65);
      const r = Math.max(node.terminal ? 2.7 : 2.25, .85 / this.scale);
      const root = node === this.origin;
      const radius = root ? Math.max(3.2, 1.5 / this.scale) : r;
      if (flash > .025 || root) {
        this.glowAt(node.x, node.y, root ? 42 : 30 + 13 * flash,
          alpha * (root ? .58 + .05 * Math.sin(this.time * .75) : flash * .94));
      }
      ctx.beginPath(); ctx.arc(node.x, node.y, radius + (root ? 3.5 : 1.4), 0, TAU);
      ctx.strokeStyle = rgba(CONFIG.lineColor, (root ? .35 : .14 + .36 * flash) * alpha * arrived);
      ctx.lineWidth = Math.max(.65, .45 / this.scale); ctx.stroke();
      ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, TAU);
      ctx.fillStyle = '#0c1119'; ctx.fill();
      ctx.lineWidth = Math.max(.9, .55 / this.scale);
      ctx.strokeStyle = rgba(CONFIG.lightColor, (root ? .9 : .38 + .45 * flash) * alpha * arrived);
      ctx.stroke();
      if (!node.terminal || root) {
        ctx.beginPath(); ctx.arc(node.x, node.y, radius * (root ? .66 : .51), 0, TAU);
        ctx.fillStyle = rgba(CONFIG.lightColor, (root ? .94 : .61 + .28 * flash) * alpha * arrived);
        ctx.fill();
      }
    }
    drawFront(edge) {
      const ctx = this.ctx, d = this.distance(edge), alpha = this.opacity(edge);
      const head = edge.path.pointAt(d);
      const tail = Math.min(56, d);
      if (tail <= 0) return;
      // 仅照亮新生长前端附近，不使用全路径霓虹或大范围蓝色光晕。
      ctx.lineWidth = Math.max(4.5, 2 / this.scale);
      ctx.strokeStyle = rgba(CONFIG.lineColor, .055 * alpha);
      edge.path.stroke(ctx, Math.max(0, d - tail), d);
      const pieces = 10;
      for (let i = 0; i < pieces; i++) {
        const p = (i + 1) / pieces;
        ctx.lineWidth = Math.max(CONFIG.lineWidth + .27, .76 / this.scale);
        ctx.strokeStyle = rgba(CONFIG.lightColor, (.045 + p * p * .75) * alpha);
        edge.path.stroke(ctx, Math.max(0, d - tail + tail * i / pieces), d - tail + tail * (i + 1) / pieces);
      }
      const endTaper = edge.exit ? 1 : .8 + .2 * Math.sin(clamp(d / edge.path.length) * Math.PI);
      this.glowAt(head.x, head.y, 30, alpha * .86 * endTaper);
      ctx.beginPath(); ctx.arc(head.x, head.y, Math.max(1.55, .83 / this.scale), 0, TAU);
      ctx.fillStyle = rgba(CONFIG.lightColor, .97 * alpha); ctx.fill();
    }
    render() {
      if (this.destroyed || !this.edges) return;
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(this.tx, 0, 0, this.ty, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const edge of this.edges) {
        if (edge.state === 'waiting') continue;
        const opacity = this.opacity(edge);
        if (opacity < .005) continue;
        const settled = edge.state === 'done' ? Math.exp(-(this.time - edge.end) / 2.1) : .85;
        const hierarchy = edge.permanent ? .52 - edge.depth * .017 : .37;
        ctx.strokeStyle = rgba(CONFIG.lineColor, (hierarchy + settled * .17) * opacity);
        ctx.lineWidth = Math.max(CONFIG.lineWidth + (edge.permanent ? .1 : 0), .62 / this.scale);
        edge.path.stroke(ctx, 0, this.distance(edge));
      }
      for (const edge of this.edges) if (edge.state === 'growing') this.drawFront(edge);
      for (const edge of this.edges) if (edge.state === 'done') this.drawNode(edge.to, edge);
      this.drawNode(this.origin, null);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = this.edgeMask; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    canRun() {
      return !this.destroyed && !this.paused && !this.reduced && this.inView && !document.hidden;
    }
    sync() {
      if (!this.canRun()) {
        if (this.raf !== null) cancelAnimationFrame(this.raf);
        this.raf = null; this.lastStamp = null;
      } else if (this.raf === null) {
        this.lastStamp = null;
        this.raf = requestAnimationFrame(this.frame);
      }
    }
    frame(stamp) {
      this.raf = null;
      if (!this.canRun()) return;
      if (this.lastStamp !== null) {
        this.accumulator += Math.min((stamp - this.lastStamp) / 1000, .075) * CONFIG.speed;
        while (this.accumulator >= STEP) { this.update(STEP); this.accumulator -= STEP; }
      }
      this.lastStamp = stamp;
      if (stamp - this.lastPaint >= 1000 / CONFIG.fps - .6) {
        this.render(); this.lastPaint = stamp;
      }
      this.raf = requestAnimationFrame(this.frame);
    }
    pause() { this.paused = true; this.sync(); }
    play() { this.paused = false; this.sync(); }
    restart() {
      if (this.destroyed) return;
      this.reset();
      if (this.reduced) this.makeStatic();
      this.render(); this.sync();
    }
    seek(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 600) {
        throw new RangeError('seconds must be between 0 and 600');
      }
      if (this.destroyed) return;
      this.pause(); this.reset();
      if (this.reduced) this.makeStatic();
      else for (let i = 0, n = Math.round(seconds / STEP); i < n; i++) this.update(STEP);
      this.render();
    }
    inspect() {
      return {
        time: this.time, paused: this.paused, reducedMotion: this.reduced,
        compact: this.compact, edges: this.edges.length,
        growing: this.edges.filter(e => e.state === 'growing').length,
        reached: this.edges.filter(e => e.state === 'done' && !e.exit).length + 1,
        generations: this.regions.map(r => r.generation),
        canvas: [this.canvas.width, this.canvas.height],
      };
    }
    destroy() {
      if (this.destroyed) return;
      this.pause(); this.destroyed = true;
      this.resizeObserver.disconnect(); this.intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.media.removeEventListener('change', this.onMotion);
      this.canvas.width = this.canvas.height = 1;
      this.host.removeAttribute('data-ready');
      this.edges = []; this.regions = []; this.base = [];
    }
  }
  const effect = new Paths(root.querySelector('.aita-paths'));
  return () => effect.destroy();
}
