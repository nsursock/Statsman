/**
 * @scifiui/core — Tailwind CSS v4 plugin
 *
 * Registers theme color aliases so utilities like `bg-scifi-primary` and
 * `text-scifi-muted` resolve to CSS variables. Component classes (`.btn`,
 * `.pane`, …) live in the CSS exports and must be imported separately:
 *
 *   @import "tailwindcss";
 *   @plugin "@scifiui/core";
 *   @import "@scifiui/core/index.css";
 *
 * All visual values read `var(--scifi-*)` so retheming is zero-config.
 */
import plugin from "tailwindcss/plugin";

const scifiColors = {
  bg: "var(--scifi-bg)",
  surface: "var(--scifi-surface-solid)",
  primary: "var(--scifi-primary)",
  secondary: "var(--scifi-secondary)",
  cyan: "var(--scifi-cyan)",
  text: "var(--scifi-text)",
  muted: "var(--scifi-muted)",
  success: "var(--scifi-success)",
  warning: "var(--scifi-warning)",
  error: "var(--scifi-error)",
  border: "var(--scifi-border)",
};

export default plugin(
  function ({ addComponents, addUtilities }) {
    addUtilities({
      ".text-scifi-primary": { color: "var(--scifi-primary)" },
      ".text-scifi-secondary": { color: "var(--scifi-secondary)" },
      ".text-scifi-cyan": { color: "var(--scifi-cyan)" },
      ".text-scifi-muted": { color: "var(--scifi-muted)" },
      ".text-scifi-success": { color: "var(--scifi-success)" },
      ".text-scifi-warning": { color: "var(--scifi-warning)" },
      ".text-scifi-error": { color: "var(--scifi-error)" },
      ".bg-scifi-bg": { backgroundColor: "var(--scifi-bg)" },
      ".bg-scifi-surface": { backgroundColor: "var(--scifi-surface-solid)" },
      ".bg-scifi-primary": { backgroundColor: "var(--scifi-primary)" },
      ".border-scifi-primary": { borderColor: "var(--scifi-primary)" },
      ".border-scifi-border": { borderColor: "var(--scifi-border)" },
      ".ring-scifi-glow": { boxShadow: "var(--scifi-glow)" },
    });

    /* Component shells via addComponents — values are CSS variables only */
    addComponents({
      ".scifi-surface": {
        backgroundColor: "var(--scifi-surface)",
        border: "1px solid var(--scifi-border)",
        boxShadow: "var(--scifi-glow)",
        borderRadius: "var(--scifi-radius)",
        color: "var(--scifi-text)",
        backdropFilter: "blur(8px)",
      },
      ".scifi-label": {
        fontSize: "0.6875rem",
        fontWeight: "700",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: "var(--scifi-muted)",
      },
    });
  },
  {
    theme: {
      extend: {
        colors: {
          scifi: scifiColors,
        },
        fontFamily: {
          scifi: ["var(--scifi-font)"],
        },
        boxShadow: {
          "scifi-glow": "var(--scifi-glow)",
        },
        borderRadius: {
          scifi: "var(--scifi-radius)",
          "scifi-lg": "var(--scifi-radius-lg)",
        },
      },
    },
  }
);
