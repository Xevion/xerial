<script lang="ts">
	import {
		DatePicker,
		parseDate,
		type DatePickerValueChangeDetails,
	} from "@ark-ui/svelte/date-picker";
	import { Portal } from "@ark-ui/svelte/portal";

	import Calendar from "@lucide/svelte/icons/calendar";
	import ChevronLeft from "@lucide/svelte/icons/chevron-left";
	import ChevronRight from "@lucide/svelte/icons/chevron-right";

	import {
		monthRangeOf,
		quarterRangeOf,
		rangesOverlap,
		toWholeWeeks,
		yearRangeOf,
	} from "$lib/window";

	import { css } from "styled-system/css";
	import { datePicker } from "styled-system/recipes";

	let {
		start,
		end,
		fullSpan,
		min,
		max,
		resetKey,
		onChange,
	}: {
		/** Range to seed the picker with on mount, ISO yyyy-mm-dd. */
		start: string;
		end: string;
		/** The file's detected envelope: the indicator text and "Full span" preset. */
		fullSpan: { start: string; end: string };
		/** Selectable bounds; days outside are disabled. ISO yyyy-mm-dd. */
		min: string;
		max: string;
		/** Identity of the loaded file; changing it remounts the picker to re-seed. */
		resetKey: string;
		onChange: (range: { start: string; end: string }) => void;
	} = $props();

	const dp = datePicker();

	const wholeWeeks = $derived(toWholeWeeks(fullSpan));

	// "This month/quarter/year" anchor to the wall clock, so for a schedule that
	// doesn't span the present they'd clamp to a single boundary date. Disable any
	// whose window doesn't overlap the selectable bounds. Captured once on mount.
	const today = new Date();
	const relativePresets = $derived(
		[
			{ label: "This month", range: monthRangeOf(today) },
			{ label: "This quarter", range: quarterRangeOf(today) },
			{ label: "This year", range: yearRangeOf(today) },
		].map((p) => ({ ...p, enabled: rangesOverlap(p.range, { start: min, end: max }) })),
	);

	// A range is only meaningful once both ends exist; Ark emits an interim
	// single-element value after the first click, which we deliberately ignore.
	function handleValueChange(details: DatePickerValueChangeDetails) {
		const [from, to] = details.value;
		if (from && to) onChange({ start: from.toString(), end: to.toString() });
	}

	const styles = {
		presets: css({
			display: "flex",
			flexWrap: "wrap",
			gap: "0.35rem",
			marginBottom: "0.6rem",
			// Fill the calendar's width and wrap, rather than widening the popover:
			// zero intrinsic width keeps the pills from dictating the content size.
			width: 0,
			minWidth: "100%",
		}),
		sep: css({ color: "muted", fontSize: "0.8rem" }),
	};
</script>

