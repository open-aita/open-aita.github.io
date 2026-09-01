(() => {
  "use strict";

  const doc = document;
  const body = doc.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Header state.
  const header = doc.querySelector("[data-header]");
  const updateScrollUI = () => {
    const y = window.scrollY || doc.documentElement.scrollTop;
    header?.classList.toggle("is-scrolled", y > 16);
  };
  updateScrollUI();
  window.addEventListener("scroll", updateScrollUI, { passive: true });
  window.addEventListener("resize", updateScrollUI, { passive: true });

  // Mobile navigation.
  const menuButton = doc.querySelector("[data-menu-toggle]");
  const mobileMenu = doc.querySelector("[data-mobile-menu]");
  const setMenu = (open) => {
    if (!menuButton || !mobileMenu) return;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.querySelector(".sr-only")?.replaceChildren(open ? "关闭导航菜单" : "打开导航菜单");
    mobileMenu.hidden = !open;
    mobileMenu.setAttribute("aria-hidden", String(!open));
    body.classList.toggle("menu-open", open);
  };
  menuButton?.addEventListener("click", () => {
    setMenu(menuButton.getAttribute("aria-expanded") !== "true");
  });
  mobileMenu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });

  // Progressive reveal. Content remains readable without JavaScript.
  const revealItems = [...doc.querySelectorAll(".reveal")];
  if (!reduceMotion) revealItems.forEach((item) => item.classList.add("is-pending"));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  // Project filtering.
  const filterButtons = [...doc.querySelectorAll("[data-filter]")];
  const projectCards = [...doc.querySelectorAll("[data-project-grid] .project-card")];
  const projectCount = doc.querySelector("[data-project-count]");
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter || "all";
      filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      let visibleCount = 0;
      projectCards.forEach((card) => {
        const categories = (card.dataset.category || "").split(/\s+/);
        const hidden = filter !== "all" && !categories.includes(filter);
        card.hidden = hidden;
        if (!hidden) visibleCount += 1;
      });
      if (projectCount) projectCount.textContent = `${String(visibleCount).padStart(2, "0")} SHOWN`;
    });
  });

  // Accessible image lightbox.
  const lightbox = doc.querySelector("[data-lightbox-dialog]");
  const lightboxImage = lightbox?.querySelector("img");
  const lightboxCaption = lightbox?.querySelector("figcaption");
  const closeLightbox = () => lightbox?.open && lightbox.close();
  doc.querySelectorAll("[data-lightbox]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!lightbox || !lightboxImage || !lightboxCaption) return;
      lightboxImage.src = button.dataset.lightbox || "";
      lightboxImage.alt = button.dataset.caption || "活动图片";
      lightboxCaption.textContent = button.dataset.caption || "";
      if (typeof lightbox.showModal === "function") lightbox.showModal();
      else lightbox.setAttribute("open", "");
    });
  });
  doc.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  // Demo notice keeps unsupported contact details explicit instead of inventing them.
  const demoDialog = doc.querySelector("[data-demo-dialog]");
  doc.querySelector("[data-demo-notice]")?.addEventListener("click", () => {
    if (!demoDialog) return;
    if (typeof demoDialog.showModal === "function") demoDialog.showModal();
    else demoDialog.setAttribute("open", "");
  });
  doc.querySelectorAll("[data-demo-close]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!demoDialog) return;
      if (typeof demoDialog.close === "function") demoDialog.close();
      else demoDialog.removeAttribute("open");
    });
  });
  demoDialog?.addEventListener("click", (event) => {
    if (event.target === demoDialog) demoDialog.close();
  });

  // Section-aware navigation.
  const trackedSections = ["about", "research", "outputs", "network"]
    .map((id) => doc.getElementById(id))
    .filter(Boolean);
  if ("IntersectionObserver" in window && trackedSections.length) {
    const navObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      doc.querySelectorAll(".primary-nav a").forEach((link) => {
        const active = link.getAttribute("href") === `#${visible.target.id}`;
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-20% 0px -65%", threshold: [0.05, 0.2, 0.5] });
    trackedSections.forEach((section) => navObserver.observe(section));
  }

  // Lightweight 3D research field inspired by scientific visualization rather than a video asset.
  const canvas = doc.getElementById("research-field");
  if (canvas instanceof HTMLCanvasElement) {
    const context = canvas.getContext("2d", { alpha: true });
    let width = 1;
    let height = 1;
    let dpr = 1;
    let animationFrame = 0;
    let points = [];

    const makePoints = () => {
      const count = Math.max(160, Math.min(520, Math.round((width * height) / 3200)));
      points = Array.from({ length: count }, (_, index) => {
        const band = index % 7;
        return {
          x: Math.random() * 2 - 1,
          y: Math.random() * 1.5 - 0.75,
          z: Math.random() * 1.05 + 0.02,
          size: Math.random() * 1.25 + 0.45,
          band
        };
      });
    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
      makePoints();
    };

    const drawField = (time = 0) => {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      const centerX = width * 0.74;
      const centerY = height * 0.58;
      const spread = Math.min(width, height) * 1.05;
      const speed = reduceMotion ? 0 : 0.000055;

      context.save();
      context.globalCompositeOperation = "lighter";
      points.forEach((point) => {
        const z = reduceMotion ? point.z : ((point.z - time * speed) % 1.05 + 1.05) % 1.05 + 0.015;
        const perspective = 0.12 + z * z;
        const curve = Math.sin((point.y * 2.8) + (point.x * 1.6)) * 0.12;
        const px = centerX + point.x * spread * perspective;
        const py = centerY + (point.y + curve * z) * spread * perspective * 0.58;
        if (px < -20 || px > width + 20 || py < -20 || py > height + 20) return;

        const alpha = Math.min(0.8, 0.05 + z * 0.52);
        const radius = point.size * (0.35 + z * 1.25);
        const hue = point.band === 0 ? "143, 169, 180" : "224, 228, 220";
        context.fillStyle = `rgba(${hue}, ${alpha})`;
        context.fillRect(px, py, radius, radius);
      });
      context.restore();

      // Technical horizon lines.
      context.strokeStyle = "rgba(190, 196, 188, .07)";
      context.lineWidth = 1;
      for (let i = 0; i < 5; i += 1) {
        context.beginPath();
        const y = centerY + i * 42;
        context.moveTo(width * 0.44, y);
        context.quadraticCurveTo(width * 0.74, y + i * 16, width * 1.04, y - 20 + i * 28);
        context.stroke();
      }

      if (!reduceMotion) animationFrame = requestAnimationFrame(drawField);
    };

    resizeCanvas();
    drawField();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) cancelAnimationFrame(animationFrame);
      else if (!reduceMotion) animationFrame = requestAnimationFrame(drawField);
    });
  }

  // Dot-matrix footer wordmark; particles spring home and scatter around the pointer.
  const dotsCanvas = doc.getElementById("footer-dots");
  if (dotsCanvas instanceof HTMLCanvasElement) {
    const dctx = dotsCanvas.getContext("2d");
    const DOT_TEXT = "走向无限智能";
    let dw = 1;
    let dh = 1;
    let dots = [];
    let dotsFrame = 0;
    let dotsVisible = false;
    let pointerX = -9999;
    let pointerY = -9999;

    const buildDots = () => {
      const rect = dotsCanvas.getBoundingClientRect();
      dw = Math.max(1, Math.round(rect.width));
      dh = Math.max(1, Math.round(rect.height));
      const ddpr = Math.min(window.devicePixelRatio || 1, 2);
      dotsCanvas.width = dw * ddpr;
      dotsCanvas.height = dh * ddpr;
      dctx?.setTransform(ddpr, 0, 0, ddpr, 0, 0);

      const off = doc.createElement("canvas");
      off.width = dw;
      off.height = dh;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      const fontSize = Math.min(dh * 0.58, (dw / DOT_TEXT.length) * 1.08);
      octx.font = `600 ${fontSize}px "Geist", "Inter", "PingFang SC", "Microsoft YaHei", sans-serif`;
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillStyle = "#ffffff";
      octx.fillText(DOT_TEXT, dw / 2, dh / 2 + fontSize * 0.04);
      const pixels = octx.getImageData(0, 0, dw, dh).data;

      dots = [];
      const gap = dw < 620 ? 5 : 6;
      for (let y = 0; y < dh; y += gap) {
        for (let x = 0; x < dw; x += gap) {
          if (pixels[(y * dw + x) * 4 + 3] > 110) {
            dots.push({ hx: x, hy: y, x, y, vx: 0, vy: 0 });
          }
        }
      }
      const ambient = Math.round(dw / 16);
      for (let i = 0; i < ambient; i += 1) {
        dots.push({ hx: Math.random() * dw, hy: Math.random() * dh, x: 0, y: 0, vx: 0, vy: 0, ambient: true });
      }
    };

    const drawDots = () => {
      if (!dctx) return;
      dctx.clearRect(0, 0, dw, dh);
      dots.forEach((dot) => {
        if (dot.ambient) {
          dctx.fillStyle = "rgba(190, 196, 188, .16)";
          dctx.fillRect(dot.hx, dot.hy, 2, 2);
          return;
        }
        const dx = dot.x - pointerX;
        const dy = dot.y - pointerY;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < 8100) {
          const dist = Math.sqrt(dist2) || 1;
          const force = ((90 - dist) / 90) * 3.2;
          dot.vx += (dx / dist) * force;
          dot.vy += (dy / dist) * force;
        }
        dot.vx += (dot.hx - dot.x) * 0.045;
        dot.vy += (dot.hy - dot.y) * 0.045;
        dot.vx *= 0.86;
        dot.vy *= 0.86;
        dot.x += dot.vx;
        dot.y += dot.vy;
        dctx.fillStyle = "rgba(228, 232, 224, .6)";
        dctx.fillRect(dot.x, dot.y, 2, 2);
      });
      if (!reduceMotion && dotsVisible) dotsFrame = requestAnimationFrame(drawDots);
    };

    const startDots = () => {
      cancelAnimationFrame(dotsFrame);
      if (reduceMotion) drawDots();
      else if (dotsVisible) dotsFrame = requestAnimationFrame(drawDots);
    };

    buildDots();
    if (reduceMotion) {
      drawDots();
    } else if ("IntersectionObserver" in window) {
      const dotsObserver = new IntersectionObserver((entries) => {
        dotsVisible = entries.some((entry) => entry.isIntersecting);
        startDots();
      }, { rootMargin: "80px" });
      dotsObserver.observe(dotsCanvas);
    } else {
      dotsVisible = true;
      startDots();
    }

    dotsCanvas.addEventListener("pointermove", (event) => {
      const rect = dotsCanvas.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
    });
    dotsCanvas.addEventListener("pointerleave", () => {
      pointerX = -9999;
      pointerY = -9999;
    });
    window.addEventListener("resize", () => { buildDots(); startDots(); }, { passive: true });
    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) cancelAnimationFrame(dotsFrame);
      else startDots();
    });
  }
})();
