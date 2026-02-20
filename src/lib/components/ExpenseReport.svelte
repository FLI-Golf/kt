<script lang="ts">
	import { appStore, MONTH_NAMES, SUPPORTED_YEARS } from '$lib/models';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';

	const currentDate = new Date();
	const currentYear = currentDate.getFullYear();
	const currentMonthIndex = currentDate.getMonth();

	let fromYear = $state(currentYear);
	let fromMonth = $state(0);
	let toYear = $state(currentYear);
	let toMonth = $state(currentMonthIndex);
	let expanded = $state(false);

	// All months (any status) that have expenses, filtered by date range
	const filteredMonths = $derived(
		appStore.months.filter(m => {
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

	const getCategoryNames = (ids: string[]) => {
		return ids.map(id => appStore.getCategoryFullName(id)).filter(Boolean).join(', ');
	};
</script>

<Card class="w-full">
	<Header class="flex flex-row items-center justify-between">
		<Title class="text-lg font-bold">Expense Report</Title>
		<Button variant="outline" size="sm" onclick={() => (expanded = !expanded)}>
			{expanded ? 'Collapse' : 'Expand'}
		</Button>
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
			<div class="rounded-lg bg-blue-50 p-3">
				<p class="text-xs text-gray-500">Total Expenses</p>
				<p class="text-lg font-bold text-blue-600">${t.total.toFixed(2)}</p>
			</div>
			<div class="rounded-lg bg-green-50 p-3">
				<p class="text-xs text-gray-500">Paid</p>
				<p class="text-lg font-bold text-green-600">${t.paid.toFixed(2)}</p>
			</div>
			<div class="rounded-lg bg-red-50 p-3">
				<p class="text-xs text-gray-500">Unpaid</p>
				<p class="text-lg font-bold text-red-600">${t.unpaid.toFixed(2)}</p>
			</div>
			<div class="rounded-lg bg-gray-50 p-3">
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
									<th class="pb-2 font-medium">Description</th>
									<th class="pb-2 font-medium">Month</th>
									<th class="pb-2 font-medium">Type</th>
									<th class="pb-2 font-medium">Category</th>
									<th class="pb-2 text-right font-medium">Amount</th>
									<th class="pb-2 text-right font-medium">Status</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each allExpenses as expense (expense.id)}
									<tr class="hover:bg-gray-50">
										<td class="py-2 pr-2">{expense.description || '—'}</td>
										<td class="py-2 pr-2 text-xs text-gray-500">{expense.monthName}</td>
										<td class="py-2 pr-2">
											<span class="rounded px-1.5 py-0.5 text-xs font-medium {expense.accountType === 'company' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
												{expense.accountType === 'company' ? 'Company' : 'Personal'}
											</span>
										</td>
										<td class="py-2 pr-2 text-xs text-gray-500">{getCategoryNames(expense.category_ids) || '—'}</td>
										<td class="py-2 text-right font-medium">${expense.amount.toFixed(2)}</td>
										<td class="py-2 text-right">
											<span class="rounded px-1.5 py-0.5 text-xs font-medium {expense.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
												{expense.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
											</span>
										</td>
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
