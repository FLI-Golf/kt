<script lang="ts">
	import { appStore, MONTH_NAMES, SUPPORTED_YEARS, type AccountType } from '$lib/models';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';

	const currentDate = new Date();
	const currentYear = currentDate.getFullYear();
	const currentMonthIndex = currentDate.getMonth();

	let fromYear = $state(2024);
	let fromMonth = $state(0);
	let toYear = $state(2024);
	let toMonth = $state(1);
	let expanded = $state(false);
	let accountTab = $state<'all' | AccountType>('company');
	let showColumns = $state(false);

	let colDescription = $state(true);
	let colMonth = $state(true);
	let colType = $state(true);
	let colCategory = $state(true);
	let colAmount = $state(true);
	let colStatus = $state(true);

	const reportColumns = $derived([
		{ key: 'description', label: 'Description', get visible() { return colDescription; }, toggle: () => { colDescription = !colDescription; } },
		{ key: 'month', label: 'Month', get visible() { return colMonth; }, toggle: () => { colMonth = !colMonth; } },
		{ key: 'type', label: 'Type', get visible() { return colType; }, toggle: () => { colType = !colType; } },
		{ key: 'category', label: 'Category', get visible() { return colCategory; }, toggle: () => { colCategory = !colCategory; } },
		{ key: 'amount', label: 'Amount', get visible() { return colAmount; }, toggle: () => { colAmount = !colAmount; } },
		{ key: 'status', label: 'Status', get visible() { return colStatus; }, toggle: () => { colStatus = !colStatus; } },
	]);

	const hiddenColCount = $derived(reportColumns.filter(c => !c.visible).length);

	// All months (any status) that have expenses, filtered by date range
	const filteredMonths = $derived(
		appStore.months.filter(m => {
			if (accountTab !== 'all' && m.accountType !== accountTab) return false;
			const mStart = m.year * 12 + m.monthIndex;
			const rangeStart = fromYear * 12 + fromMonth;
			const rangeEnd = toYear * 12 + toMonth;
			return mStart >= rangeStart && mStart <= rangeEnd;
		}).sort((a, b) => {
			if (a.year !== b.year) return a.year - b.year;
			return a.monthIndex - b.monthIndex;
		})
	);

	// Collect all expense transactions across filtered months
	const allExpenses = $derived(
		filteredMonths.flatMap(m =>
			m.transactions
				.filter(t => t.isExpense)
				.map(t => ({
					id: t.id,
					description: t.description,
					amount: t.amount,
					category_ids: t.category_ids,
					payment_status: t.payment_status,
					monthName: m.name,
					accountType: m.accountType,
				}))
		)
	);

	const totals = $derived(() => {
		let total = 0;
		let paid = 0;
		let unpaid = 0;
		let count = 0;
		for (const t of allExpenses) {
			total += t.amount;
			if (t.payment_status === 'paid') paid += t.amount;
			else unpaid += t.amount;
			count++;
		}
		return { total, paid, unpaid, count };
	});

	// Active filter badges
	const filterBadges = $derived(() => {
		const badges: { label: string; value: string; color: string }[] = [];
		// Account type
		if (accountTab === 'company') badges.push({ label: 'Account', value: 'Company', color: 'bg-purple-100 text-purple-700' });
		else if (accountTab === 'personal') badges.push({ label: 'Account', value: 'Personal', color: 'bg-blue-100 text-blue-700' });
		else badges.push({ label: 'Account', value: 'All', color: 'bg-gray-100 text-gray-700' });
		// Date range
		const fromLabel = MONTH_NAMES[fromMonth].slice(0, 3);
		const toLabel = MONTH_NAMES[toMonth].slice(0, 3);
		badges.push({ label: 'Range', value: `${fromLabel} ${fromYear} → ${toLabel} ${toYear}`, color: 'bg-indigo-100 text-indigo-700' });
		// Months matched
		badges.push({ label: 'Months', value: String(filteredMonths.length), color: 'bg-amber-100 text-amber-700' });
		return badges;
	});

	const getCategoryNames = (ids: string[]) => {
		return ids.map(id => appStore.getCategoryFullName(id)).filter(Boolean).join(', ');
	};
</script>

