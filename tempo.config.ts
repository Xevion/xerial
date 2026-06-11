import { defineConfig, runners } from "@xevion/tempo";

/**
 * `tempo` is the single entrypoint for all project checks.
 *   tempo check        run format-check + lint + type-check + knip + spell + test in parallel
 *   tempo check --fix  auto-fix what can be fixed, then re-verify
 *   tempo fmt          apply Prettier
 *   tempo lint         run ESLint
 *   tempo pre-commit   format staged files (partial-staging safe); used by lefthook
 */
export default defineConfig({
	subsystems: {
		app: {
			aliases: ["a"],
			requires: ["bun"],
			commands: {
				"format-check": "bunx prettier --check .",
				"format-apply": "bunx prettier --write .",
				lint: "bunx eslint .",
				"lint-fix": ["bunx", "eslint", "--fix", "."],
				// `bun run` gives us a shell so `svelte-kit sync && svelte-check` works.
				"type-check": "bun run check:types",
				knip: "bunx knip",
				spell: ["bunx", "cspell", "--no-progress", "--gitignore", "**/*.{ts,js,svelte,md}"],
				// The Primavera parser suite — part of every full check.
				test: "bun test",
			},
			// Fixers — referenced by autoFix, not run as standalone checks.
			autoFix: {
				"format-check": "format-apply",
				lint: "lint-fix",
			},
		},
	},

	// Fixers stay out of the check matrix — `tempo check` must not mutate files
	// (they're still invoked as autoFix targets when `--fix` is passed).
	check: {
		exclude: ["app:format-apply", "app:lint-fix"],
		autoFixStrategy: "fix-first",
	},

	commands: {
		check: runners.check({ autoFixStrategy: "fix-first" }),
		fmt: runners.sequential("format-apply", { autoFixFallback: true }),
		lint: runners.sequential("lint"),
		"pre-commit": runners.preCommit(),
	},

	// Regenerate the Panda styled-system before checks when the config changes.
	preflights: [
		{
			label: "panda codegen",
			sources: { dir: ".", pattern: "panda.config.ts" },
			artifacts: { dir: "styled-system", pattern: "**/*.{ts,mjs}" },
			regenerate: "bunx panda codegen",
			reason: "panda.config.ts is newer than styled-system",
		},
	],

	ci: {
		groupedOutput: true,
	},
});
