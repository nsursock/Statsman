# @scifiui/core

Adaan-styled sci-fi CSS class kit for **Tailwind CSS v4** — daisyUI / FlyonUI model: class-based, CSS-variable themed, framework-agnostic.

## Install

```bash
pnpm add @scifiui/core tailwindcss
```

## Setup

```css
@import "tailwindcss";
@plugin "@scifiui/core";
@import "@scifiui/core/index.css";
```

```html
<html data-theme="retrowave">
  <button class="btn btn-primary">Launch</button>
  <div class="pane pane-bracketed p-4">HUD panel</div>
</html>
```

## Customize

Override any `--scifi-*` token:

```css
:root {
  --scifi-primary: #ffb700;
  --scifi-glow: 0 0 18px rgba(255, 183, 0, 0.35);
}
```

Or switch themes with `data-theme`: `retrowave` (default), `ghibli`, `fiesta`, `dawn`, `synthwave84`, `solarizedDark`, `cottonCandy`, `goldenTwilight`, `brightContrasts`.

Stack Tailwind utilities freely: `class="btn btn-primary mt-4 opacity-80"`.

## Motion (GSAP)

Optional helpers from `@scifiui/core/js` (respects `perf-lite` and `prefers-reduced-motion`):

```js
import { enterShell, playLandingIntro, pulseConsole, gsap } from "@scifiui/core/js";

enterShell(document.querySelector("#app")); // animates [data-enter]
playLandingIntro(document.querySelector("#landing"));
```
