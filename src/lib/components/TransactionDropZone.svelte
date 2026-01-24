<script lang="ts">
	import type { Snippet } from 'svelte';

	interface DropData {
		description: string;
		category_ids: string[];
		default_amount?: number;
	}

	interface Props {
		onDrop: (data: DropData) => void;
		children: Snippet;
	}

	let { onDrop, children }: Props = $props();

	let isDragOver = $state(false);

	const handleDragOver = (e: DragEvent) => {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy';
		}
		isDragOver = true;
	};

	const handleDragLeave = (e: DragEvent) => {
		e.preventDefault();
		isDragOver = false;
	};

	const handleDrop = (e: DragEvent) => {
		e.preventDefault();
		isDragOver = false;

		if (e.dataTransfer) {
			try {
				const data = JSON.parse(e.dataTransfer.getData('application/json'));
				if (data.type === 'common-transaction' && data.description) {
					onDrop({
						description: data.description,
						category_ids: data.category_ids || [],
						default_amount: data.default_amount
					});
				}
			} catch (err) {
				console.error('Failed to parse drop data:', err);
			}
		}
	};
</script>

<div
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	class="relative rounded-lg transition-all {isDragOver ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}"
	role="region"
	aria-label="Drop zone for expenses"
>
	{#if isDragOver}
		<div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-indigo-500/10">
			<p class="rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white shadow-lg">
				Drop to add expense
			</p>
		</div>
	{/if}
	{@render children()}
</div>