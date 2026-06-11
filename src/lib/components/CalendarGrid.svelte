<script lang="ts">
	import { formatDate, formatTime, formatHours, weekdayLabel } from "$lib/export";
	import type { GridResult, Serial } from "$lib/parser";

	let { grid }: { grid: GridResult } = $props();

	const isWeekend = (serial: Serial | undefined) => {
		if (serial === undefined) return false;
		const wd = weekdayLabel(serial);
		return wd === "Sat" || wd === "Sun";
	};
</script>

<div class="grid-wrap">
	<table class="grid">
		<thead>
			<tr>
				<th class="c-corner c-name"></th>
				<th class="c-corner c-label"></th>
				{#each grid.serials as serial (serial)}
					<th class="c-date" class:weekend={isWeekend(serial)} title={formatDate(serial)}>
						<span class="d-date">{formatDate(serial)}</span>
						<span class="d-wd">{weekdayLabel(serial)}</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each grid.calendars as cal (cal.clndrId)}
				<tr class="r-start">
					<td class="c-name" rowspan="3" title={cal.name}>{cal.name}</td>
					<td class="c-label">Start</td>
					{#each cal.days as day, i (i)}
						<td class="num" class:off={!day.working} class:weekend={isWeekend(grid.serials[i])}>
							{day.start !== null ? formatTime(day.start) : ""}
						</td>
					{/each}
				</tr>
				<tr class="r-end">
					<td class="c-label">End</td>
					{#each cal.days as day, i (i)}
						<td class="num" class:off={!day.working} class:weekend={isWeekend(grid.serials[i])}>
							{day.end !== null ? formatTime(day.end) : ""}
						</td>
					{/each}
				</tr>
				<tr class="r-total">
					<td class="c-label">Total Hours</td>
					{#each cal.days as day, i (i)}
						<td
							class="num hours"
							class:off={day.hours === 0}
							class:weekend={isWeekend(grid.serials[i])}
						>
							{formatHours(day.hours)}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
