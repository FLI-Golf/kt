<script lang="ts">
	import { appStore } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content, Footer } from '$lib/components/ui/card';

	interface Props {
		monthId: string;
		onClose: () => void;
	}

	let { monthId, onClose }: Props = $props();

	let checkNumber = $state('');
	let note = $state('');
	let selectedIds = $state<Set<string>>(new Set());

	// Filters
	let searchQuery = $state('');
	let filterCategory = $state<string>('all');
	let minAmount = $state<string>('');
	let maxAmount = $state<string>('');
	let showFilters = $state(false);

	// Sort
	type SortField = 'description' | 'amount' | 'category';
	type SortDir = 'asc' | 'desc';
	let sortField = $state<SortField>('description');
	let sortDir = $state<SortDir>('asc');

	// Column visibility
	let showColumnPicker = $state(false);
	let colDescription = $state(true);
	let colCategory = $state(true);
	let colAmount = $state(true);
	let colNote = $state(false);

	const columns = $derived([
		{ key: 'description', label: 'Description', get visible() { return colDescription; }, toggle: () => { colDescription = !colDescription; } },
		{ key: 'category', label: 'Category', get visible() { return colCategory; }, toggle: () => { colCategory = !colCategory; } },
		{ key: 'amount', label: 'Amount', get visible() { return colAmount; }, toggle: () => { colAmount = !colAmount; } },
		{ key: 'note', label: 'Note', get visible() { return colNote; }, toggle: () => { colNote = !colNote; } },
	]);

	const hiddenColCount = $derived(columns.filter(c => !c.visible).length);

	const month = $derived(appStore.getMonth(monthId));

	const unpaidTransactions = $derived(
		month ? month.transactions.filter(t => t.payment_status === 'unpaid' && t.isExpense) : []
	);

	// Available categories from unpaid transactions
	const availableCategories = $derived(() => {
		const catSet = new Map<string, string>();
		for (const t of unpaidTransactions) {
			for (const cid of t.category_ids) {
				const cat = appStore.getCategory(cid);
				if (cat) {
					const parentId = cat.parent_id;
					if (parentId) {
						const parent = appStore.getCategory(parentId);
						if (parent) { catSet.set(parentId, parent.name); continue; }
					}
					catSet.set(cid, cat.name);
				}
			}
		}
		return Array.from(catSet.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
	});

	// Filter pipeline
	const filteredTransactions = $derived(() => {
		let result = [...unpaidTransactions];

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(t =>
				t.description.toLowerCase().includes(q) ||
				(t.note && t.note.toLowerCase().includes(q))
			);
		}

		if (filterCategory !== 'all') {
			result = result.filter(t =>
				t.category_ids.some(cid => {
					if (cid === filterCategory) return true;
					const cat = appStore.getCategory(cid);
					return cat?.parent_id === filterCategory;
				})
			);
		}

		const min = minAmount ? parseFloat(minAmount) : null;
		const max = maxAmount ? parseFloat(maxAmount) : null;
		if (min !== null && !isNaN(min)) result = result.filter(t => t.amount >= min);
		if (max !== null && !isNaN(max)) result = result.filter(t => t.amount <= max);

		return result;
	});

	// Sort
	const sortedTransactions = $derived(() => {
		const filtered = filteredTransactions();
		return [...filtered].sort((a, b) => {
			let cmp = 0;
			switch (sortField) {
				case 'description':
					cmp = a.description.toLowerCase().localeCompare(b.description.toLowerCase());
					break;
				case 'amount':
					cmp = a.amount - b.amount;
					break;
				case 'category': {
					const aCat = a.category_ids.length > 0 ? appStore.getCategoryFullName(a.category_ids[0]) : '';
					const bCat = b.category_ids.length > 0 ? appStore.getCategoryFullName(b.category_ids[0]) : '';
					cmp = aCat.localeCompare(bCat);
					break;
				}
			}
			return sortDir === 'asc' ? cmp : -cmp;
		});
	});

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDir = 'asc';
		}
	};

	const getSortIndicator = (field: SortField) => {
		if (sortField !== field) return '';
		return sortDir === 'asc' ? ' ↑' : ' ↓';
	};

	const selectedTransactions = $derived(
		unpaidTransactions.filter(t => selectedIds.has(t.id))
	);

	const selectedTotal = $derived(
		selectedTransactions.reduce((sum, t) => sum + t.amount, 0)
	);

	const canSubmit = $derived(
		checkNumber.trim() !== '' && selectedIds.size > 0
	);

	const toggleTransaction = (id: string) => {
		const next = new Set(selectedIds);
		if (next.has(id)) { next.delete(id); } else { next.add(id); }
		selectedIds = next;
	};

	const toggleAllVisible = () => {
		const visible = sortedTransactions();
		const allSelected = visible.every(t => selectedIds.has(t.id));
		const next = new Set(selectedIds);
		if (allSelected) {
			for (const t of visible) next.delete(t.id);
		} else {
			for (const t of visible) next.add(t.id);
		}
		selectedIds = next;
	};

	const allVisibleSelected = $derived(() => {
		const visible = sortedTransactions();
		return visible.length > 0 && visible.every(t => selectedIds.has(t.id));
	});

	const activeFilterCount = $derived(() => {
		let count = 0;
		if (searchQuery.trim()) count++;
		if (filterCategory !== 'all') count++;
		if (minAmount) count++;
		if (maxAmount) count++;
		return count;
	});

	const clearFilters = () => {
		searchQuery = '';
		filterCategory = 'all';
		minAmount = '';
		maxAmount = '';
	};

	const handleSubmit = () => {
		if (!canSubmit || !month) return;
		const groupId = appStore.createPaymentGroup(
			checkNumber.trim(),
			note.trim(),
			selectedTransactions.map(t => ({
				transactionId: t.id,
				monthId: monthId,
				description: t.description,
				amount: t.amount,
			}))
		);
		if (groupId) {
			for (const t of selectedTransactions) {
				t.markPaid(checkNumber.trim(), groupId);
			}
			month.calculateTotals();
			appStore.save();
			onClose();
		}
	};

	const getCategoryNames = (categoryIds: string[]) => {
		return categoryIds.map(id => appStore.getCategoryFullName(id)).filter(Boolean).join(', ');
	};
