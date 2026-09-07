// Each enhancement loads and fails independently; static chapter content remains usable.
export async function mountChapter(id, load, { near = false } = {}) {
  const root = document.getElementById(id);
  if (!root || root.dataset.enhanced) return;
  if (near && 'IntersectionObserver' in window) {
    root.dataset.enhanced = 'waiting';
    await new Promise(resolve => {
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        resolve();
      }, { rootMargin: '800px 0px' });
      observer.observe(root);
    });
  }
  root.dataset.enhanced = 'loading';
  try {
    const chapter = await load();
    await chapter.mount(root);
    root.dataset.enhanced = 'true';
  } catch (error) {
    root.dataset.enhanced = 'false';
    root.querySelectorAll('.reveal.is-pending').forEach(element => element.classList.add('is-visible'));
    console.warn(`AITA ${id}: enhancement unavailable`, error);
  }
}