<Card class="w-full">
	<Header class="space-y-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<div class="rounded-lg bg-indigo-100 p-1.5">
					<svg class="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
				</div>
				<Title class="text-lg font-bold">Results</Title>
			</div>
			<div class="flex gap-2">
				{#if expanded}
					<div class="relative">
					<Button
						variant="outline"
						size="sm"
						onclick={() => { showColumns = !showColumns; }}
						class={hiddenColCount > 0 ? 'border-orange-300 bg-orange-50 text-orange-700' : ''}
					>
						Columns{hiddenColCount > 0 ? ` (${hiddenColCount} hidden)` : ''}
					</Button>
					{#if showColumns}
						<div class="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
							{#each reportColumns as col}
								<label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
									<input type="checkbox" checked={col.visible} onchange={col.toggle} class="rounded" />
									{col.label}
								</label>
							{/each}
						</div>
					{/if}
				</div>
				{/if}
				<Button variant="outline" size="sm" onclick={() => (expanded = !expanded)}>
					{expanded ? 'Collapse' : 'Expand'}
				</Button>
			</div>
		</div>
		<div class="flex gap-1 rounded-lg bg-gray-100 p-1">
			<button
				class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {accountTab === 'company' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
				onclick={() => (accountTab = 'company')}
			>
				Company
			</button>
			<button
				class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {accountTab === 'personal' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
				onclick={() => (accountTab = 'personal')}
			>
				Personal
			</button>
			<button
				class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {accountTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
				onclick={() => (accountTab = 'all')}
			>
				All
			</button>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#each filterBadges() as badge}
				<span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium {badge.color}">
					<span class="text-[10px] uppercase opacity-70">{badge.label}</span>
					<svg class="h-3 w-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
					{badge.value}
				</span>
			{/each}
		</div>
	</Header>
	<Content class="p-4">
		<div class="flex flex-wrap items-end gap-3">
			<div class="flex items-center gap-2">
				<label class="text-sm font-medium text-gray-600">From</label>
				<select
					class="rounded border border-gray-300 px-2 py-1 text-sm"
					bind:value={fromMonth}
				>
					{#each MONTH_NAMES as name, i}
						<option value={i}>{name}</option>
					{/each}
				</select>
				<select
					class="rounded border border-gray-300 px-2 py-1 text-sm"
					bind:value={fromYear}
				>
					{#each SUPPORTED_YEARS as y}
						<option value={y}>{y}</option>
					{/each}
				</select>
			</div>
			<div class="flex items-center gap-2">
				<label class="text-sm font-medium text-gray-600">To</label>
				<select
					class="rounded border border-gray-300 px-2 py-1 text-sm"
					bind:value={toMonth}
				>
					{#each MONTH_NAMES as name, i}
						<option value={i}>{name}</option>
					{/each}
				</select>
				<select
					class="rounded border border-gray-300 px-2 py-1 text-sm"
					bind:value={toYear}
				>
					{#each SUPPORTED_YEARS as y}
						<option value={y}>{y}</option>
					{/each}
				</select>
			</div>
		</div>

		{@const t = totals()}
		<div class="mt-4 grid grid-cols-4 gap-3 text-center">
			<div class="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-3">
				<div class="mb-1 flex justify-center"><svg class="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
				<p class="text-xs text-gray-500">Total Expenses</p>
				<p class="text-lg font-bold text-blue-600">${t.total.toFixed(2)}</p>
			</div>
			<div class="rounded-lg bg-gradient-to-br from-green-50 to-green-100 p-3">
				<div class="mb-1 flex justify-center"><svg class="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
				<p class="text-xs text-gray-500">Paid</p>
				<p class="text-lg font-bold text-green-600">${t.paid.toFixed(2)}</p>
			</div>
			<div class="rounded-lg bg-gradient-to-br from-red-50 to-red-100 p-3">
				<div class="mb-1 flex justify-center"><svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
				<p class="text-xs text-gray-500">Unpaid</p>
				<p class="text-lg font-bold text-red-600">${t.unpaid.toFixed(2)}</p>
			</div>
			<div class="rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 p-3">
				<div class="mb-1 flex justify-center"><svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg></div>
				<p class="text-xs text-gray-500">Count</p>
				<p class="text-lg font-bold text-gray-700">{t.count}</p>
			</div>
		</div>

		{#if expanded}
			<div class="mt-4">
				{#if allExpenses.length === 0}
					<p class="text-center text-sm text-gray-400">No expenses in this range.</p>
				{:else}
					<div class="max-h-96 overflow-y-auto">
						<table class="w-full text-left text-sm">
							<thead class="sticky top-0 bg-white text-xs text-gray-500">
								<tr>
									{#if colDescription}<th class="pb-2 font-medium">Description</th>{/if}
									{#if colMonth}<th class="pb-2 font-medium">Month</th>{/if}
									{#if colType}<th class="pb-2 font-medium">Type</th>{/if}
									{#if colCategory}<th class="pb-2 font-medium">Category</th>{/if}
									{#if colAmount}<th class="pb-2 text-right font-medium">Amount</th>{/if}
									{#if colStatus}<th class="pb-2 text-right font-medium">Status</th>{/if}
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each allExpenses as expense (expense.id)}
									<tr class="hover:bg-gray-50">
										{#if colDescription}<td class="py-2 pr-2">{expense.description || '—'}</td>{/if}
										{#if colMonth}<td class="py-2 pr-2 text-xs text-gray-500">{expense.monthName}</td>{/if}
										{#if colType}
										<td class="py-2 pr-2">
											<span class="rounded px-1.5 py-0.5 text-xs font-medium {expense.accountType === 'company' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
												{expense.accountType === 'company' ? 'Company' : 'Personal'}
											</span>
										</td>
										{/if}
										{#if colCategory}<td class="py-2 pr-2 text-xs text-gray-500">{getCategoryNames(expense.category_ids) || '—'}</td>{/if}
										{#if colAmount}<td class="py-2 text-right font-medium">${expense.amount.toFixed(2)}</td>{/if}
										{#if colStatus}
										<td class="py-2 text-right">
											<span class="rounded px-1.5 py-0.5 text-xs font-medium {expense.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
												{expense.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
											</span>
										</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}
	</Content>
</Card>
