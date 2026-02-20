<script lang="ts">
	import { appStore, type Month } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';

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
										<span class="rounded px-1.5 py-0.5 text-xs font-medium {getStatusBadge(month.status)}">
											{month.status === 'pending_close' ? 'Pending' : month.status === 'active' ? 'Active' : 'Closed'}
										</span>
									</div>
									<p class="text-sm text-gray-500">
										{formatDate(month.start)} - {formatDate(month.end)}
									</p>
								</div>
								<div class="text-right">
									<p class="text-lg font-bold text-blue-600">
										${month.total_amount.toFixed(2)}
									</p>
									<p class="text-sm text-gray-500">
										{month.transactionCount} expense{month.transactionCount !== 1 ? 's' : ''}
									</p>
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</Content>
	</Card>
</div>
