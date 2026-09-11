/**
 * Command palette helper.
 *
 * Markup contract (build it yourself or via `createCommandPalette`):
 *   .command-palette-backdrop
 *     .command-palette
 *       .command-palette-input-wrap > input.command-palette-input
 *       .command-palette-list (role="listbox")
 *         .command-palette-group
 *           .command-palette-group-label
 *           button.command-palette-item[data-command]
 *       .command-palette-empty (optional, shown when no matches)
 *
 * `initCommandPalette(backdrop, { items, onSelect, keys })` wires:
 *   - open/close (add/remove `.open` on the backdrop) with GSAP transitions
 *   - filter by query (title / hint / group label)
 *   - keyboard nav: ↑/↓ move active, Enter select, Esc close
 *   - click outside / Esc closes
 *
 * `createCommandPalette({ items, onSelect, keys })` builds the DOM and returns
 * { open, close, destroy }.
 */

import gsap from "gsap";

function motionDisabled() {
  if (typeof document === "undefined") return true;
  if (document.documentElement.classList.contains("perf-lite")) return true;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return true;
  }
  return false;
}

function itemText(item, key) {
  return (item[key] ?? "").toString().toLowerCase();
}

function renderItems(list, items, query) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((it) => {
        const hay = `${itemText(it, "title")} ${itemText(it, "hint")} ${itemText(it, "group")}`;
        return hay.includes(q);
      })
    : items;

  list.innerHTML = "";
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "command-palette-empty";
    empty.textContent = "No matching commands";
    list.appendChild(empty);
    return [];
  }

  const groups = new Map();
  filtered.forEach((it) => {
    const g = it.group || "Commands";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(it);
  });

  const rendered = [];
  groups.forEach((groupItems, label) => {
    const group = document.createElement("div");
    group.className = "command-palette-group";
    const gl = document.createElement("div");
    gl.className = "command-palette-group-label";
    gl.textContent = label;
    group.appendChild(gl);
    groupItems.forEach((it) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "command-palette-item";
      btn.dataset.command = it.command ?? it.title;
      btn.setAttribute("role", "option");
      const icon = document.createElement("span");
      icon.className = "command-palette-item-icon";
      if (it.icon) icon.innerHTML = `<i class="ti ti-${it.icon}"></i>`;
      btn.appendChild(icon);
      const body = document.createElement("span");
      body.className = "command-palette-item-body";
      const title = document.createElement("span");
      title.className = "command-palette-item-title";
      title.textContent = it.title;
      body.appendChild(title);
      if (it.hint) {
        const hint = document.createElement("span");
        hint.className = "command-palette-item-hint";
        hint.textContent = it.hint;
        body.appendChild(hint);
      }
      btn.appendChild(body);
      if (it.shortcut) {
        const sc = document.createElement("span");
        sc.className = "command-palette-item-shortcut";
        it.shortcut.forEach((k) => {
          const kbd = document.createElement("kbd");
          kbd.className = "kbd";
          kbd.textContent = k;
          sc.appendChild(kbd);
        });
        btn.appendChild(sc);
      }
      group.appendChild(btn);
      rendered.push(btn);
    });
    list.appendChild(group);
  });
  return rendered;
}

function setActive(list, items, dir) {
  const active = list.querySelector(".command-palette-item.active");
  if (!active) {
    const first = list.querySelector(".command-palette-item");
    if (first) first.classList.add("active");
    return;
  }
  const idx = items.indexOf(active);
  active.classList.remove("active");
  const next = items[(idx + dir + items.length) % items.length];
  if (next) {
    next.classList.add("active");
    next.scrollIntoView({ block: "nearest" });
  }
}

