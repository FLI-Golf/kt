<script lang="ts">
	import { appStore, type Month } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content, Footer } from '$lib/components/ui/card';
	import ExpenseReport from './ExpenseReport.svelte';

	interface Props {
		onSelectMonth: (month: Month) => void;
		onCreateMonth: () => void;
	}

	let { onSelectMonth, onCreateMonth }: Props = $props();

	let activeTab = $state<'all' | 'personal' | 'company'>('all');

	type MonthSortField = 'date' | 'name' | 'amount' | 'count';
	type SortDir = 'asc' | 'desc';
	let sortField = $state<MonthSortField>('date');
	let sortDir = $state<SortDir>('desc');

	const formatDate = (iso: string) => {
		return new Date(iso).toLocaleDateString();
	};

	// Only show active and pending_close months (not closed - those go in MonthHistory)
	const allActiveMonths = $derived(
		appStore.months
			.filter(m => !m.isClosed)
			.sort((a, b) => {
				let cmp = 0;
				switch (sortField) {
					case 'date':
						cmp = a.year !== b.year ? a.year - b.year : a.monthIndex - b.monthIndex;
						break;
					case 'name':
						cmp = a.name.localeCompare(b.name);
						break;
					case 'amount':
						cmp = a.total_amount - b.total_amount;
						break;
					case 'count':
						cmp = a.transactionCount - b.transactionCount;
						break;
				}
				return sortDir === 'asc' ? cmp : -cmp;
			})
	);

	const toggleSort = (field: MonthSortField) => {
		if (sortField === field) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDir = field === 'date' ? 'desc' : 'asc';
		}
		monthsPage = 1;
	};

	const getSortIndicator = (field: MonthSortField) => {
		if (sortField !== field) return '';
		return sortDir === 'asc' ? ' ↑' : ' ↓';
	};

	const activeMonths = $derived(
		activeTab === 'all'
			? allActiveMonths
			: allActiveMonths.filter(m => m.accountType === activeTab)
	);

	const personalCount = $derived(allActiveMonths.filter(m => m.isPersonal).length);
	const companyCount = $derived(allActiveMonths.filter(m => m.isCompany).length);

	const MONTHS_PAGE_SIZE = 5;
	let monthsPage = $state(1);

	const monthsTotalPages = $derived(Math.max(1, Math.ceil(activeMonths.length / MONTHS_PAGE_SIZE)));
	const paginatedMonths = $derived(
		activeMonths.slice((monthsPage - 1) * MONTHS_PAGE_SIZE, monthsPage * MONTHS_PAGE_SIZE)
	);

	// Reset page when tab changes
	$effect(() => {
		activeTab;
		monthsPage = 1;
	});

	const goToMonthsPage = (page: number) => {
		if (page >= 1 && page <= monthsTotalPages) {
			monthsPage = page;
		}
	};



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
	<ExpenseReport />

	<Card class="w-full">
		<Header class="space-y-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="rounded-lg bg-emerald-100 p-1.5">
						<svg class="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
					<Title class="text-xl font-bold">Active Months</Title>
				</div>
				<Button onclick={onCreateMonth} size="sm">+ New Month</Button>
			</div>
			<div class="flex gap-1 rounded-lg bg-gray-100 p-1">
				<button
					class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {activeTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
					onclick={() => (activeTab = 'all')}
				>
					All ({allActiveMonths.length})
				</button>
				<button
					class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {activeTab === 'personal' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
					onclick={() => (activeTab = 'personal')}
				>
					Personal ({personalCount})
				</button>
				<button
					class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {activeTab === 'company' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
					onclick={() => (activeTab = 'company')}
				>
					Company ({companyCount})
				</button>
			</div>
			<div class="flex items-center gap-2 text-xs text-gray-500">
				<span class="font-medium">Sort:</span>
				<button class="rounded px-2 py-1 hover:bg-gray-200 {sortField === 'date' ? 'bg-gray-200 font-medium text-gray-900' : ''}" onclick={() => toggleSort('date')}>Date{getSortIndicator('date')}</button>
				<button class="rounded px-2 py-1 hover:bg-gray-200 {sortField === 'name' ? 'bg-gray-200 font-medium text-gray-900' : ''}" onclick={() => toggleSort('name')}>Name{getSortIndicator('name')}</button>
				<button class="rounded px-2 py-1 hover:bg-gray-200 {sortField === 'amount' ? 'bg-gray-200 font-medium text-gray-900' : ''}" onclick={() => toggleSort('amount')}>Amount{getSortIndicator('amount')}</button>
				<button class="rounded px-2 py-1 hover:bg-gray-200 {sortField === 'count' ? 'bg-gray-200 font-medium text-gray-900' : ''}" onclick={() => toggleSort('count')}>Count{getSortIndicator('count')}</button>
			</div>
		</Header>
		<Content class="p-4">
			{#if activeMonths.length === 0}
				<p class="text-center text-gray-500">No active months. Create one to get started.</p>
			{:else}
				<div class="space-y-2">
					{#each paginatedMonths as month (month.id)}
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
		{#if monthsTotalPages > 1}
			<Footer class="flex items-center justify-between p-4">
				<span class="text-sm text-gray-500">
					{(monthsPage - 1) * MONTHS_PAGE_SIZE + 1}-{Math.min(monthsPage * MONTHS_PAGE_SIZE, activeMonths.length)} of {activeMonths.length}
				</span>
				<div class="flex gap-1">
					<Button variant="outline" size="sm" onclick={() => goToMonthsPage(1)} disabled={monthsPage === 1}>First</Button>
					<Button variant="outline" size="sm" onclick={() => goToMonthsPage(monthsPage - 1)} disabled={monthsPage === 1}>Prev</Button>
					<span class="flex items-center px-2 text-sm text-gray-600">{monthsPage}/{monthsTotalPages}</span>
					<Button variant="outline" size="sm" onclick={() => goToMonthsPage(monthsPage + 1)} disabled={monthsPage === monthsTotalPages}>Next</Button>
					<Button variant="outline" size="sm" onclick={() => goToMonthsPage(monthsTotalPages)} disabled={monthsPage === monthsTotalPages}>Last</Button>
				</div>
			</Footer>
		{/if}
	</Card>
</div>
