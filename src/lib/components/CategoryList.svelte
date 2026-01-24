<script lang="ts">
	import { appStore } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';

	let showAddParent = $state(false);
	let newParentName = $state('');
	let addingChildToId = $state<string | null>(null);
	let newChildName = $state('');
	let editingId = $state<string | null>(null);
	let editingName = $state('');

	const handleAddParent = (e: Event) => {
		e.preventDefault();
		if (newParentName.trim()) {
			appStore.addCategory(newParentName.trim(), null);
			newParentName = '';
			showAddParent = false;
		}
	};

	const handleAddChild = (e: Event, parentId: string) => {
		e.preventDefault();
		if (newChildName.trim()) {
			appStore.addCategory(newChildName.trim(), parentId);
			newChildName = '';
			addingChildToId = null;
		}
	};

	const handleStartEdit = (id: string, name: string) => {
		editingId = id;
		editingName = name;
	};

	const handleSaveEdit = (e: Event) => {
		e.preventDefault();
		if (editingId && editingName.trim()) {
			const category = appStore.getCategory(editingId);
			if (category) {
				category.name = editingName.trim();
				appStore.save();
			}
		}
		editingId = null;
		editingName = '';
	};

	const handleCancelEdit = () => {
		editingId = null;
		editingName = '';
	};

	const handleDelete = (id: string, name: string) => {
		const children = appStore.getChildCategories(id);
		const message = children.length > 0
			? `Delete "${name}" and its ${children.length} subcategories?`
			: `Delete "${name}"?`;
		
		if (confirm(message)) {
			appStore.removeCategory(id);
		}
	};
</script>

<Card class="w-full">
	<Header class="flex flex-row items-center justify-between">
		<Title class="text-xl font-bold">Categories</Title>
		<Button onclick={() => (showAddParent = !showAddParent)} size="sm" variant="outline">
			{showAddParent ? 'Cancel' : '+ Add Category'}
		</Button>
	</Header>
	<Content class="p-4">
		{#if showAddParent}
			<form onsubmit={handleAddParent} class="mb-4 flex gap-2">
				<Input
					type="text"
					placeholder="Category name"
					bind:value={newParentName}
					class="flex-1"
					autofocus
				/>
				<Button type="submit" size="sm">Add</Button>
			</form>
		{/if}

		{#if appStore.parentCategories.length === 0}
			<p class="text-center text-gray-500">No categories yet. Add one to get started.</p>
		{:else}
			<div class="space-y-2">
				{#each appStore.parentCategories as parent (parent.id)}
					{@const children = appStore.getChildCategories(parent.id)}
					<div class="rounded-lg border bg-white">
						<!-- Parent Category -->
						<div class="flex items-center justify-between p-3">
							{#if editingId === parent.id}
								<form onsubmit={handleSaveEdit} class="flex flex-1 gap-2">
									<Input
										type="text"
										bind:value={editingName}
										class="flex-1"
										autofocus
									/>
									<Button type="submit" size="sm">Save</Button>
									<Button type="button" size="sm" variant="outline" onclick={handleCancelEdit}>
										Cancel
									</Button>
								</form>
							{:else}
								<span class="font-medium">{parent.name}</span>
								<div class="flex items-center gap-1">
									<Button
										variant="ghost"
										size="sm"
										onclick={() => {
											addingChildToId = addingChildToId === parent.id ? null : parent.id;
											newChildName = '';
										}}
										class="text-xs text-indigo-600 hover:bg-indigo-50"
									>
										+ Sub
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => handleStartEdit(parent.id, parent.name)}
										class="text-xs text-gray-600 hover:bg-gray-100"
									>
										Edit
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => handleDelete(parent.id, parent.name)}
										class="text-xs text-red-600 hover:bg-red-50"
									>
										Delete
									</Button>
								</div>
							{/if}
						</div>

						<!-- Add Child Form -->
						{#if addingChildToId === parent.id}
							<form
								onsubmit={(e) => handleAddChild(e, parent.id)}
								class="border-t bg-gray-50 p-3"
							>
								<div class="flex gap-2">
									<Input
										type="text"
										placeholder="Subcategory name"
										bind:value={newChildName}
										class="flex-1"
										autofocus
									/>
									<Button type="submit" size="sm">Add</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onclick={() => (addingChildToId = null)}
									>
										Cancel
									</Button>
								</div>
							</form>
						{/if}

						<!-- Child Categories -->
						{#if children.length > 0}
							<div class="border-t">
								{#each children as child (child.id)}
									<div class="flex items-center justify-between border-b last:border-b-0 bg-gray-50 px-3 py-2 pl-6">
										{#if editingId === child.id}
											<form onsubmit={handleSaveEdit} class="flex flex-1 gap-2">
												<Input
													type="text"
													bind:value={editingName}
													class="flex-1"
													autofocus
												/>
												<Button type="submit" size="sm">Save</Button>
												<Button type="button" size="sm" variant="outline" onclick={handleCancelEdit}>
													Cancel
												</Button>
											</form>
										{:else}
											<span class="text-sm text-gray-700">{child.name}</span>
											<div class="flex items-center gap-1">
												<Button
													variant="ghost"
													size="sm"
													onclick={() => handleStartEdit(child.id, child.name)}
													class="text-xs text-gray-600 hover:bg-gray-100"
												>
													Edit
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onclick={() => handleDelete(child.id, child.name)}
													class="text-xs text-red-600 hover:bg-red-50"
												>
													Delete
												</Button>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</Content>
</Card>
