<script lang="ts">
	import { appStore, type Month, MONTH_NAMES, SUPPORTED_YEARS, type AccountType } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content, Footer } from '$lib/components/ui/card';
	import DonutChart from './DonutChart.svelte';

	interface Props {
		onSelectMonth: (month: Month) => void;
	}

	let { onSelectMonth }: Props = $props();

	const PAGE_SIZE = 5;
	let currentPage = $state(1);

	const closedMonths = $derived(
		appStore.months
			.filter(m => m.isClosed)
			.sort((a, b) => {
				if (a.year !== b.year) return a.year - b.year;
				return a.monthIndex - b.monthIndex;
			})
	);

	const totalPages = $derived(Math.ceil(closedMonths.length / PAGE_SIZE));

	const paginatedMonths = $derived(
		closedMonths.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
	);

	const formatDate = (iso: string) => {
		return new Date(iso).toLocaleDateString();
	};

	// Chart filters
	const currentDate = new Date();
	let chartAccountFilter = $state<'all' | AccountType>('all');
	let chartYear = $state(currentDate.getFullYear());
	let chartFromMonth = $state(0);
	let chartToMonth = $state(11);
	let chartStatus = $state<'all' | 'paid' | 'unpaid'>('all');
	let chartMonthStatus = $state<'all' | 'active' | 'closed'>('all');
	let showChartFilters = $state(false);

	// All active months, then apply filters
	const allMonthsForChart = $derived(appStore.months);

	const filteredMonthsForChart = $derived(
		allMonthsForChart.filter(m => {
			if (chartAccountFilter !== 'all' && m.accountType !== chartAccountFilter) return false;
			if (chartMonthStatus === 'active' && m.isClosed) return false;
			if (chartMonthStatus === 'closed' && !m.isClosed) return false;
			if (m.year !== chartYear) return false;
			if (m.monthIndex < chartFromMonth || m.monthIndex > chartToMonth) return false;
			return true;
		})
	);

	const categoryBreakdown = $derived(() => {
		const map = new Map<string, number>();
		for (const month of filteredMonthsForChart) {
			for (const t of month.transactions) {
				if (!t.isExpense) continue;
				if (chartStatus !== 'all' && t.payment_status !== chartStatus) continue;
				if (t.category_ids.length === 0) {
					map.set('Uncategorized', (map.get('Uncategorized') || 0) + t.amount);
				} else {
					for (const cid of t.category_ids) {
						const name = appStore.getCategoryFullName(cid) || 'Unknown';
						map.set(name, (map.get(name) || 0) + t.amount);
					}
				}
			}
		}
		return Array.from(map.entries())
			.map(([label, value]) => ({ label, value }))
			.sort((a, b) => b.value - a.value);
	});

	const accountTypeBreakdown = $derived(() => {
		let personal = 0;
		let company = 0;
		for (const month of filteredMonthsForChart) {
			for (const t of month.transactions) {
				if (!t.isExpense) continue;
				if (chartStatus !== 'all' && t.payment_status !== chartStatus) continue;
				if (month.isPersonal) personal += t.amount;
				else company += t.amount;
			}
		}
		const result: { label: string; value: number }[] = [];
		if (personal > 0) result.push({ label: 'Personal', value: personal });
		if (company > 0) result.push({ label: 'Company', value: company });
		return result;
	});

	const chartFilterCount = $derived(() => {
		let count = 0;
		if (chartAccountFilter !== 'all') count++;
		if (chartStatus !== 'all') count++;
		if (chartMonthStatus !== 'all') count++;
		if (chartFromMonth !== 0 || chartToMonth !== 11) count++;
		if (chartYear !== currentDate.getFullYear()) count++;
		return count;
	});

	const goToPage = (page: number) => {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	};
</script>