</script>

<Card class="w-full">
	<Header class="space-y-3">
		<div class="flex items-center justify-between">
			<Title class="text-xl font-bold">Create Payment Group</Title>
			<div class="flex gap-2">
				<div class="relative">
					<Button
						variant="outline"
						size="sm"
						onclick={() => { showColumnPicker = !showColumnPicker; }}
						class={hiddenColCount > 0 ? 'border-orange-300 bg-orange-50 text-orange-700' : ''}
					>
						Columns{hiddenColCount > 0 ? ` (${hiddenColCount} hidden)` : ''}
					</Button>
					{#if showColumnPicker}
						<div class="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
							{#each columns as col}
								<label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
									<input type="checkbox" checked={col.visible} onchange={col.toggle} class="rounded" />
									{col.label}
								</label>
							{/each}
						</div>
					{/if}
				</div>
				<Button
					variant="outline"
					size="sm"
					onclick={() => (showFilters = !showFilters)}
					class={activeFilterCount() > 0 ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : ''}
				>
					Filters{activeFilterCount() > 0 ? ` (${activeFilterCount()})` : ''}
				</Button>
				<Button variant="outline" size="sm" onclick={onClose}>Cancel</Button>
			</div>
		</div>

		{#if showFilters}
			<div class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
				<div>
					<input
						type="text"
						placeholder="Search description or notes..."
						bind:value={searchQuery}
						class="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
				</div>
				<div class="flex flex-wrap gap-3">
					<div class="flex flex-col gap-1">
						<label class="text-xs font-medium text-gray-500">Category</label>
						<select bind:value={filterCategory} class="rounded border border-gray-300 px-2 py-1 text-sm">
							<option value="all">All Categories</option>
							{#each availableCategories() as cat}
								<option value={cat.id}>{cat.name}</option>
							{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs font-medium text-gray-500">Amount Range</label>
						<div class="flex items-center gap-1">
							<input type="number" placeholder="Min" bind:value={minAmount} class="w-20 rounded border border-gray-300 px-2 py-1 text-sm" step="0.01" min="0" />
							<span class="text-gray-400">-</span>
							<input type="number" placeholder="Max" bind:value={maxAmount} class="w-20 rounded border border-gray-300 px-2 py-1 text-sm" step="0.01" min="0" />
						</div>
					</div>
				</div>
				{#if activeFilterCount() > 0}
					<div class="flex items-center justify-between">
						<span class="text-xs text-gray-500">Showing {sortedTransactions().length} of {unpaidTransactions.length}</span>
						<button class="text-xs text-indigo-600 hover:text-indigo-800" onclick={clearFilters}>Clear all filters</button>
					</div>
				{/if}
			</div>
		{/if}
	</Header>
	<Content class="space-y-4 p-4">
		<!-- Check info -->
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Check Number *</label>
				<input
					type="text"
					bind:value={checkNumber}
					placeholder="e.g. 1234"
					class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Note (optional)</label>
				<input
					type="text"
					bind:value={note}
					placeholder="e.g. Weekly payment"
					class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				/>
			</div>
		</div>

		<!-- Summary bar -->
		<div class="flex items-center justify-between rounded-lg bg-indigo-50 px-4 py-3">
			<div class="text-sm">
				<span class="font-medium text-indigo-700">{selectedIds.size}</span>
				<span class="text-indigo-600"> transaction{selectedIds.size !== 1 ? 's' : ''} selected</span>
			</div>
			<div class="text-lg font-bold text-indigo-700">
				${selectedTotal.toFixed(2)}
			</div>
		</div>

		<!-- Transaction table -->
		{#if unpaidTransactions.length === 0}
			<p class="text-center text-sm text-gray-500">No unpaid expenses to group.</p>
		{:else}
			{@const visible = sortedTransactions()}
			<div class="max-h-96 overflow-auto">
				<table class="w-full text-sm">
					<thead class="sticky top-0 bg-white">
						<tr class="border-b text-left text-gray-600">
							<th class="pb-2 pr-2">
								<input
									type="checkbox"
									checked={allVisibleSelected()}
									onchange={toggleAllVisible}
									class="rounded"
									title="Select all visible"
								/>
							</th>
							{#if colDescription}
								<th class="pb-2 font-medium">
									<button onclick={() => toggleSort('description')} class="hover:text-indigo-600">
										Description{getSortIndicator('description')}
									</button>
								</th>
							{/if}
							{#if colCategory}
								<th class="pb-2 font-medium">
									<button onclick={() => toggleSort('category')} class="hover:text-indigo-600">
										Category{getSortIndicator('category')}
									</button>
								</th>
							{/if}
							{#if colAmount}
								<th class="pb-2 text-right font-medium">
									<button onclick={() => toggleSort('amount')} class="hover:text-indigo-600">
										Amount{getSortIndicator('amount')}
									</button>
								</th>
							{/if}
							{#if colNote}
								<th class="pb-2 font-medium">Note</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each visible as transaction (transaction.id)}
							{@const isSelected = selectedIds.has(transaction.id)}
							<tr
								class="cursor-pointer border-b last:border-0 transition-colors {isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}"
								onclick={() => toggleTransaction(transaction.id)}
							>
								<td class="py-2.5 pr-2">
									<input
										type="checkbox"
										checked={isSelected}
										onchange={() => toggleTransaction(transaction.id)}
										onclick={(e) => e.stopPropagation()}
										class="rounded"
									/>
								</td>
								{#if colDescription}
									<td class="py-2.5">
										<span class="font-medium">{transaction.description || '—'}</span>
									</td>
								{/if}
								{#if colCategory}
									<td class="py-2.5 text-xs text-gray-500">
										{getCategoryNames(transaction.category_ids) || '—'}
									</td>
								{/if}
								{#if colAmount}
									<td class="py-2.5 text-right font-medium text-red-600">
										${transaction.amount.toFixed(2)}
									</td>
								{/if}
								{#if colNote}
									<td class="py-2.5 text-xs text-gray-400">
										{transaction.note || '—'}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if visible.length === 0}
				<p class="text-center text-sm text-gray-500">No transactions match your filters.</p>
			{/if}
		{/if}
	</Content>
	<Footer class="flex items-center justify-between p-4">
		<p class="text-xs text-gray-500">
			Transactions will be marked as paid with check #{checkNumber || '...'}
		</p>
		<Button
			onclick={handleSubmit}
			disabled={!canSubmit}
			class={canSubmit ? 'bg-green-600 hover:bg-green-700' : ''}
		>
			Pay {selectedIds.size} Transaction{selectedIds.size !== 1 ? 's' : ''} — ${selectedTotal.toFixed(2)}
		</Button>
	</Footer>
</Card>
