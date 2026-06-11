<script lang="ts">
	import Moon from "@lucide/svelte/icons/moon";
	import Sun from "@lucide/svelte/icons/sun";

	import { themeStore } from "$lib/theme.svelte";

	import { css } from "styled-system/css";
	import { button } from "styled-system/recipes";

	// Both icons stay mounted and cross-fade on the `_dark` condition — no markup
	// branch, so the swap can animate.
	const icon = css({
		position: "absolute",
		width: "1.15rem",
		height: "1.15rem",
		transition: "transform 0.2s ease, opacity 0.2s ease",
	});
	const sun = css({
		transform: "rotate(0) scale(1)",
		opacity: 1,
		_dark: { transform: "rotate(-90deg) scale(0)", opacity: 0 },
	});
	const moon = css({
		transform: "rotate(90deg) scale(0)",
		opacity: 0,
		_dark: { transform: "rotate(0) scale(1)", opacity: 1 },
	});
</script>

<button
	class={button({ variant: "icon" })}
	type="button"
	onclick={() => themeStore.toggle()}
	title={themeStore.isDark ? "Switch to light theme" : "Switch to dark theme"}
	aria-label="Toggle color theme"
>
	<Sun class={`${icon} ${sun}`} aria-hidden="true" />
	<Moon class={`${icon} ${moon}`} aria-hidden="true" />
</button>