{#if allMonthsForChart.length > 0}
	<Card class="w-full">
		<Header class="space-y-3">
			<div class="flex items-center justify-between">
				<Title class="text-xl font-bold">Expense Breakdown</Title>
				<Button
					variant="outline"
					size="sm"
					onclick={() => (showChartFilters = !showChartFilters)}
					class={chartFilterCount() > 0 ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : ''}
				>
					Filters{chartFilterCount() > 0 ? ` (${chartFilterCount()})` : ''}
				</Button>
			</div>
			{#if showChartFilters}
				<div class="flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
					<div class="flex flex-col gap-1">
						<label class="text-xs font-medium text-gray-500">Account</label>
						<select bind:value={chartAccountFilter} class="rounded border border-gray-300 px-2 py-1 text-sm">
							<option value="all">All</option>
							<option value="personal">Personal</option>
							<option value="company">Company</option>
						</select>
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs font-medium text-gray-500">Year</label>
						<select bind:value={chartYear} class="rounded border border-gray-300 px-2 py-1 text-sm">
							{#each SUPPORTED_YEARS as y}
								<option value={y}>{y}</option>
							{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs font-medium text-gray-500">From</label>
						<select bind:value={chartFromMonth} class="rounded border border-gray-300 px-2 py-1 text-sm">
							{#each MONTH_NAMES as name, i}
								<option value={i}>{name}</option>
							{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs font-medium text-gray-500">To</label>
						<select bind:value={chartToMonth} class="rounded border border-gray-300 px-2 py-1 text-sm">
							{#each MONTH_NAMES as name, i}
								<option value={i}>{name}</option>
							{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs font-medium text-gray-500">Payment</label>
						<select bind:value={chartStatus} class="rounded border border-gray-300 px-2 py-1 text-sm">
							<option value="all">All</option>
							<option value="paid">Paid</option>
							<option value="unpaid">Unpaid</option>
						</select>
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs font-medium text-gray-500">Month Status</label>
						<select bind:value={chartMonthStatus} class="rounded border border-gray-300 px-2 py-1 text-sm">
							<option value="all">All</option>
							<option value="active">Active</option>
							<option value="closed">Closed</option>
						</select>
					</div>
				</div>
			{/if}
			<p class="text-xs text-gray-500">{filteredMonthsForChart.length} month{filteredMonthsForChart.length !== 1 ? 's' : ''} matched</p>
		</Header>
		<Content class="p-4">
			{@const catData = categoryBreakdown()}
			{@const acctData = accountTypeBreakdown()}
			<div class="flex flex-wrap items-start justify-center gap-6">
				<DonutChart data={catData} title="By Category" width={280} height={280} />
				<DonutChart data={acctData} title="Personal vs Company" width={280} height={280} />
			</div>
			{#if catData.length > 0}
				<div class="mt-4">
					<h4 class="mb-2 text-sm font-medium text-gray-600">Category Legend</h4>
					<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
						{#each catData as item, i}
							<span class="flex items-center gap-1">
								<span class="inline-block h-2.5 w-2.5 rounded-full" style="background: {['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6','#a855f7','#d946ef','#f59e0b','#10b981'][i % 14]}"></span>
								{item.label}: ${item.value.toFixed(0)}
							</span>
						{/each}
					</div>
				</div>
			{/if}
		</Content>
	</Card>
{/if}

{#if closedMonths.length > 0}
	<Card class="w-full">
		<Header>
			<Title class="text-xl font-bold">Month History</Title>
			<p class="text-sm text-gray-500">{closedMonths.length} closed month{closedMonths.length !== 1 ? 's' : ''}</p>
		</Header>
		<Content class="p-4">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr class="border-b text-left text-sm text-gray-600">
							<th class="pb-2 font-medium">Month</th>
							<th class="pb-2 font-medium">Dates</th>
							<th class="pb-2 text-right font-medium">Total</th>
							<th class="pb-2 text-right font-medium">Paid</th>
							<th class="pb-2 text-right font-medium">Unpaid</th>
							<th class="pb-2 text-right font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each paginatedMonths as month (month.id)}
							<tr class="border-b last:border-0 hover:bg-gray-50">
								<td class="py-3">
									<span class="font-medium">{month.name}</span>
									<span class="ml-1 rounded px-1.5 py-0.5 text-xs font-medium {month.isCompany ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
										{month.isCompany ? 'Co' : 'Per'}
									</span>
								</td>
								<td class="py-3 text-sm text-gray-600">
									{formatDate(month.start)} - {formatDate(month.end)}
								</td>
								<td class="py-3 text-right text-blue-600">
									${month.total_amount.toFixed(2)}
								</td>
								<td class="py-3 text-right text-green-600">
									${month.total_paid.toFixed(2)}
								</td>
								<td class="py-3 text-right text-red-600">
									${month.total_unpaid.toFixed(2)}
								</td>
								<td class="py-3 text-right">
									<Button
										variant="ghost"
										size="sm"
										onclick={() => onSelectMonth(month)}
										class="h-8 px-2"
									>
										View
									</Button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Content>
		{#if totalPages > 1}
			<Footer class="flex items-center justify-between p-4">
				<span class="text-sm text-gray-500">
					Page {currentPage} of {totalPages}
				</span>
				<div class="flex gap-1">
					<Button variant="outline" size="sm" onclick={() => goToPage(1)} disabled={currentPage === 1}>First</Button>
					<Button variant="outline" size="sm" onclick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>Prev</Button>
					<Button variant="outline" size="sm" onclick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>Next</Button>
					<Button variant="outline" size="sm" onclick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>Last</Button>
				</div>
			</Footer>
		{/if}
	</Card>
{/if}
