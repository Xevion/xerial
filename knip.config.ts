import type { KnipConfig } from "knip";

export default {
	// tempo isn't a built-in knip plugin, so its config is an explicit entry
	// (this also makes @xevion/tempo resolve as a used dependency).
	//
	// The parser and export barrels are public library surfaces: they
	// intentionally expose more than the app happens to consume today, so they're
	// entries rather than dead-export candidates.
	entry: [
		"tempo.config.ts",
		"src/lib/parser/node.ts",
		"src/lib/parser/index.ts",
		"src/lib/export/index.ts",
	],
} satisfies KnipConfig;
