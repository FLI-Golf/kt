<script lang="ts">
	import { appStore } from '$lib/models';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';

	interface Props {
		selectedIds: string[];
		onSelect: (ids: string[]) => void;
	}

	let { selectedIds, onSelect }: Props = $props();

	const toggleCategory = (categoryId: string) => {
		if (selectedIds.includes(categoryId)) {
			onSelect(selectedIds.filter(id => id !== categoryId));
		} else {
			onSelect([...selectedIds, categoryId]);
		}
	};

	const isSelected = (categoryId: string) => selectedIds.includes(categoryId);
</script>

<Card class="w-full">
	<Header>
		<Title class="text-lg font-bold">Categories</Title>
		<p class="text-sm text-gray-500">Select one or more categories</p>
	</Header>
	<Content class="p-3 max-h-96 overflow-y-auto">
		{#if appStore.categories.length === 0}
			<p class="text-center text-sm text-gray-500">No categories available.</p>
		{:else}
			<div class="space-y-2">
				{#each appStore.parentCategories as parent (parent.id)}
					{@const children = appStore.getChildCategories(parent.id)}
					<div class="border rounded-lg p-2">
						<button
							type="button"
							onclick={() => toggleCategory(parent.id)}
							class="w-full text-left px-2 py-1 rounded font-medium text-sm transition-colors {isSelected(parent.id) ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'}"
						>
							{parent.name}
							{#if isSelected(parent.id)}
								<span class="float-right">✓</span>
							{/if}
						</button>
						{#if children.length > 0}
							<div class="ml-4 mt-1 space-y-1">
								{#each children as child (child.id)}
									<button
										type="button"
										onclick={() => toggleCategory(child.id)}
										class="w-full text-left px-2 py-1 rounded text-sm transition-colors {isSelected(child.id) ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'}"
									>
										{child.name}
										{#if isSelected(child.id)}
											<span class="float-right">✓</span>
										{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</Content>
</Card>
