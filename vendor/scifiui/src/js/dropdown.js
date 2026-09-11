/** Toggle .open on .dropdown when the trigger is clicked; close on outside click / Escape. */
export function initDropdowns(root = document) {
  const closeAll = (except) => {
    root.querySelectorAll(".dropdown.open").forEach((el) => {
      if (el !== except) el.classList.remove("open");
    });
  };

  root.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-dropdown-trigger]");
    if (trigger) {
      const dropdown = trigger.closest(".dropdown");
      if (!dropdown) return;
      e.stopPropagation();
      const willOpen = !dropdown.classList.contains("open");
      closeAll();
      if (willOpen) dropdown.classList.add("open");
      return;
    }
    if (!e.target.closest(".dropdown")) closeAll();
  });

  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });
}
