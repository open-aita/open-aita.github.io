import { prepareEffect } from "../../packages/kernel/effects.js";
export function mount(root) {
  const doc = document;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
prepareEffect(root.querySelector("[data-about-field-frame]"), "aita:about-field");
  // Keep the four-phase SVG loop paused outside the viewport and in background tabs.
  const aboutLoop = root.querySelector(".about-system");
  if (aboutLoop && "IntersectionObserver" in window) {
    let aboutLoopVisible = false;
    const syncAboutLoop = () => {
      aboutLoop.classList.toggle("is-loop-active", aboutLoopVisible && !doc.hidden);
    };
    const aboutLoopObserver = new IntersectionObserver(([entry]) => {
      aboutLoopVisible = entry.isIntersecting;
      syncAboutLoop();
    });
    aboutLoopObserver.observe(aboutLoop);
    doc.addEventListener("visibilitychange", syncAboutLoop);
  }

}
