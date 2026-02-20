<script lang="ts">
	import { appStore, type Month } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';
	import ExpenseReport from './ExpenseReport.svelte';

	interface Props {
		onSelectMonth: (month: Month) => void;
		onCreateMonth: () => void;
	}

	let { onSelectMonth, onCreateMonth }: Props = $props();

	const formatDate = (iso: string) => {
		return new Date(iso).toLocaleDateString();
	};

	// Only show active and pending_close months (not closed - those go in MonthHistory)
	const activeMonths = $derived(
		appStore.months
			.filter(m => !m.isClosed)
			.sort((a, b) => {
				if (a.year !== b.year) return b.year - a.year;
				return b.monthIndex - a.monthIndex;
			})
	);

	const activeMonthsTotals = $derived(() => {
		let totalExpenses = 0;
		let totalPaid = 0;
		let totalUnpaid = 0;

		for (const month of activeMonths) {
			totalExpenses += month.total_amount;
			totalPaid += month.total_paid;
			totalUnpaid += month.total_unpaid;
		}

		return { totalExpenses, totalPaid, totalUnpaid };
	});

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'active': return 'bg-green-100 text-green-700';
			case 'pending_close': return 'bg-orange-100 text-orange-700';
			case 'closed': return 'bg-gray-100 text-gray-700';
			default: return 'bg-gray-100 text-gray-700';
		}
	};
	const handleDeleteMonth = (e: Event, monthId: string, monthName: string) => {
		e.stopPropagation();
		if (confirm(`Delete "${monthName}" and all its transactions?`)) {
			appStore.deleteMonth(monthId);
		}
	};
</script>

<div class="space-y-4">
	{#if activeMonths.length > 0}
		{@const totals = activeMonthsTotals()}
		<Card class="w-full">
			<Header>
				<Title class="text-lg font-bold">Current Month Totals</Title>
			</Header>
			<Content class="p-4">
				<div class="grid grid-cols-3 gap-4 text-center">
					<div class="rounded-lg bg-blue-50 p-3">
						<p class="text-sm text-gray-600">Total Expenses</p>
						<p class="text-xl font-bold text-blue-600">${totals.totalExpenses.toFixed(2)}</p>
					</div>
					<div class="rounded-lg bg-green-50 p-3">
						<p class="text-sm text-gray-600">Paid</p>
						<p class="text-xl font-bold text-green-600">${totals.totalPaid.toFixed(2)}</p>
					</div>
					<div class="rounded-lg bg-red-50 p-3">
						<p class="text-sm text-gray-600">Unpaid</p>
						<p class="text-xl font-bold text-red-600">${totals.totalUnpaid.toFixed(2)}</p>
					</div>
				</div>
			</Content>
		</Card>
	{/if}

	<ExpenseReport />

	<Card class="w-full">
		<Header class="flex flex-row items-center justify-between">
			<Title class="text-xl font-bold">Active Months</Title>
			<Button onclick={onCreateMonth} size="sm">+ New Month</Button>
		</Header>
		<Content class="p-4">
			{#if activeMonths.length === 0}
				<p class="text-center text-gray-500">No active months. Create one to get started.</p>
			{:else}
				<div class="space-y-2">
					{#each activeMonths as month (month.id)}
						<button
							class="w-full rounded-lg border p-3 text-left transition-colors hover:bg-gray-50 {appStore.activeMonthId === month.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}"
							onclick={() => onSelectMonth(month)}
						>
							<div class="flex items-center justify-between">
								<div>
									<div class="flex items-center gap-2">
										<h3 class="font-medium">{month.name}</h3>
										<span class="rounded px-1.5 py-0.5 text-xs font-medium {month.isCompany ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
											{month.isCompany ? 'Company' : 'Personal'}
										</span>
										<span class="rounded px-1.5 py-0.5 text-xs font-medium {getStatusBadge(month.status)}">
											{month.status === 'pending_close' ? 'Pending' : month.status === 'active' ? 'Active' : 'Closed'}
										</span>
									</div>
									<p class="text-sm text-gray-500">
										{formatDate(month.start)} - {formatDate(month.end)}
									</p>
								</div>
								<div class="flex items-center gap-2">
									<div class="text-right">
										<p class="text-lg font-bold text-blue-600">
											${month.total_amount.toFixed(2)}
										</p>
										<p class="text-sm text-gray-500">
											{month.transactionCount} expense{month.transactionCount !== 1 ? 's' : ''}
										</p>
									</div>
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										role="button"
										tabindex="0"
										class="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
										onclick={(e) => handleDeleteMonth(e, month.id, month.name)}
										onkeydown={(e) => { if (e.key === "Enter") handleDeleteMonth(e, month.id, month.name); }}
										title="Delete month"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
										</svg>
									</div>
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</Content>
	</Card>
</div>
