import { sveltekit } from "@sveltejs/kit/vite";

import { defineConfig } from "vite";

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: { allow: ["styled-system"] },
		// Panda regenerates styled-system/ on every style change; without ignoring
		// it the Vite watcher churns on the codegen output and corrupts dev state.
		watch: {
			ignored: ["**/.svelte-kit/**", "**/styled-system/**"],
		},
	},
});
