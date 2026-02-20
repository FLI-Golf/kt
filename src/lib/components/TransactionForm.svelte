<script lang="ts">
	import { type Transaction, type TransactionType, type ImageAttachment, type AccountType, appStore } from '$lib/models';
	import { generateId } from '$lib/commands.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Card, Header, Title, Content, Footer } from '$lib/components/ui/card';
	import CategorySelector from './CategorySelector.svelte';

	interface Props {
		transaction?: Transaction;
		accountType?: AccountType;
		onSave: (data: { description: string; amount: number; type: TransactionType; category_ids: string[]; note: string; images: ImageAttachment[] }) => void;
		onCancel: () => void;
	}

	let { transaction, accountType = 'personal', onSave, onCancel }: Props = $props();

	let description = $state(transaction?.description ?? '');
	let amount = $state(transaction?.amount ?? 0);
	let type = $state<TransactionType>(transaction?.type ?? 'expense');
	let category_ids = $state<string[]>(transaction?.category_ids ?? []);
	let note = $state(transaction?.note ?? '');
	let images = $state<ImageAttachment[]>(transaction?.images ? [...transaction.images] : []);
	let showImagePreview = $state<string | null>(null);

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		onSave({ description, amount, type, category_ids, note, images });
	};

	const handleCategorySelect = (ids: string[]) => {
		category_ids = ids;
	};

	const handleFileSelect = (e: Event) => {
		const input = e.target as HTMLInputElement;
		if (!input.files) return;
		for (const file of Array.from(input.files)) {
			if (!file.type.startsWith('image/')) continue;
			const reader = new FileReader();
			reader.onload = () => {
				const dataUrl = reader.result as string;
				images = [...images, {
					id: generateId(),
					dataUrl,
					name: file.name,
					created: new Date().toISOString()
				}];
			};
			reader.readAsDataURL(file);
		}
		input.value = '';
	};

	const removeImage = (imageId: string) => {
		images = images.filter(img => img.id !== imageId);
	};

	const isEditing = $derived(!!transaction);

	const selectedCategoryNames = $derived(
		category_ids.map(id => appStore.getCategoryFullName(id)).filter(Boolean)
	);

	// Determine which credit type label to show based on account type
	const creditLabel = $derived(accountType === 'company' ? 'Reimbursement' : 'Refund');
	const creditType = $derived<TransactionType>(accountType === 'company' ? 'reimbursement' : 'refund');

	const getImageLabel = () => {
		if (type === 'reimbursement') return 'Reimbursement Check / Receipt';
		if (type === 'refund') return 'Refund Confirmation / Receipt';
		return 'Receipt';
	};

	const getPlaceholder = () => {
		if (type === 'reimbursement') return 'e.g., Mileage reimbursement';
		if (type === 'refund') return 'e.g., Amazon return refund';
		return 'e.g., Office supplies';
	};
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
						onclick={() => type = creditType}
						class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors {type === 'reimbursement' || type === 'refund' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					>
						{creditLabel}
					</button>
				</div>
			</div>
			<div>
				<label for="transaction-description" class="text-sm font-medium">Description</label>
				<Input
					id="transaction-description"
					type="text"
					placeholder={getPlaceholder()}
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

			<!-- Image Attachments -->
			<div>
				<label class="text-sm font-medium">
					{getImageLabel()} (optional)
				</label>
				<div class="mt-1">
					<label
						class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 text-sm text-gray-500 transition-colors hover:border-indigo-400 hover:text-indigo-600"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						<span>Upload image or take photo</span>
						<input
							type="file"
							accept="image/*"
							capture="environment"
							multiple
							class="hidden"
							onchange={handleFileSelect}
						/>
					</label>
				</div>

				{#if images.length > 0}
					<div class="mt-3 grid grid-cols-3 gap-2">
						{#each images as img (img.id)}
							<div class="group relative">
								<button
									type="button"
									onclick={() => showImagePreview = img.id}
									class="block w-full"
								>
									<img
										src={img.dataUrl}
										alt={img.name}
										class="h-24 w-full rounded-lg border object-cover transition-opacity hover:opacity-80"
									/>
								</button>
								<button
									type="button"
									onclick={() => removeImage(img.id)}
									class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
								>
									x
								</button>
								<p class="mt-0.5 truncate text-xs text-gray-500">{img.name}</p>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</Content>
		<Footer class="flex justify-end gap-2 p-4">
			<Button type="button" variant="outline" onclick={onCancel}>Cancel</Button>
			<Button type="submit">{isEditing ? 'Update' : 'Add'}</Button>
		</Footer>
	</form>
</Card>

<!-- Image Preview Modal -->
{#if showImagePreview}
	{@const previewImg = images.find(img => img.id === showImagePreview)}
	{#if previewImg}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
			role="dialog"
			aria-modal="true"
		>
			<div class="relative max-h-[90vh] max-w-[90vw]">
				<img
					src={previewImg.dataUrl}
					alt={previewImg.name}
					class="max-h-[85vh] rounded-lg object-contain"
				/>
				<button
					type="button"
					onclick={() => showImagePreview = null}
					class="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg hover:bg-gray-100"
				>
					x
				</button>
			</div>
		</div>
	{/if}
{/if}
