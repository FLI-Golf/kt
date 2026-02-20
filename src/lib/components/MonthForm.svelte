<script lang="ts">
	import { type Month, SUPPORTED_YEARS, DEFAULT_YEAR, MONTH_NAMES } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content, Footer } from '$lib/components/ui/card';

	interface Props {
		month?: Month;
		onSave: (data: { year: number; monthIndex: number }) => void;
		onCancel: () => void;
	}

	let { month, onSave, onCancel }: Props = $props();

	let year = $state(month?.year ?? DEFAULT_YEAR);
	let monthIndex = $state(month?.monthIndex ?? new Date().getMonth());

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		onSave({ year, monthIndex });
	};

	const isEditing = $derived(!!month);
</script>

<Card class="w-full max-w-md">
	<Header>
		<Title class="text-xl font-bold">{isEditing ? 'Edit Month' : 'Create New Month'}</Title>
	</Header>
	<form onsubmit={handleSubmit}>
		<Content class="space-y-4 p-4">
			<div>
				<label for="month-year" class="text-sm font-medium">Year</label>
				<select
					id="month-year"
					bind:value={year}
					class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				>
					{#each SUPPORTED_YEARS as y}
						<option value={y}>{y}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="month-select" class="text-sm font-medium">Month</label>
				<select
					id="month-select"
					bind:value={monthIndex}
					class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				>
					{#each MONTH_NAMES as name, i}
						<option value={i}>{name}</option>
					{/each}
				</select>
			</div>
		</Content>
		<Footer class="flex justify-end gap-2 p-4">
			<Button type="button" variant="outline" onclick={onCancel}>Cancel</Button>
			<Button type="submit">{isEditing ? 'Update' : 'Create'}</Button>
		</Footer>
	</form>
</Card>
