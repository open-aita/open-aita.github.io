export function mount(root) {
  // Project filtering.
  const filterButtons = [...root.querySelectorAll("[data-filter]")];
  const projectCards = [...root.querySelectorAll("[data-project-grid] .project-card")];
  const projectCount = root.querySelector("[data-project-count]");
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

}
