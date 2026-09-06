// Each enhancement loads and fails independently; static chapter content remains usable.
export async function mountChapter(id, load) {
  const root = document.getElementById(id);
  if (!root || root.dataset.enhanced) return;
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
