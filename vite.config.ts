import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Base path for static hosting. On GitHub Pages the site is served from
// https://<user>.github.io/<repo>/, so the base must match the repo name.
// Override with BASE_PATH at build time (the deploy workflow sets it).
const base = process.env.BASE_PATH ?? "/primavera/";

export default defineConfig({
  base,
  plugins: [svelte()],
});
