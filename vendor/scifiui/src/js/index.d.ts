declare module "@scifiui/core/js" {
  export function initDropdowns(root?: ParentNode | Document): void;
  export function initTreeView(root?: ParentNode | Document): void;
  export function createToaster(container: Element): {
    info: (msg: string, opts?: object) => HTMLElement;
    success: (msg: string, opts?: object) => HTMLElement;
    warning: (msg: string, opts?: object) => HTMLElement;
    error: (msg: string, opts?: object) => HTMLElement;
    push: (msg: string, opts?: object) => HTMLElement;
  };

  export interface CommandPaletteItem {
    title: string;
    command?: string;
    hint?: string;
    group?: string;
    icon?: string;
    shortcut?: string[];
  }

  export interface CommandPaletteHandle {
    open: () => void;
    close: () => void;
    toggle: () => void;
    refresh: () => void;
    destroy: () => void;
  }

  export function initCommandPalette(
    backdrop: HTMLElement,
    opts?: { items?: CommandPaletteItem[]; onSelect?: (cmd: string, item?: CommandPaletteItem) => void; keys?: string[] },
  ): CommandPaletteHandle;

  export function createCommandPalette(
    opts?: {
      items?: CommandPaletteItem[];
      onSelect?: (cmd: string, item?: CommandPaletteItem) => void;
      keys?: string[];
      placeholder?: string;
      footer?: boolean;
    },
  ): CommandPaletteHandle;

  /** GSAP stagger for `[data-enter]` under root. No-ops when perf-lite / reduced-motion. */
  export function enterShell(root: HTMLElement): unknown;
  /** Landing / launcher intro for hero + console surfaces. */
  export function playLandingIntro(root: HTMLElement): unknown;
  export function typewriter(
    text: string,
    onTick: (slice: string) => void,
    onDone: () => void,
    charMs?: number,
  ): unknown;
  export function countUp<T extends Record<string, number>>(
    targets: T,
    onTick: (values: T) => void,
  ): unknown;
  export function pulseConsole(el: HTMLElement | null): Promise<void>;
  /** Tunnel "dive" transition — scales content toward viewer + vignette close. Fires onComplete when done. */
  export function diveTransition(
    root: HTMLElement | null,
    opts?: { target?: HTMLElement; onComplete?: () => void },
  ): unknown;
  /** Re-export of the GSAP package for advanced consumers. */
  export const gsap: typeof import("gsap").default;
}
