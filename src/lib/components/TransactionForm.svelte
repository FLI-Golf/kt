<script lang="ts">
	import { type Transaction, type TransactionType, appStore } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Card, Header, Title, Content, Footer } from '$lib/components/ui/card';
	import CategorySelector from './CategorySelector.svelte';

	interface Props {
		transaction?: Transaction;
		onSave: (data: { description: string; amount: number; type: TransactionType; category_ids: string[]; note: string }) => void;
		onCancel: () => void;
	}

	let { transaction, onSave, onCancel }: Props = $props();

	let description = $state(transaction?.description ?? '');
	let amount = $state(transaction?.amount ?? 0);
	let type = $state<TransactionType>(transaction?.type ?? 'expense' as TransactionType);
	let category_ids = $state<string[]>(transaction?.category_ids ?? []);
	let note = $state(transaction?.note ?? '');

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		onSave({
			description,
			amount,
			type,
			category_ids,
			note
		});
	};

	const handleCategorySelect = (ids: string[]) => {
		category_ids = ids;
	};

	const isEditing = $derived(!!transaction);

	// Get selected category names for display
	const selectedCategoryNames = $derived(
		category_ids.map(id => appStore.getCategoryFullName(id)).filter(Boolean)
	);
</script>

<Card class="w-full max-w-2xl">
	<Header>
		<Title class="text-xl font-bold">{isEditing ? 'Edit Transaction' : 'Add Transaction'}</Title>
	</Header>
	<form onsubmit={handleSubmit}>
		<Content class="space-y-4 p-4">
			<div>
				<label class="text-sm font-medium">Type</label>
				<div class="mt-1 flex gap-2">
					<button
						type="button"
						onclick={() => type = 'expense'}
						class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors {type === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					>
						Expense
					</button>
					<button
						type="button"
						onclick={() => type = 'reimbursement'}
						class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors {type === 'reimbursement' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					>
						Income
					</button>
				</div>
			</div>
			<div>
				<label for="transaction-description" class="text-sm font-medium">Description</label>
				<Input
					id="transaction-description"
					type="text"
					placeholder={type === 'reimbursement' ? 'e.g., Client payment' : 'e.g., Office supplies'}
					bind:value={description}
					class="mt-1"
					required
				/>
			</div>
			<div>
				<label for="transaction-amount" class="text-sm font-medium">Amount ($)</label>
				<Input
					id="transaction-amount"
					type="number"
					step="0.01"
					min="0"
					placeholder="0.00"
					bind:value={amount}
					class="mt-1"
					required
				/>
			</div>
			<div>
				<label class="text-sm font-medium">Categories</label>
				{#if selectedCategoryNames.length > 0}
					<div class="mt-1 mb-2 flex flex-wrap gap-1">
						{#each selectedCategoryNames as name}
							<span class="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
								{name}
							</span>
						{/each}
					</div>
				{/if}
				<CategorySelector selectedIds={category_ids} onSelect={handleCategorySelect} />
			</div>
			<div>
				<label for="transaction-note" class="text-sm font-medium">Note (optional)</label>
				<Input
					id="transaction-note"
					type="text"
					placeholder="Any notes..."
					bind:value={note}
					class="mt-1"
				/>
			</div>
		</Content>
		<Footer class="flex justify-end gap-2 p-4">
			<Button type="button" variant="outline" onclick={onCancel}>Cancel</Button>
			<Button type="submit">{isEditing ? 'Update' : 'Add'}</Button>
		</Footer>
	</form>
</Card>
