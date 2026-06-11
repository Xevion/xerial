import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: vitePreprocess(),
	kit: {
		// Fully static output for GitHub Pages: prerendered `/` plus a `200.html`
		// SPA fallback for any other path.
		adapter: adapter({ fallback: "200.html" }),
		// Served from https://<user>.github.io/<repo>/; the deploy workflow sets
		// BASE_PATH=/<repo> (no trailing slash). Empty in dev.
		paths: {
			base: process.env.BASE_PATH ?? "",
		},
		alias: {
			"styled-system": "./styled-system",
			"styled-system/*": "./styled-system/*",
		},
	},
};
