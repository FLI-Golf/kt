<script lang="ts">
	import { type Month, type AccountType, SUPPORTED_YEARS, DEFAULT_YEAR, MONTH_NAMES } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content, Footer } from '$lib/components/ui/card';

	interface Props {
		month?: Month;
		onSave: (data: { year: number; monthIndex: number; accountType: AccountType }) => void;
		onCancel: () => void;
	}

	let { month, onSave, onCancel }: Props = $props();

	let year = $state(month?.year ?? DEFAULT_YEAR);
	let monthIndex = $state(month?.monthIndex ?? new Date().getMonth());
	let accountType = $state<AccountType>(month?.accountType ?? 'personal');

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		onSave({ year, monthIndex, accountType });
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
				<label class="text-sm font-medium">Account Type</label>
				<div class="mt-1 flex gap-2">
					<button
						type="button"
						onclick={() => accountType = 'personal'}
						class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors {accountType === 'personal' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					>
						Personal
					</button>
					<button
						type="button"
						onclick={() => accountType = 'company'}
						class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors {accountType === 'company' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					>
						Company
					</button>
				</div>
				<p class="mt-1 text-xs text-gray-500">
					{accountType === 'personal'
						? 'Personal expenses — refunds available'
						: 'Company expenses — reimbursements available'}
				</p>
			</div>
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