export function initCommandPalette(backdrop, opts = {}) {
  if (!backdrop) throw new Error("initCommandPalette requires the .command-palette-backdrop element");
  const { items = [], onSelect, keys = [] } = opts;
  const palette = backdrop.querySelector(".command-palette");
  const input = backdrop.querySelector(".command-palette-input");
  const list = backdrop.querySelector(".command-palette-list");
  if (!palette || !input || !list) {
    throw new Error("initCommandPalette: missing .command-palette, .command-palette-input, or .command-palette-list");
  }

  let currentItems = [];
  let closing = false;

  function refresh() {
    currentItems = renderItems(list, items, input.value);
    if (currentItems[0]) currentItems[0].classList.add("active");
  }

  function open() {
    if (backdrop.classList.contains("open") || closing) return;
    backdrop.classList.add("open");
    input.value = "";
    refresh();

    if (motionDisabled()) {
      requestAnimationFrame(() => input.focus());
      return;
    }

    gsap.killTweensOf([backdrop, palette]);
    gsap.set(backdrop, { opacity: 0 });
    gsap.set(palette, { opacity: 0, y: -10, scale: 0.98 });
    gsap.to(backdrop, { opacity: 1, duration: 0.2, ease: "power2.out" });
    gsap.to(palette, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.28,
      ease: "power3.out",
      onComplete: () => input.focus(),
    });
  }

  function close() {
    if (!backdrop.classList.contains("open") || closing) return;
    closing = true;

    if (motionDisabled()) {
      backdrop.classList.remove("open");
      closing = false;
      return;
    }

    gsap.killTweensOf([backdrop, palette]);
    gsap.to(palette, {
      opacity: 0,
      y: -8,
      scale: 0.98,
      duration: 0.18,
      ease: "power2.in",
    });
    gsap.to(backdrop, {
      opacity: 0,
      duration: 0.2,
      ease: "power2.in",
      onComplete: () => {
        backdrop.classList.remove("open");
        gsap.set(backdrop, { clearProps: "opacity" });
        gsap.set(palette, { clearProps: "opacity,transform" });
        closing = false;
      },
    });
  }

  function toggle() {
    backdrop.classList.contains("open") && !closing ? close() : open();
  }

  function select(item) {
    const cmd = item?.dataset.command;
    if (!cmd) return;
    if (onSelect) onSelect(cmd, items.find((it) => (it.command ?? it.title) === cmd));
    close();
  }

  input.addEventListener("input", refresh);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(list, currentItems, 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(list, currentItems, -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(list.querySelector(".command-palette-item.active"));
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  list.addEventListener("click", (e) => {
    const item = e.target.closest(".command-palette-item");
    if (item) select(item);
  });
  list.addEventListener("mousemove", (e) => {
    const item = e.target.closest(".command-palette-item");
    if (item && !item.classList.contains("active")) {
      list.querySelector(".command-palette-item.active")?.classList.remove("active");
      item.classList.add("active");
    }
  });

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  function globalKey(e) {
    if (backdrop.classList.contains("open")) return;
    for (const key of keys) {
      const parts = key.toLowerCase().split("+");
      const keyPart = parts[parts.length - 1];
      const needMod = parts.includes("mod");
      const mod = e.metaKey || e.ctrlKey;
      if (e.key.toLowerCase() === keyPart && (!needMod || mod)) {
        e.preventDefault();
        open();
        return;
      }
    }
  }
  document.addEventListener("keydown", globalKey);

  refresh();
  return { open, close, toggle, refresh, destroy: () => document.removeEventListener("keydown", globalKey) };
}

export function createCommandPalette(opts = {}) {
  const { items = [], onSelect, keys = [], placeholder = "Type a command…", footer = true } = opts;

  const backdrop = document.createElement("div");
  backdrop.className = "command-palette-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");

  const palette = document.createElement("div");
  palette.className = "command-palette";

  const inputWrap = document.createElement("div");
  inputWrap.className = "command-palette-input-wrap";
  inputWrap.innerHTML = `<i class="ti ti-search"></i>`;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "command-palette-input";
  input.placeholder = placeholder;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-controls", "command-palette-list");
  inputWrap.appendChild(input);
  if (keys.length) {
    const kbd = document.createElement("span");
    kbd.className = "command-palette-kbd";
    kbd.textContent = keys[0].replace("mod+", "⌘");
    inputWrap.appendChild(kbd);
  }
  palette.appendChild(inputWrap);

  const list = document.createElement("div");
  list.className = "command-palette-list";
  list.id = "command-palette-list";
  list.setAttribute("role", "listbox");
  palette.appendChild(list);

  if (footer) {
    const f = document.createElement("div");
    f.className = "command-palette-footer";
    f.innerHTML = `<span><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd> navigate</span><span><kbd class="kbd">↵</kbd> select</span><span><kbd class="kbd">esc</kbd> close</span>`;
    palette.appendChild(f);
  }

  backdrop.appendChild(palette);
  document.body.appendChild(backdrop);

  return initCommandPalette(backdrop, { items, onSelect, keys });
}
