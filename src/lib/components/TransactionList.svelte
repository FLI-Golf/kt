<script lang="ts">
	import { type Transaction, appStore } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content, Footer } from '$lib/components/ui/card';

	interface Props {
		transactions: Transaction[];
		onAddTransaction: () => void;
		onEditTransaction: (id: string) => void;
		onDeleteTransaction: (id: string) => void;
		onMoveTransaction?: (id: string) => void;
		moveLabel?: string;
	}

	let { transactions, onAddTransaction, onEditTransaction, onDeleteTransaction, onMoveTransaction, moveLabel = 'Move' }: Props = $props();

	// Filters
	let searchQuery = $state('');
	let filterType = $state<'all' | 'expense' | 'reimbursement' | 'refund'>('expense');
	let filterStatus = $state<'all' | 'paid' | 'unpaid'>('all');
	let filterCategory = $state<string>('all');
	let minAmount = $state<string>('');
	let maxAmount = $state<string>('');
	let showFilters = $state(false);
	let showColumns = $state(false);

	// Column visibility
	let colType = $state(true);
	let colDescription = $state(true);
	let colCategories = $state(true);
	let colAmount = $state(true);
	let colStatus = $state(true);
	let colActions = $state(true);

	const columns = $derived([
		{ key: 'type', label: 'Type', get visible() { return colType; }, toggle: () => { colType = !colType; } },
		{ key: 'description', label: 'Description', get visible() { return colDescription; }, toggle: () => { colDescription = !colDescription; } },
		{ key: 'categories', label: 'Categories', get visible() { return colCategories; }, toggle: () => { colCategories = !colCategories; } },
		{ key: 'amount', label: 'Amount', get visible() { return colAmount; }, toggle: () => { colAmount = !colAmount; } },
		{ key: 'status', label: 'Status', get visible() { return colStatus; }, toggle: () => { colStatus = !colStatus; } },
		{ key: 'actions', label: 'Actions', get visible() { return colActions; }, toggle: () => { colActions = !colActions; } },
	]);

	const hiddenCount = $derived(columns.filter(c => !c.visible).length);

	// Sort
	type SortField = 'description' | 'amount' | 'category' | 'status' | 'type';
	type SortDirection = 'asc' | 'desc';
	let sortField = $state<SortField>('description');
	let sortDirection = $state<SortDirection>('asc');

	// Pagination
	const PAGE_SIZE = 10;
	let currentPage = $state(1);

	// Get unique top-level categories from current transactions
	const availableCategories = $derived(() => {
		const catSet = new Map<string, string>();
		for (const t of transactions) {
			for (const cid of t.category_ids) {
				const cat = appStore.getCategory(cid);
				if (cat) {
					const parentId = cat.parent_id;
					if (parentId) {
						const parent = appStore.getCategory(parentId);
						if (parent) {
							catSet.set(parentId, parent.name);
							continue;
						}
					}
					catSet.set(cid, cat.name);
				}
			}
		}
		return Array.from(catSet.entries())
			.map(([id, name]) => ({ id, name }))
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
		currentPage = 1;
	};

	// Filter pipeline
	const filteredTransactions = $derived(() => {
		let result = [...transactions];

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(t =>
				t.description.toLowerCase().includes(q) ||
				(t.note && t.note.toLowerCase().includes(q))
			);
		}

		if (filterType !== 'all') {
			result = result.filter(t => t.type === filterType);
		}

		if (filterStatus !== 'all') {
			result = result.filter(t => t.payment_status === filterStatus);
		}

		if (filterCategory !== 'all') {
			result = result.filter(t => {
				return t.category_ids.some(cid => {
					if (cid === filterCategory) return true;
					const cat = appStore.getCategory(cid);
					return cat?.parent_id === filterCategory;
				});
			});
		}

		const min = minAmount ? parseFloat(minAmount) : null;
		const max = maxAmount ? parseFloat(maxAmount) : null;
		if (min !== null && !isNaN(min)) {
			result = result.filter(t => t.amount >= min);
		}
		if (max !== null && !isNaN(max)) {
			result = result.filter(t => t.amount <= max);
		}

		return result;
	});

	const sortedTransactions = $derived(() => {
		const filtered = filteredTransactions();
		return [...filtered].sort((a, b) => {
			let aVal: string | number;
			let bVal: string | number;

			switch (sortField) {
				case 'description':
					aVal = a.description.toLowerCase();
					bVal = b.description.toLowerCase();
					break;
				case 'amount':
					aVal = a.amount;
					bVal = b.amount;
					break;
				case 'category':
					aVal = a.category_ids.length > 0 ? appStore.getCategoryFullName(a.category_ids[0]) : '';
					bVal = b.category_ids.length > 0 ? appStore.getCategoryFullName(b.category_ids[0]) : '';
					break;
				case 'status':
					aVal = a.payment_status;
					bVal = b.payment_status;
					break;
				case 'type':
					aVal = a.type;
					bVal = b.type;
					break;
				default:
					aVal = a.description.toLowerCase();
					bVal = b.description.toLowerCase();
			}

			if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
			if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		});
	});

	const totalFiltered = $derived(filteredTransactions().length);
	const totalPages = $derived(Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE)));
	const paginatedTransactions = $derived(() => {
		const sorted = sortedTransactions();
		const start = (currentPage - 1) * PAGE_SIZE;
		return sorted.slice(start, start + PAGE_SIZE);
	});

	// Reset page when filters change
	$effect(() => {
		searchQuery; filterType; filterStatus; filterCategory; minAmount; maxAmount;
		currentPage = 1;
	});

	const activeFilterCount = $derived(() => {
		let count = 0;
		if (searchQuery.trim()) count++;
		if (filterType !== 'all') count++;
		if (filterStatus !== 'all') count++;
		if (filterCategory !== 'all') count++;
		if (minAmount) count++;
		if (maxAmount) count++;
		return count;
	});

	const clearFilters = () => {
		searchQuery = '';
		filterType = 'all';
		filterStatus = 'all';
		filterCategory = 'all';
		minAmount = '';
		maxAmount = '';
	};

	const getSortIndicator = (field: SortField) => {
		if (sortField !== field) return '';
		return sortDirection === 'asc' ? ' ↑' : ' ↓';
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'paid': return 'bg-green-100 text-green-700';
			case 'unpaid': return 'bg-red-100 text-red-700';
			default: return 'bg-gray-100 text-gray-700';
		}
	};

	const getTypeBadge = (type: string) => {
		return type === 'reimbursement' || type === 'refund'
			? 'bg-green-100 text-green-700'
			: 'bg-red-100 text-red-700';
	};

	const getCategoryNames = (categoryIds: string[]) => {
		return categoryIds.map(id => appStore.getCategoryFullName(id)).filter(Boolean);
	};

	const goToPage = (page: number) => {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	};
