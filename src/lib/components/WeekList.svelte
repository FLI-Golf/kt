<script lang="ts">
	import { appStore, type Week } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';

	interface Props {
		onSelectWeek: (week: Week) => void;
		onCreateWeek: () => void;
	}

	let { onSelectWeek, onCreateWeek }: Props = $props();

	const formatDate = (iso: string) => {
		return new Date(iso).toLocaleDateString();
	};

	// Only show active and pending_close weeks (not closed - those go in WeekHistory)
	const activeWeeks = $derived(
		appStore.weeks
			.filter(w => !w.isClosed)
			.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
	);

	// Calculate totals for active weeks
	const activeWeeksTotals = $derived(() => {
		let totalExpenses = 0;
		let totalPaid = 0;
		let totalUnpaid = 0;

		for (const week of activeWeeks) {
			totalExpenses += week.total_amount;
			totalPaid += week.total_paid;
			totalUnpaid += week.total_unpaid;
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
	<!-- Active Weeks Summary -->
	{#if activeWeeks.length > 0}
		{@const totals = activeWeeksTotals()}
		<Card class="w-full">
			<Header>
				<Title class="text-lg font-bold">Current Week Totals</Title>
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

	<!-- Weeks List -->
	<Card class="w-full">
		<Header class="flex flex-row items-center justify-between">
			<Title class="text-xl font-bold">Active Weeks</Title>
			<Button onclick={onCreateWeek} size="sm">+ New Week</Button>
		</Header>
		<Content class="p-4">
			{#if activeWeeks.length === 0}
				<p class="text-center text-gray-500">No active weeks. Create one to get started.</p>
			{:else}
				<div class="space-y-2">
					{#each activeWeeks as week (week.id)}
						<button
							class="w-full rounded-lg border p-3 text-left transition-colors hover:bg-gray-50 {appStore.activeWeekId === week.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}"
							onclick={() => onSelectWeek(week)}
						>
							<div class="flex items-center justify-between">
								<div>
									<div class="flex items-center gap-2">
										<h3 class="font-medium">{week.name}</h3>
										<span class="rounded px-1.5 py-0.5 text-xs font-medium {getStatusBadge(week.status)}">
											{week.status === 'pending_close' ? 'Pending' : week.status === 'active' ? 'Active' : 'Closed'}
										</span>
									</div>
									<p class="text-sm text-gray-500">
										{formatDate(week.start)} - {formatDate(week.end)}
									</p>
								</div>
								<div class="text-right">
									<p class="text-lg font-bold text-blue-600">
										${week.total_amount.toFixed(2)}
									</p>
									<p class="text-sm text-gray-500">
										{week.transactionCount} expense{week.transactionCount !== 1 ? 's' : ''}
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
