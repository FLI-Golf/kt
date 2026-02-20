<script lang="ts">
	import { appStore, type Month } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content, Footer } from '$lib/components/ui/card';

	interface Props {
		onSelectMonth: (month: Month) => void;
	}

	let { onSelectMonth }: Props = $props();

	const PAGE_SIZE = 5;
	let currentPage = $state(1);

	const closedMonths = $derived(
		appStore.months
			.filter(m => m.isClosed)
			.sort((a, b) => {
				if (a.year !== b.year) return a.year - b.year;
				return a.monthIndex - b.monthIndex;
			})
	);

	const totalPages = $derived(Math.ceil(closedMonths.length / PAGE_SIZE));

	const paginatedMonths = $derived(
		closedMonths.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
	);

	const formatDate = (iso: string) => {
		return new Date(iso).toLocaleDateString();
	};

	const goToPage = (page: number) => {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	};
</script>

{#if closedMonths.length > 0}
	<Card class="w-full">
		<Header>
			<Title class="text-xl font-bold">Month History</Title>
			<p class="text-sm text-gray-500">{closedMonths.length} closed month{closedMonths.length !== 1 ? 's' : ''}</p>
		</Header>
		<Content class="p-4">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr class="border-b text-left text-sm text-gray-600">
							<th class="pb-2 font-medium">Month</th>
							<th class="pb-2 font-medium">Dates</th>
							<th class="pb-2 text-right font-medium">Total</th>
							<th class="pb-2 text-right font-medium">Paid</th>
							<th class="pb-2 text-right font-medium">Unpaid</th>
							<th class="pb-2 text-right font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each paginatedMonths as month (month.id)}
							<tr class="border-b last:border-0 hover:bg-gray-50">
								<td class="py-3 font-medium">{month.name}</td>
								<td class="py-3 text-sm text-gray-600">
									{formatDate(month.start)} - {formatDate(month.end)}
								</td>
								<td class="py-3 text-right text-blue-600">
									${month.total_amount.toFixed(2)}
								</td>
								<td class="py-3 text-right text-green-600">
									${month.total_paid.toFixed(2)}
								</td>
								<td class="py-3 text-right text-red-600">
									${month.total_unpaid.toFixed(2)}
								</td>
								<td class="py-3 text-right">
									<Button
										variant="ghost"
										size="sm"
										onclick={() => onSelectMonth(month)}
										class="h-8 px-2"
									>
										View
									</Button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Content>
		{#if totalPages > 1}
			<Footer class="flex items-center justify-between p-4">
				<span class="text-sm text-gray-500">
					Page {currentPage} of {totalPages}
				</span>
				<div class="flex gap-1">
					<Button variant="outline" size="sm" onclick={() => goToPage(1)} disabled={currentPage === 1}>First</Button>
					<Button variant="outline" size="sm" onclick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>Prev</Button>
					<Button variant="outline" size="sm" onclick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>Next</Button>
					<Button variant="outline" size="sm" onclick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>Last</Button>
				</div>
			</Footer>
		{/if}
	</Card>
{/if}
