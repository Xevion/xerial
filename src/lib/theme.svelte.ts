/**
 * Light/dark selection. The palette lives in Panda semantic tokens whose `_dark`
 * values activate under a `dark` class on <html>; this store owns that class and
 * persists the choice. A boot script in app.html applies the same class before
 * first paint, so the store reads it back to start in sync.
 */

type Theme = "light" | "dark";
const KEY = "xerial:theme";
const browser = typeof document !== "undefined";

function getInitialTheme(): Theme {
	if (!browser) return "light";
	if (document.documentElement.classList.contains("dark")) return "dark";
	const stored = localStorage.getItem(KEY);
	if (stored === "dark" || stored === "light") return stored;
	return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function createThemeStore() {
	let theme = $state<Theme>(getInitialTheme());

	function apply() {
		document.documentElement.classList.toggle("dark", theme === "dark");
	}

	function toggle() {
		theme = theme === "dark" ? "light" : "dark";
		if (browser) {
			localStorage.setItem(KEY, theme);
			apply();
		}
	}

	return {
		get current() {
			return theme;
		},
		get isDark() {
			return theme === "dark";
		},
		toggle,
	};
}

export const themeStore = createThemeStore();
