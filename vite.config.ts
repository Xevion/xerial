import { sveltekit } from "@sveltejs/kit/vite";

import { defineConfig } from "vite";

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: { allow: ["styled-system"] },
		// styled-system/styles.css is written by the `panda --watch` process (run
		// alongside dev via concurrently); it must stay watched so edits flow through
		// HMR. SvelteKit owns .svelte-kit/ and invalidates it itself.
		watch: {
			ignored: ["**/.svelte-kit/**"],
		},
	},
});
