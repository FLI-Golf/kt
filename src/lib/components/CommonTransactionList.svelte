<script lang="ts">
	import { appStore, type CommonTransaction } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';
	import CategorySelector from './CategorySelector.svelte';

	interface Props {
		onSelect: (ct: CommonTransaction) => void;
	}

	let { onSelect }: Props = $props();

	let showAddForm = $state(false);
	let newDescription = $state('');
	let newCategoryIds = $state<string[]>([]);

	const handleAddCommonTransaction = (e: Event) => {
		e.preventDefault();
		if (newDescription) {
			appStore.addCommonTransaction(newDescription, 0, newCategoryIds);
			newDescription = '';
			newCategoryIds = [];
			showAddForm = false;
		}
	};

	const handleCategorySelect = (ids: string[]) => {
		newCategoryIds = ids;
	};

	const getCategoryNames = (categoryIds: string[]) => {
		return categoryIds.map(id => appStore.getCategoryFullName(id)).filter(Boolean);
	};
</script>

<Card class="w-full">
	<Header class="flex flex-row items-center justify-between">
		<Title class="text-lg font-bold">Common Expenses</Title>
		<Button onclick={() => (showAddForm = !showAddForm)} size="sm" variant="outline">
			{showAddForm ? 'Cancel' : '+ Add'}
		</Button>
	</Header>
	<Content class="p-3">
		{#if showAddForm}
			<form onsubmit={handleAddCommonTransaction} class="mb-3 space-y-2 rounded-lg border bg-gray-50 p-3">
				<Input
					type="text"
					placeholder="Description"
					bind:value={newDescription}
					required
				/>
				<div class="max-h-48 overflow-y-auto">
					<p class="text-xs text-gray-500 mb-1">Categories (optional)</p>
					<div class="border rounded overflow-hidden">
						{#each appStore.parentCategories as parent, parentIndex (parent.id)}
							{@const children = appStore.getChildCategories(parent.id)}
							<div class="{parentIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
								<button
									type="button"
									onclick={() => {
										if (newCategoryIds.includes(parent.id)) {
											newCategoryIds = newCategoryIds.filter(id => id !== parent.id);
										} else {
											newCategoryIds = [...newCategoryIds, parent.id];
										}
									}}
									class="w-full text-left px-2 py-1.5 text-xs font-medium transition-colors {newCategoryIds.includes(parent.id) ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-indigo-50'}"
								>
									{parent.name}
									{#if newCategoryIds.includes(parent.id)}
										<span class="float-right">✓</span>
									{/if}
								</button>
								{#if children.length > 0}
									<div class="ml-3 border-l border-gray-200">
										{#each children as child, childIndex (child.id)}
											<button
												type="button"
												onclick={() => {
													if (newCategoryIds.includes(child.id)) {
														newCategoryIds = newCategoryIds.filter(id => id !== child.id);
													} else {
														newCategoryIds = [...newCategoryIds, child.id];
													}
												}}
												class="w-full text-left px-2 py-1 text-xs transition-colors {newCategoryIds.includes(child.id) ? 'bg-indigo-100 text-indigo-700' : childIndex % 2 === 0 ? 'bg-white hover:bg-indigo-50' : 'bg-gray-50 hover:bg-indigo-50'}"
											>
												{child.name}
												{#if newCategoryIds.includes(child.id)}
													<span class="float-right">✓</span>
												{/if}
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
				<Button type="submit" size="sm" class="w-full">Add to Common Expenses</Button>
			</form>
		{/if}

		{#if appStore.commonTransactions.length === 0}
			<p class="text-center text-sm text-gray-500">No common expenses saved. Add some for quick reuse.</p>
		{:else}
			<div class="space-y-1">
				{#each appStore.commonTransactions as ct (ct.id)}
					{@const categories = getCategoryNames(ct.category_ids)}
					<div
						class="flex items-center justify-between rounded-lg border bg-white p-2 transition-all hover:border-indigo-300 hover:shadow-sm"
					>
						<button
							type="button"
							onclick={() => onSelect(ct)}
							class="flex-1 text-left"
						>
							<p class="font-medium text-sm">{ct.description}</p>
							{#if categories.length > 0}
								<p class="text-xs text-gray-500 truncate max-w-[180px]">{categories.join(', ')}</p>
							{/if}
						</button>
						<div class="flex items-center gap-1">
							<span class="text-gray-400 text-xs">click to add</span>
							<Button
								variant="ghost"
								size="sm"
								onclick={() => appStore.removeCommonTransaction(ct.id)}
								class="h-6 w-6 p-0 text-red-500 hover:bg-red-50"
							>
								×
							</Button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Content>
</Card>
