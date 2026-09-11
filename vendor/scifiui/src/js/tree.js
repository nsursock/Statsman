/** Expand/collapse .tree-item via .tree-toggle; select .tree-row on click. */
export function initTreeView(root = document) {
  root.addEventListener("click", (e) => {
    const toggle = e.target.closest(".tree-toggle");
    if (toggle && !toggle.classList.contains("is-leaf")) {
      e.preventDefault();
      e.stopPropagation();
      const item = toggle.closest(".tree-item");
      if (!item) return;
      const open = item.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }

    const row = e.target.closest(".tree-row");
    if (!row) return;
    const tree = row.closest(".tree-view");
    if (!tree) return;
    tree.querySelectorAll(".tree-row.selected").forEach((r) => {
      r.classList.remove("selected");
      r.setAttribute("aria-selected", "false");
    });
    row.classList.add("selected");
    row.setAttribute("aria-selected", "true");
  });
}
