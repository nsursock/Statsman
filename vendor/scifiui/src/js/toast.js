/** Lightweight toast helper — appends items into a .toast container. */
export function createToaster(container) {
  if (!container) throw new Error("createToaster requires a .toast container element");

  function push(message, { variant = "info", ttl = 3200 } = {}) {
    const item = document.createElement("div");
    item.className = `toast-item toast-${variant}`;
    item.setAttribute("role", "status");
    item.textContent = message;
    container.appendChild(item);
    if (ttl > 0) {
      setTimeout(() => {
        item.remove();
      }, ttl);
    }
    return item;
  }

  return {
    info: (msg, opts) => push(msg, { ...opts, variant: "info" }),
    success: (msg, opts) => push(msg, { ...opts, variant: "success" }),
    warning: (msg, opts) => push(msg, { ...opts, variant: "warning" }),
    error: (msg, opts) => push(msg, { ...opts, variant: "error" }),
    push,
  };
}
