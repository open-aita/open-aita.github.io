
export function mount(root) {
  const doc = document;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

}