{#snippet viewControl()}
	<DatePicker.ViewControl class={dp.viewControl}>
		<DatePicker.PrevTrigger class={dp.prevTrigger}>
			<ChevronLeft size={16} aria-hidden="true" />
		</DatePicker.PrevTrigger>
		<DatePicker.ViewTrigger class={dp.viewTrigger}>
			<DatePicker.RangeText />
		</DatePicker.ViewTrigger>
		<DatePicker.NextTrigger class={dp.nextTrigger}>
			<ChevronRight size={16} aria-hidden="true" />
		</DatePicker.NextTrigger>
	</DatePicker.ViewControl>
{/snippet}

{#key resetKey}
	<DatePicker.Root
		selectionMode="range"
		defaultValue={[parseDate(start), parseDate(end)]}
		min={parseDate(min)}
		max={parseDate(max)}
		onValueChange={handleValueChange}
	>
		<DatePicker.Control class={dp.control}>
			<DatePicker.Input index={0} class={dp.input} />
			<span class={styles.sep} aria-hidden="true">→</span>
			<DatePicker.Input index={1} class={dp.input} />
			<DatePicker.Trigger class={dp.trigger}>
				<Calendar size={16} aria-hidden="true" />
			</DatePicker.Trigger>
		</DatePicker.Control>

		<Portal>
			<DatePicker.Positioner>
				<DatePicker.Content class={dp.content}>
					<div class={styles.presets}>
						<DatePicker.PresetTrigger
							class={dp.presetTrigger}
							value={[parseDate(fullSpan.start), parseDate(fullSpan.end)]}
						>
							Full span
						</DatePicker.PresetTrigger>
						<DatePicker.PresetTrigger
							class={dp.presetTrigger}
							value={[parseDate(wholeWeeks.start), parseDate(wholeWeeks.end)]}
						>
							Whole weeks
						</DatePicker.PresetTrigger>
						{#each relativePresets as p (p.label)}
							<DatePicker.PresetTrigger
								class={dp.presetTrigger}
								value={[parseDate(p.range.start), parseDate(p.range.end)]}
								disabled={!p.enabled}
							>
								{p.label}
							</DatePicker.PresetTrigger>
						{/each}
					</div>

					<DatePicker.View view="day">
						<DatePicker.Context>
							{#snippet render(api)}
								{@render viewControl()}
								<DatePicker.Table class={dp.table}>
									<DatePicker.TableHead>
										<DatePicker.TableRow>
											{#each api().weekDays as weekDay (weekDay.short)}
												<DatePicker.TableHeader class={dp.tableHeader}>
													{weekDay.narrow}
												</DatePicker.TableHeader>
											{/each}
										</DatePicker.TableRow>
									</DatePicker.TableHead>
									<DatePicker.TableBody>
										{#each api().weeks as week, w (w)}
											<DatePicker.TableRow>
												{#each week as day (day.toString())}
													<DatePicker.TableCell value={day} class={dp.tableCell}>
														<DatePicker.TableCellTrigger class={dp.tableCellTrigger}>
															{day.day}
														</DatePicker.TableCellTrigger>
													</DatePicker.TableCell>
												{/each}
											</DatePicker.TableRow>
										{/each}
									</DatePicker.TableBody>
								</DatePicker.Table>
							{/snippet}
						</DatePicker.Context>
					</DatePicker.View>

					<DatePicker.View view="month">
						<DatePicker.Context>
							{#snippet render(api)}
								{@render viewControl()}
								<DatePicker.Table class={dp.table}>
									<DatePicker.TableBody>
										{#each api().getMonthsGrid({ columns: 4, format: "short" }) as months, r (r)}
											<DatePicker.TableRow>
												{#each months as month (month.value)}
													<DatePicker.TableCell value={month.value} class={dp.tableCell}>
														<DatePicker.TableCellTrigger class={dp.tableCellTrigger}>
															{month.label}
														</DatePicker.TableCellTrigger>
													</DatePicker.TableCell>
												{/each}
											</DatePicker.TableRow>
										{/each}
									</DatePicker.TableBody>
								</DatePicker.Table>
							{/snippet}
						</DatePicker.Context>
					</DatePicker.View>

					<DatePicker.View view="year">
						<DatePicker.Context>
							{#snippet render(api)}
								{@render viewControl()}
								<DatePicker.Table class={dp.table}>
									<DatePicker.TableBody>
										{#each api().getYearsGrid({ columns: 4 }) as years, r (r)}
											<DatePicker.TableRow>
												{#each years as year (year.value)}
													<DatePicker.TableCell value={year.value} class={dp.tableCell}>
														<DatePicker.TableCellTrigger class={dp.tableCellTrigger}>
															{year.label}
														</DatePicker.TableCellTrigger>
													</DatePicker.TableCell>
												{/each}
											</DatePicker.TableRow>
										{/each}
									</DatePicker.TableBody>
								</DatePicker.Table>
							{/snippet}
						</DatePicker.Context>
					</DatePicker.View>
				</DatePicker.Content>
			</DatePicker.Positioner>
		</Portal>
	</DatePicker.Root>
{/key}
