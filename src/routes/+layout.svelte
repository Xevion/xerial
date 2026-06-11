<script lang="ts">
	// Importing the Panda entry stylesheet pulls in the generated cascade layers
	// (reset, base, tokens, recipes, utilities) via the PostCSS plugin.
	import "../app.css";

	let { children } = $props();
</script>

{@render children()}
