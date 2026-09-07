
export function mount(root) {
  const doc = document;
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Blink only while the terminal is visible; CSS handles reduced motion.
  const terminal = root.querySelector(".terminal-line");
  if (terminal) {
    let terminalVisible = false;
    const syncCursor = () => terminal.classList.toggle("is-cursor-active", terminalVisible && !doc.hidden);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        terminalVisible = entry.isIntersecting;
        syncCursor();
      }).observe(terminal);
    } else {
      terminalVisible = true;
      syncCursor();
    }
    doc.addEventListener("visibilitychange", syncCursor);
  }

  const scene = root.querySelector(".hero-scene");
  const images = [...root.querySelectorAll(".hero-background")];
  if (!scene || images.length !== 2) return;
  let visible = false;
  let ready = false;
  let frames;
  let current = 0;
  let timer;
  let frame;
  let lastHover = 0;
  const control = scene.querySelector('.hero-switch');
  const canvas = control.querySelector('.hero-tear-layer');
  const ctx = canvas.getContext('2d');
  const blockCanvas = control.querySelector('.hero-block-layer');
  const blockCtx = blockCanvas.getContext('2d');
  const stopGlitch = () => {
    cancelAnimationFrame(frame);
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    blockCtx?.clearRect(0, 0, blockCanvas.width, blockCanvas.height);
  };
  // Draw only short bursts. The slices keep the photograph's original palette.
  const glitch = (source, pointer) => {
    stopGlitch();
    if (!ctx || !blockCtx || motionPreference.matches || doc.hidden || !visible) return;
    const rect = control.getBoundingClientRect();
    canvas.width = Math.min(1920, Math.round(rect.width));
    canvas.height = Math.round(rect.height * canvas.width / rect.width);
    blockCanvas.width = canvas.width;
    blockCanvas.height = canvas.height;
    const w = canvas.width, h = canvas.height;
    const scale = Math.max(w / source.width, h / source.height);
    const sw = w / scale, sh = h / scale;
    const sx = (source.width - sw) / 2, sy = (source.height - sh) / 2;
    const start = performance.now();
    const duration = pointer ? 180 : 480;
    let last = -Infinity;
    const draw = now => {
      const progress = (now - start) / duration;
      if (progress >= 1) { stopGlitch(); return; }
      if (now - last >= 40) {
        last = now;
        ctx.globalAlpha = 1;
        // Replace the background with opaque image pixels, not a blended ghost.
        ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
        for (let band = 0; band < (pointer ? 3 : 9); band++) {
          const bh = Math.min(h, (pointer ? 8 : h * .035) + Math.random() * h * .055);
          const y = pointer ? pointer.y * h + (band - 1) * 18 : h * (band + .35) / 9;
          const py = Math.max(0, Math.min(h - bh, y));
          const offset = (band % 2 ? -1 : 1) * w * (pointer ? .018 : .035 + Math.random() * .045) * (1 - progress);
          const bw = pointer ? Math.min(w, 240) : w;
          const px = pointer ? Math.max(0, Math.min(w - bw, pointer.x * w - bw / 2)) : 0;
          ctx.save();
          ctx.beginPath();
          ctx.rect(px, py, bw, bh);
          ctx.clip();
          // Wrap the exposed edge with image pixels; never leave a black gap.
          ctx.drawImage(source, sx, sy, sw, sh, offset, 0, w, h);
          ctx.drawImage(source, sx, sy, sw, sh, offset > 0 ? offset - w : offset + w, 0, w, h);
          ctx.restore();
        }
        blockCtx.clearRect(0, 0, w, h);
        blockCtx.globalAlpha = Math.min(1, (1 - progress) * 2.5);
        for (let i = 0; i < (pointer ? 24 : 100); i++) {
          const x = pointer ? pointer.x * w + (Math.random() - .5) * 160 : Math.random() * w;
          const y = pointer ? pointer.y * h + (Math.random() - .5) * 64 : Math.random() * h;
          const px = Math.max(0, Math.min(w - 1, x));
          const bh = 2 + Math.random() * 5;
          const py = Math.max(0, Math.min(h - bh, y));
          if (i % 2 === 0) {
            blockCtx.fillStyle = ['#bcecff', '#f4fbff', '#d8f4ff'][i % 3];
            const blockWidth = 10 + Math.random() * 42;
            const blockHeight = 3 + Math.random() * 5;
            blockCtx.fillRect(px, py, blockWidth, blockHeight);
            blockCtx.fillStyle = '#ffffff';
            blockCtx.fillRect(px, py, blockWidth, 1);
          }
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
  };
  const switchBackground = () => {
    if (!ready) return;
    const previous = images[current];
    previous.classList.remove('is-current');
    current = 1 - current;
    images[current].classList.add('is-current');
    syncBackground();
    glitch(frames[current]);
  };
  const syncBackground = () => {
    clearTimeout(timer);
    stopGlitch();
    if (!ready || !visible || doc.hidden || motionPreference.matches) return;
    timer = setTimeout(switchBackground, 6000);
  };
  control.addEventListener('click', switchBackground);
  control.addEventListener('pointermove', event => {
    if (!ready || event.pointerType !== 'mouse' || performance.now() - lastHover < 240) return;
    lastHover = performance.now();
    const rect = control.getBoundingClientRect();
    glitch(frames[current], { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height });
  });
  control.addEventListener('pointerleave', stopGlitch);
  Promise.all(images.map(async image => {
    await image.decode();
    return createImageBitmap(image);
  })).then(bitmaps => {
    frames = bitmaps;
    ready = true;
    control.disabled = false;
    syncBackground();
  }).catch(() => {}); // Keep the initial image if the alternate cannot load.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncBackground();
    }).observe(scene);
  } else {
    visible = true;
  }
  doc.addEventListener("visibilitychange", syncBackground);
  motionPreference.addEventListener("change", syncBackground);
}
