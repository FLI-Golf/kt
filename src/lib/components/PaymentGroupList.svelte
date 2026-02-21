<script lang="ts">
	import { appStore } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';

	let expanded = $state<string | null>(null);

	const groups = $derived(
		appStore.paymentGroups.sort((a, b) => b.created.localeCompare(a.created))
	);

	const toggleExpand = (id: string) => {
		expanded = expanded === id ? null : id;
	};

	const formatDate = (iso: string) => {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	};

	const handleUndoGroup = (groupId: string) => {
		if (confirm('Undo this payment group? All transactions will be marked unpaid.')) {
			appStore.undoPaymentGroup(groupId);
		}
	};
</script>

{#if groups.length > 0}
	<Card class="w-full">
		<Header>
			<div class="flex items-center gap-2">
				<div class="rounded-lg bg-green-100 p-1.5">
					<svg class="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
					</svg>
				</div>
				<Title class="text-lg font-bold">Payment Groups ({groups.length})</Title>
			</div>
		</Header>
		<Content class="p-4">
			<div class="space-y-2">
				{#each groups as group (group.id)}
					<div class="rounded-lg border border-gray-200">
						<button
							class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
							onclick={() => toggleExpand(group.id)}
						>
							<div class="flex items-center gap-3">
								<span class="rounded bg-green-100 px-2 py-0.5 text-sm font-medium text-green-700">
									Check #{group.checkNumber}
								</span>
								<span class="text-sm text-gray-500">
									{group.transactionCount} item{group.transactionCount !== 1 ? 's' : ''}
								</span>
								{#if group.note}
									<span class="text-xs text-gray-400">— {group.note}</span>
								{/if}
							</div>
							<div class="flex items-center gap-3">
								<span class="font-medium text-green-700">${group.totalAmount.toFixed(2)}</span>
								<span class="text-xs text-gray-400">{formatDate(group.created)}</span>
								<span class="text-gray-400">{expanded === group.id ? '▲' : '▼'}</span>
							</div>
						</button>

						{#if expanded === group.id}
							<div class="border-t border-gray-200 bg-gray-50 px-4 py-3">
								<table class="w-full text-sm">
									<thead>
										<tr class="text-left text-xs text-gray-500">
											<th class="pb-1 font-medium">Description</th>
											<th class="pb-1 text-right font-medium">Amount</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-gray-100">
										{#each group.transactions as t}
											<tr>
												<td class="py-1.5">{t.description || '—'}</td>
												<td class="py-1.5 text-right font-medium">${t.amount.toFixed(2)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
								<div class="mt-3 flex justify-end">
									<Button
										variant="outline"
										size="sm"
										onclick={() => handleUndoGroup(group.id)}
										class="text-red-600 hover:bg-red-50"
									>
										Undo Payment
									</Button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</Content>
	</Card>
{/if}
