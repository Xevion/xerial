import js from "@eslint/js";
import panda from "@pandacss/eslint-plugin";
import perfectionist from "eslint-plugin-perfectionist";
import svelte from "eslint-plugin-svelte";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

import svelteConfig from "./svelte.config.js";

export default defineConfig(
	// Global ignores — a lone `ignores` object applies repo-wide.
	{
		ignores: ["styled-system/**", ".svelte-kit/**", "build/**", "dist/**", "node_modules/**"],
	},

	// Base JS + TypeScript strict (non-type-checked: fast, no project service).
	js.configs.recommended,
	...tseslint.configs.strict,

	// Svelte 5 recommended preset (registers plugin + svelte-eslint-parser).
	...svelte.configs["flat/recommended"],
	{
		// Hand <script lang="ts"> and runes-mode .svelte.ts/.js to the TS parser.
		files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
				extraFileExtensions: [".svelte"],
				svelteConfig,
			},
		},
	},

	// Panda CSS — enforce the project's mandatory styling guidelines.
	{
		files: ["**/*.ts", "**/*.js", "**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
		plugins: { "@pandacss": panda },
		settings: { "@pandacss/configPath": "./panda.config.ts" },
		rules: {
			// Correctness — wrong Panda usage is always a bug here.
			"@pandacss/file-not-included": "error",
			"@pandacss/no-config-function-in-source": "error",
			"@pandacss/no-invalid-token-paths": "error",
			"@pandacss/no-invalid-nesting": "error",
			// Token discipline — CLAUDE.md bans hardcoded colors / escape hatches.
			"@pandacss/no-hardcoded-color": ["error", { noOpacity: true }],
			"@pandacss/no-debug": "error",
			"@pandacss/no-deprecated-tokens": "error",
			"@pandacss/no-dynamic-styling": "error",
			"@pandacss/no-unsafe-token-fn-usage": "error",
			"@pandacss/no-property-renaming": "error",
			"@pandacss/no-escape-hatch": "error",
			"@pandacss/no-important": "error",
			"@pandacss/no-margin-properties": "error",
			"@pandacss/no-physical-properties": "error",
			// Style — pick one of each mutually-exclusive pair.
			"@pandacss/prefer-shorthand-properties": "error",
			"@pandacss/prefer-longhand-properties": "off",
			"@pandacss/prefer-composite-properties": "error",
			"@pandacss/prefer-atomic-properties": "off",
			"@pandacss/prefer-unified-property-style": "error",
		},
	},

	// Import ordering — grouped for SvelteKit: framework → external → $app/$env
	// → $lib → styled-system → relative.
	{
		plugins: { perfectionist },
		rules: {
			"sort-imports": "off",
			"perfectionist/sort-imports": [
				"error",
				{
					type: "alphabetical",
					order: "asc",
					newlinesBetween: 1,
					groups: [
						"type-import",
						"value-builtin",
						"svelte-framework",
						"value-external",
						"sveltekit-virtual",
						"sveltekit-lib",
						"styled-system",
						["type-parent", "type-sibling", "type-index"],
						["value-parent", "value-sibling", "value-index"],
						"unknown",
					],
					customGroups: [
						{
							groupName: "svelte-framework",
							elementNamePattern: ["^svelte$", "^svelte/.+", "^@sveltejs/.+", "^@ark-ui/svelte.*"],
						},
						{
							groupName: "sveltekit-virtual",
							elementNamePattern: ["^\\$app/.+", "^\\$env/.+", "^\\$service-worker.*"],
						},
						{
							groupName: "sveltekit-lib",
							elementNamePattern: "^\\$lib.*",
						},
						{
							groupName: "styled-system",
							elementNamePattern: "^styled-system.*",
						},
					],
				},
			],
		},
	},

	// Recipe definition files are Panda config, not app source — they legitimately
	// call defineRecipe and are imported only by panda.config.ts (never bundled).
	{
		files: ["src/**/recipes/**", "panda.config.ts"],
		rules: { "@pandacss/no-config-function-in-source": "off" },
	},

	// Browser + Node globals for all files.
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
	},
);
