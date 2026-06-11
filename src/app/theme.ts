/**
 * Light/dark theme selection. The actual palette lives in CSS via `light-dark()`
 * keyed off `color-scheme`; this module only decides which scheme is active and
 * pins it onto `<html data-theme>`. A boot script in index.html applies the same
 * value before first paint, so these helpers read it back to start in sync.
 */

export type Theme = "light" | "dark";
const KEY = "xerial:theme";

/** Resolve the theme already applied by the boot script, or fall back. */
export function initialTheme(): Theme {
  const attr = document.documentElement.dataset.theme;
  if (attr === "light" || attr === "dark") return attr;
  const stored = localStorage.getItem(KEY);
  if (stored === "light" || stored === "dark") return stored;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Pin the chosen theme onto the document and remember it across visits. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage can throw in private mode; the in-memory choice still applies.
  }
}