</script>

<Card class="w-full">
	<Header class="space-y-3">
		<div class="flex items-center justify-between">
			<Title class="text-xl font-bold">Transactions ({transactions.length})</Title>
			<div class="flex gap-2">
				<div class="relative">
					<Button
						variant="outline"
						size="sm"
						onclick={() => { showColumns = !showColumns; }}
						class={hiddenCount > 0 ? 'border-orange-300 bg-orange-50 text-orange-700' : ''}
					>
						Columns{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''}
					</Button>
					{#if showColumns}
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
				<Button onclick={onAddTransaction} size="sm">+ Add</Button>
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
						<label class="text-xs font-medium text-gray-500">Type</label>
						<select bind:value={filterType} class="rounded border border-gray-300 px-2 py-1 text-sm">
							<option value="all">All Types</option>
							<option value="expense">Expense</option>
							<option value="reimbursement">Reimbursement</option>
							<option value="refund">Refund</option>
						</select>
					</div>

					<div class="flex flex-col gap-1">
						<label class="text-xs font-medium text-gray-500">Status</label>
						<select bind:value={filterStatus} class="rounded border border-gray-300 px-2 py-1 text-sm">
							<option value="all">All Statuses</option>
							<option value="paid">Paid</option>
							<option value="unpaid">Unpaid</option>
						</select>
					</div>

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
							<input
								type="number"
								placeholder="Min"
								bind:value={minAmount}
								class="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
								step="0.01"
								min="0"
							/>
							<span class="text-gray-400">-</span>
							<input
								type="number"
								placeholder="Max"
								bind:value={maxAmount}
								class="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
								step="0.01"
								min="0"
							/>
						</div>
					</div>
				</div>

				{#if activeFilterCount() > 0}
					<div class="flex items-center justify-between">
						<span class="text-xs text-gray-500">
							Showing {totalFiltered} of {transactions.length} transactions
						</span>
						<button
							class="text-xs text-indigo-600 hover:text-indigo-800"
							onclick={clearFilters}
						>
							Clear all filters
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</Header>
	<Content class="p-4">
		{#if transactions.length === 0}
			<p class="text-center text-gray-500">No transactions yet. Add one to get started.</p>
		{:else if totalFiltered === 0}
			<p class="text-center text-gray-500">No transactions match your filters.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr class="border-b text-left text-sm text-gray-600">
							{#if colType}
							<th class="pb-2 font-medium">
								<button onclick={() => toggleSort('type')} class="hover:text-indigo-600">
									Type{getSortIndicator('type')}
								</button>
							</th>
							{/if}
							{#if colDescription}
							<th class="pb-2 font-medium">
								<button onclick={() => toggleSort('description')} class="hover:text-indigo-600">
									Description{getSortIndicator('description')}
								</button>
							</th>
							{/if}
							{#if colCategories}
							<th class="pb-2 font-medium">
								<button onclick={() => toggleSort('category')} class="hover:text-indigo-600">
									Categories{getSortIndicator('category')}
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
							{#if colStatus}
							<th class="pb-2 text-center font-medium">
								<button onclick={() => toggleSort('status')} class="hover:text-indigo-600">
									Status{getSortIndicator('status')}
								</button>
							</th>
							{/if}
							{#if colActions}
							<th class="pb-2 text-right font-medium">Actions</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each paginatedTransactions() as transaction (transaction.id)}
							{@const categories = getCategoryNames(transaction.category_ids)}
							<tr class="border-b last:border-0">
								{#if colType}
								<td class="py-3">
									<span class="rounded px-2 py-0.5 text-xs font-medium {getTypeBadge(transaction.type)}">
										{transaction.type}
									</span>
								</td>
								{/if}
								{#if colDescription}
								<td class="py-3">
									<div class="flex items-center gap-1.5">
										<span class="font-medium">{transaction.description}</span>
										{#if transaction.hasImages}
											<span class="inline-flex items-center gap-0.5 rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-600" title="{transaction.imageCount} image(s)">
												<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
												{transaction.imageCount}
											</span>
										{/if}
									</div>
									{#if transaction.note}
										<p class="text-xs text-gray-500">{transaction.note}</p>
									{/if}
								</td>
								{/if}
								{#if colCategories}
								<td class="py-3">
									{#if categories.length > 0}
										<div class="flex flex-wrap gap-1">
											{#each categories as cat}
												<span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
													{cat}
												</span>
											{/each}
										</div>
									{:else}
										<span class="text-gray-400">-</span>
									{/if}
								</td>
								{/if}
								{#if colAmount}
								<td class="py-3 text-right font-medium {transaction.type !== 'expense' ? 'text-green-600' : 'text-red-600'}">
									{transaction.type !== 'expense' ? '+' : '-'}${transaction.amount.toFixed(2)}
								</td>
								{/if}
								{#if colStatus}
								<td class="py-3 text-center">
									{#if transaction.type === 'expense'}
										<span class="rounded px-2 py-0.5 text-xs font-medium {getStatusBadge(transaction.payment_status)}">
											{transaction.payment_status}
										</span>
									{:else}
										<span class="text-gray-400">-</span>
									{/if}
								</td>
								{/if}
								{#if colActions}
								<td class="py-3 text-right">
									<div class="flex justify-end gap-1">
										{#if onMoveTransaction}
											<Button
												variant="ghost"
												size="sm"
												onclick={() => onMoveTransaction(transaction.id)}
												class="h-8 px-2 text-indigo-600 hover:bg-indigo-50"
											>
												{moveLabel}
											</Button>
										{/if}
										<Button
											variant="ghost"
											size="sm"
											onclick={() => onEditTransaction(transaction.id)}
											class="h-8 px-2"
										>
											Edit
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={() => onDeleteTransaction(transaction.id)}
											class="h-8 px-2 text-red-600 hover:bg-red-50"
										>
											Delete
										</Button>
									</div>
								</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Content>
	{#if totalPages > 1}
		<Footer class="flex items-center justify-between p-4">
			<span class="text-sm text-gray-500">
				{(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalFiltered)} of {totalFiltered}
			</span>
			<div class="flex gap-1">
				<Button variant="outline" size="sm" onclick={() => goToPage(1)} disabled={currentPage === 1}>First</Button>
				<Button variant="outline" size="sm" onclick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>Prev</Button>
				<span class="flex items-center px-2 text-sm text-gray-600">{currentPage}/{totalPages}</span>
				<Button variant="outline" size="sm" onclick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>Next</Button>
				<Button variant="outline" size="sm" onclick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>Last</Button>
			</div>
		</Footer>
	{/if}
</Card>
