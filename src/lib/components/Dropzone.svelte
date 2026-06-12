<script lang="ts">
	import FileUp from "@lucide/svelte/icons/file-up";
	import GitCompare from "@lucide/svelte/icons/git-compare";
	import Sparkles from "@lucide/svelte/icons/sparkles";

	import { css } from "styled-system/css";
	import { button } from "styled-system/recipes";

	let {
		busy = false,
		error = null,
		onFile,
		onSample,
		onCompareSample,
	}: {
		busy?: boolean;
		error?: string | null;
		onFile: (file: File) => void;
		onSample: () => void;
		onCompareSample: () => void;
	} = $props();

	let dragging = $state(false);
	let fileInput = $state<HTMLInputElement>();

	function pick(files: FileList | null | undefined) {
		const file = files?.[0];
		if (file) onFile(file);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		pick(e.dataTransfer?.files);
	}

	const styles = {
		// A faint spreadsheet ruling fills the empty workspace so the open-file card
		// sits on a "blank sheet" rather than a void.
		canvas: css({
			flex: 1,
			display: "grid",
			placeItems: "center",
			padding: "1.5rem",
			minHeight: 0,
			backgroundColor: "bg",
			backgroundImage:
				"linear-gradient(token(colors.grid.line) 1px, transparent 1px), linear-gradient(90deg, token(colors.grid.line) 1px, transparent 1px)",
			backgroundSize: "2.2rem 1.6rem",
			// Fade the ruling toward the edges so it reads as texture, not a hard grid.
			maskImage: "radial-gradient(120% 90% at 50% 45%, #000 35%, transparent 100%)",
		}),
		card: css({
			width: "min(34rem, 100%)",
			bg: "panel",
			border: "1px solid token(colors.border)",
			borderRadius: "12px",
			boxShadow: "card",
			overflow: "hidden",
		}),
		head: css({
			display: "flex",
			alignItems: "center",
			gap: "0.5rem",
			paddingBlock: "0.55rem",
			paddingInline: "0.9rem",
			borderBottom: "1px solid token(colors.border)",
			bg: "grid.headerBg",
			color: "grid.headerFg",
			fontSize: "0.78rem",
			fontWeight: 600,
			letterSpacing: "0.02em",
			textTransform: "uppercase",
		}),
		dot: css({ width: "0.5rem", height: "0.5rem", borderRadius: "full", bg: "accent" }),
		body: css({ padding: "1.25rem" }),
		drop: css({
			position: "relative",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			gap: "0.5rem",
			padding: "2.25rem 1.5rem",
			textAlign: "center",
			border: "2px dashed token(colors.grid.line)",
			borderRadius: "10px",
			cursor: "pointer",
			transition: "border-color 0.15s, background 0.15s",
			_hover: { borderColor: "accent" },
			_focusVisible: { borderColor: "accent", outline: "none" },
			'&[data-dragging="true"]': { borderColor: "accent", bg: "selection" },
		}),
		icon: css({ width: "2.4rem", height: "2.4rem", color: "accent" }),
		title: css({ fontSize: "1.05rem", fontWeight: 600 }),
		sub: css({ color: "muted", fontSize: "0.85rem" }),
		ext: css({ fontWeight: 700, color: "text" }),
		footer: css({ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1rem" }),
		divider: css({ flex: 1, height: "1px", bg: "border" }),
		hint: css({ color: "muted", fontSize: "0.8rem", whiteSpace: "nowrap" }),
		error: css({ color: "danger", fontSize: "0.85rem", marginTop: "0.75rem", textAlign: "center" }),
		// While parsing, a translucent veil + spinner covers the drop target so the
		// busy state is visible even on a large file that blocks briefly.
		veil: css({
			position: "absolute",
			inset: 0,
			display: "grid",
			placeItems: "center",
			borderRadius: "10px",
			bg: "color-mix(in srgb, token(colors.panel) 72%, transparent)",
		}),
		spinner: css({
			width: "1.6rem",
			height: "1.6rem",
			borderRadius: "full",
			border: "2.5px solid token(colors.border)",
			borderTopColor: "token(colors.accent)",
			animation: "spin 0.7s linear infinite",
		}),
	};
</script>

<div class={styles.canvas}>
	<div class={styles.card}>
		<div class={styles.head}>
			<span class={styles.dot}></span>
			Open a calendar
		</div>
		<div class={styles.body}>
			<div
				class={styles.drop}
				data-dragging={dragging}
				role="button"
				tabindex="0"
				aria-busy={busy}
				ondragover={(e) => {
					e.preventDefault();
					dragging = true;
				}}
				ondragleave={() => (dragging = false)}
				ondrop={onDrop}
				onclick={() => fileInput?.click()}
				onkeydown={(e) => (e.key === "Enter" || e.key === " ") && fileInput?.click()}
			>
				<FileUp class={styles.icon} aria-hidden="true" />
				<p class={styles.title}>Drop a Primavera <span class={styles.ext}>.xer</span> file</p>
				<p class={styles.sub}>or click to browse — everything is parsed on your device</p>
				{#if busy}
					<div class={styles.veil}><div class={styles.spinner}></div></div>
				{/if}
			</div>

			<div class={styles.footer}>
				<span class={styles.divider}></span>
				<span class={styles.hint}>no file handy?</span>
				<button
					class={button({ variant: "subtle" })}
					type="button"
					disabled={busy}
					onclick={onSample}
				>
					<Sparkles size={15} aria-hidden="true" />
					Try a sample
				</button>
				<button
					class={button({ variant: "subtle" })}
					type="button"
					disabled={busy}
					onclick={onCompareSample}
				>
					<GitCompare size={15} aria-hidden="true" />
					Compare a sample
				</button>
			</div>

			{#if error}<p class={styles.error}>{error}</p>{/if}
		</div>

		<input
			bind:this={fileInput}
			type="file"
			accept=".xer"
			hidden
			onchange={(e) => pick((e.currentTarget as HTMLInputElement).files)}
		/>
	</div>
</div>
