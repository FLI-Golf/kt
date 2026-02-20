<script lang="ts">
	import { type Transaction, appStore } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';

	interface Props {
		transactions: Transaction[];
		onAddTransaction: () => void;
		onEditTransaction: (id: string) => void;
		onDeleteTransaction: (id: string) => void;
		onMoveTransaction?: (id: string) => void;
		moveLabel?: string;
	}

	let { transactions, onAddTransaction, onEditTransaction, onDeleteTransaction, onMoveTransaction, moveLabel = 'Move' }: Props = $props();

	type SortField = 'description' | 'amount' | 'category' | 'status' | 'type';
	type SortDirection = 'asc' | 'desc';

	let sortField = $state<SortField>('description');
	let sortDirection = $state<SortDirection>('asc');

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	};

	const sortedTransactions = $derived([...transactions].sort((a, b) => {
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
	}));

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
</script>

<Card class="w-full">
	<Header class="flex flex-row items-center justify-between">
		<Title class="text-xl font-bold">Transactions ({transactions.length})</Title>
		<Button onclick={onAddTransaction} size="sm">+ Add Transaction</Button>
	</Header>
	<Content class="p-4">
		{#if transactions.length === 0}
			<p class="text-center text-gray-500">No transactions yet. Add one to get started.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr class="border-b text-left text-sm text-gray-600">
							<th class="pb-2 font-medium">
								<button onclick={() => toggleSort('type')} class="hover:text-indigo-600">
									Type{getSortIndicator('type')}
								</button>
							</th>
							<th class="pb-2 font-medium">
								<button onclick={() => toggleSort('description')} class="hover:text-indigo-600">
									Description{getSortIndicator('description')}
								</button>
							</th>
							<th class="pb-2 font-medium">
								<button onclick={() => toggleSort('category')} class="hover:text-indigo-600">
									Categories{getSortIndicator('category')}
								</button>
							</th>
							<th class="pb-2 text-right font-medium">
								<button onclick={() => toggleSort('amount')} class="hover:text-indigo-600">
									Amount{getSortIndicator('amount')}
								</button>
							</th>
							<th class="pb-2 text-center font-medium">
								<button onclick={() => toggleSort('status')} class="hover:text-indigo-600">
									Status{getSortIndicator('status')}
								</button>
							</th>
							<th class="pb-2 text-right font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedTransactions as transaction (transaction.id)}
							{@const categories = getCategoryNames(transaction.category_ids)}
							<tr class="border-b last:border-0">
								<td class="py-3">
									<span class="rounded px-2 py-0.5 text-xs font-medium {getTypeBadge(transaction.type)}">
										{transaction.type}
									</span>
								</td>
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
								<td class="py-3 text-right font-medium {transaction.type !== 'expense' ? 'text-green-600' : 'text-red-600'}">
									{transaction.type !== 'expense' ? '+' : '-'}${transaction.amount.toFixed(2)}
								</td>
								<td class="py-3 text-center">
									{#if transaction.type === 'expense'}
										<span class="rounded px-2 py-0.5 text-xs font-medium {getStatusBadge(transaction.payment_status)}">
											{transaction.payment_status}
										</span>
									{:else}
										<span class="text-gray-400">-</span>
									{/if}
								</td>
								<td class="py-3 text-right">
									<div class="flex justify-end gap-1">
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
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Content>
</Card>
