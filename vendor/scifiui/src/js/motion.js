import gsap from "gsap";

function motionDisabled() {
  if (typeof document === "undefined") return true;
  if (document.documentElement.classList.contains("perf-lite")) return true;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return true;
  }
  return false;
}

function fromIfPresent(root, selector, vars) {
  const els = root.querySelectorAll(selector);
  if (!els.length) return;
  gsap.from(els, vars);
}

/** Stagger fade/slide for `[data-enter]` nodes under `root`. */
export function enterShell(root) {
  if (!root || motionDisabled()) return null;
  const targets = root.querySelectorAll("[data-enter]");
  if (!targets.length) return null;
  return gsap.from(targets, {
    opacity: 0,
    y: 10,
    duration: 0.45,
    stagger: 0.06,
    ease: "power2.out",
  });
}

/**
 * Landing / launcher intro. Works with CadanADE (`.hero-kicker`) and
 * ScifiUI templates (`.label-kicker`, `.hero-title-glitch`, etc.).
 */
export function playLandingIntro(root) {
  if (!root || motionDisabled()) return null;

  fromIfPresent(root, ".hero-kicker, main > .label-kicker, .label-kicker.neon-flicker", {
    y: -16,
    opacity: 0,
    duration: 0.55,
    ease: "power3.out",
  });
  fromIfPresent(root, ".hero-title-glitch, .hero-title", {
    y: 28,
    opacity: 0,
    duration: 0.85,
    ease: "power3.out",
    delay: 0.08,
  });
  fromIfPresent(root, ".hero-tagline, main > .text-scifi-muted", {
    opacity: 0,
    duration: 0.55,
    delay: 0.45,
  });
  fromIfPresent(root, ".feature-pill", {
    y: 12,
    opacity: 0,
    duration: 0.45,
    stagger: 0.05,
    ease: "power2.out",
    delay: 0.65,
  });
  fromIfPresent(root, ".console-panel, .metric-card", {
    y: 28,
    opacity: 0,
    scale: 0.98,
    duration: 0.65,
    stagger: 0.08,
    ease: "power3.out",
    delay: 0.85,
  });
  fromIfPresent(root, ".stat-tile", {
    y: 10,
    opacity: 0,
    duration: 0.45,
    stagger: 0.08,
    ease: "power2.out",
    delay: 1.1,
  });

  return gsap;
}

export function typewriter(text, onTick, onDone, charMs = 35) {
  if (motionDisabled()) {
    onTick(text);
    onDone();
    return null;
  }
  const tl = gsap.timeline({ delay: 0.55 });
  for (let i = 1; i <= text.length; i++) {
    tl.to({}, { duration: charMs / 1000, onComplete: () => onTick(text.slice(0, i)) });
  }
  tl.call(onDone);
  return tl;
}

export function countUp(targets, onTick) {
  if (motionDisabled()) {
    onTick(targets);
    return null;
  }
  return gsap.to(
    {},
    {
      duration: 1.15,
      delay: 1.15,
      ease: "power2.out",
      onUpdate: function () {
        const p = this.progress();
        const next = {};
        for (const key of Object.keys(targets)) {
          next[key] = Math.round(targets[key] * p);
        }
        onTick(next);
      },
    },
  );
}

export async function pulseConsole(el) {
  if (!el || motionDisabled()) return;
  await gsap.to(el, {
    scale: 1.02,
    boxShadow: "0 0 60px var(--scifi-primary-glow)",
    duration: 0.16,
    ease: "power2.out",
  });
  gsap.to(el, { scale: 1, duration: 0.18, ease: "power2.out" });
}

/**
 * "Dive" tunnel transition — scales the landing content toward the viewer
 * (origin pinned to `opts.target` or `.console-panel`) while a radial
 * vignette closes in like tunnel walls. Calls `opts.onComplete` when finished
 * so the caller can swap views. No-ops (and fires onComplete immediately)
 * when perf-lite / reduced-motion.
 */
export function diveTransition(root, opts = {}) {
  const onComplete = opts.onComplete || (() => {});
  if (!root || motionDisabled()) {
    onComplete();
    return null;
  }

  const target = opts.target || root.querySelector(".console-panel") || root;

  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:9999;pointer-events:none;" +
    "background:radial-gradient(circle at center,transparent 25%," +
    "var(--scifi-bg,#06070d) 100%);opacity:0";
  document.body.appendChild(overlay);

  const rect = target.getBoundingClientRect();
  const ox = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
  const oy = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
  gsap.set(root, { transformOrigin: `${ox}% ${oy}%` });

  const tl = gsap.timeline({
    onComplete: () => {
      overlay.remove();
      gsap.set(root, { clearProps: "transform,filter,opacity,transformOrigin" });
      onComplete();
    },
  });

  tl.to(root, {
    scale: 3.2,
    opacity: 0,
    filter: "blur(10px)",
    duration: 0.55,
    ease: "power3.in",
  }).to(
    overlay,
    { opacity: 1, duration: 0.4, ease: "power2.in" },
    0.2,
  );

  return tl;
}

export { gsap };
