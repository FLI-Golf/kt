<script lang="ts">
	import { appStore, MONTH_NAMES } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';

	// A flattened transaction with its parent month info
	interface FlatTx {
		id: string;
		monthId: string;
		monthName: string;
		year: number;
		monthIndex: number;
		description: string;
		amount: number;
		note: string;
		type: string;
		payment_status: string;
	}

	interface MatchPair {
		business: FlatTx;
		company: FlatTx;
		score: number; // 0-100, higher = better match
		reason: string;
		confirmed: boolean;
	}

	// Gather all business and company transactions
	const businessTxs = $derived<FlatTx[]>(
		appStore.months
			.filter(m => m.accountType === 'business')
			.flatMap(m =>
				m.transactions.filter(t => t.isExpense).map(t => ({
					id: t.id,
					monthId: m.id,
					monthName: m.name,
					year: m.year,
					monthIndex: m.monthIndex,
					description: t.description,
					amount: t.amount,
					note: t.note,
					type: t.type,
					payment_status: t.payment_status,
				}))
			)
			.sort((a, b) => a.amount - b.amount)
	);

	const companyTxs = $derived<FlatTx[]>(
		appStore.months
			.filter(m => m.accountType === 'company')
			.flatMap(m =>
				m.transactions.filter(t => t.isExpense).map(t => ({
					id: t.id,
					monthId: m.id,
					monthName: m.name,
					year: m.year,
					monthIndex: m.monthIndex,
					description: t.description,
					amount: t.amount,
					note: t.note,
					type: t.type,
					payment_status: t.payment_status,
				}))
			)
			.sort((a, b) => a.amount - b.amount)
	);

	// Normalize a description for fuzzy comparison
	function normalize(s: string): string {
		return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
	}

	// Simple word-overlap similarity (0-100)
	function similarity(a: string, b: string): number {
		const wa = new Set(normalize(a).split(' ').filter(w => w.length > 2));
		const wb = new Set(normalize(b).split(' ').filter(w => w.length > 2));
		if (wa.size === 0 && wb.size === 0) return 50;
		if (wa.size === 0 || wb.size === 0) return 0;
		let overlap = 0;
		for (const w of wa) {
			if (wb.has(w)) overlap++;
		}
		return Math.round((overlap / Math.max(wa.size, wb.size)) * 100);
	}

	// Build match candidates
	let matches = $state<MatchPair[]>([]);
	let unmatchedBusiness = $state<FlatTx[]>([]);
	let unmatchedCompany = $state<FlatTx[]>([]);
	let hasRun = $state(false);

	// Tolerance for amount matching (cents can differ due to rounding)
	const AMOUNT_TOLERANCE = 0.02;
	const DESCRIPTION_THRESHOLD = 20; // minimum similarity to suggest

	function runMatching() {
		const usedBusiness = new Set<string>();
		const usedCompany = new Set<string>();
		const pairs: MatchPair[] = [];

		// Pass 1: exact amount + high description similarity
		for (const biz of businessTxs) {
			if (usedBusiness.has(biz.id)) continue;
			let bestMatch: { co: FlatTx; score: number } | null = null;

			for (const co of companyTxs) {
				if (usedCompany.has(co.id)) continue;
				if (Math.abs(biz.amount - co.amount) > AMOUNT_TOLERANCE) continue;

				const descScore = similarity(biz.description, co.description);
				const dateBonus = (biz.year === co.year && biz.monthIndex === co.monthIndex) ? 10 : 0;
				const totalScore = descScore + dateBonus;

				if (!bestMatch || totalScore > bestMatch.score) {
					bestMatch = { co, score: totalScore };
				}
			}

			if (bestMatch && bestMatch.score >= 50) {
				usedBusiness.add(biz.id);
				usedCompany.add(bestMatch.co.id);
				pairs.push({
					business: biz,
					company: bestMatch.co,
					score: bestMatch.score,
					reason: 'Exact amount + description match',
					confirmed: true, // auto-confirm high-confidence
				});
			}
		}

		// Pass 2: exact amount only (lower confidence)
		for (const biz of businessTxs) {
			if (usedBusiness.has(biz.id)) continue;
			let bestMatch: { co: FlatTx; score: number } | null = null;

			for (const co of companyTxs) {
				if (usedCompany.has(co.id)) continue;
				if (Math.abs(biz.amount - co.amount) > AMOUNT_TOLERANCE) continue;

				const descScore = similarity(biz.description, co.description);
				const dateBonus = (biz.year === co.year && biz.monthIndex === co.monthIndex) ? 10 : 0;
				const totalScore = descScore + dateBonus;

				if (!bestMatch || totalScore > bestMatch.score) {
					bestMatch = { co, score: totalScore };
				}
			}

			if (bestMatch) {
				usedBusiness.add(biz.id);
				usedCompany.add(bestMatch.co.id);
				pairs.push({
					business: biz,
					company: bestMatch.co,
					score: bestMatch.score,
					reason: bestMatch.score >= DESCRIPTION_THRESHOLD ? 'Amount match + partial description' : 'Amount match only',
					confirmed: false,
				});
			}
		}

		// Sort: high confidence first
		pairs.sort((a, b) => b.score - a.score);

		matches = pairs;
		unmatchedBusiness = businessTxs.filter(t => !usedBusiness.has(t.id));
		unmatchedCompany = companyTxs.filter(t => !usedCompany.has(t.id));
		hasRun = true;
	}

	function toggleConfirm(index: number) {
		matches[index].confirmed = !matches[index].confirmed;
		matches = [...matches];
	}

	function confirmAll() {
		matches = matches.map(m => ({ ...m, confirmed: true }));
	}

	function confirmNone() {
		matches = matches.map(m => ({ ...m, confirmed: false }));
	}

	// Apply resolution: delete confirmed company transactions (business prevails)
	let resolveResults = $state<{ resolved: number; deleted: number } | null>(null);

	function applyResolution() {
		const confirmed = matches.filter(m => m.confirmed);
		if (confirmed.length === 0) return;

		const msg = `This will remove ${confirmed.length} matched company transaction(s) that are duplicated in your Business list. Continue?`;
		if (!confirm(msg)) return;

		let deleted = 0;
		for (const pair of confirmed) {
			const month = appStore.months.find(m => m.id === pair.company.monthId);
			if (month) {
				month.removeTransaction(pair.company.id);
				month.calculateTotals();
				deleted++;
			}
		}

		appStore.save();
		resolveResults = { resolved: confirmed.length, deleted };

		// Re-run matching with remaining data
		hasRun = false;
		matches = [];
		unmatchedBusiness = [];
		unmatchedCompany = [];
	}

	const confirmedCount = $derived(matches.filter(m => m.confirmed).length);

	function scoreColor(score: number): string {
		if (score >= 60) return 'text-green-700 bg-green-100';
		if (score >= 30) return 'text-amber-700 bg-amber-100';
		return 'text-red-700 bg-red-100';
	}

	function scoreBg(score: number): string {
		if (score >= 60) return 'border-green-200 bg-green-50/50';
		if (score >= 30) return 'border-amber-200 bg-amber-50/50';
		return 'border-red-200 bg-red-50/50';
	}
</script>

<div class="space-y-4">
	<Card class="w-full">
		<Header>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="rounded-lg bg-orange-100 p-1.5">
						<svg class="h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
						</svg>
					</div>
					<div>
						<Title class="text-xl font-bold">Resolve: Business vs Company</Title>
						<p class="text-sm text-gray-500">Match business transactions against company records to eliminate duplicates</p>
					</div>
				</div>
			</div>
		</Header>
		<Content class="p-4">
			<!-- Summary stats -->
			<div class="mb-4 grid grid-cols-3 gap-3 text-center">
				<div class="rounded-lg bg-amber-50 p-3">
					<p class="text-xs text-gray-600">Business Expenses</p>
					<p class="text-2xl font-bold text-amber-700">{businessTxs.length}</p>
					<p class="text-xs text-gray-500">${businessTxs.reduce((s, t) => s + t.amount, 0).toFixed(2)}</p>
				</div>
				<div class="rounded-lg bg-purple-50 p-3">
					<p class="text-xs text-gray-600">Company Expenses</p>
					<p class="text-2xl font-bold text-purple-700">{companyTxs.length}</p>
					<p class="text-xs text-gray-500">${companyTxs.reduce((s, t) => s + t.amount, 0).toFixed(2)}</p>
				</div>
				<div class="rounded-lg bg-blue-50 p-3">
					<p class="text-xs text-gray-600">Status</p>
					{#if hasRun}
						<p class="text-2xl font-bold text-blue-700">{matches.length}</p>
						<p class="text-xs text-gray-500">matches found</p>
					{:else}
						<p class="text-sm font-medium text-gray-400 mt-2">Not run yet</p>
					{/if}
				</div>
			</div>

			{#if resolveResults}
				<div class="mb-4 rounded-lg bg-green-50 p-4 text-center">
					<p class="text-lg font-medium text-green-700">Resolution Applied</p>
					<p class="text-sm text-gray-600">
						{resolveResults.resolved} matches resolved, {resolveResults.deleted} company transactions removed.
					</p>
					<Button onclick={() => { resolveResults = null; }} class="mt-2" size="sm" variant="outline">Dismiss</Button>
				</div>
			{/if}

			{#if !hasRun}
				<div class="text-center py-6">
					<p class="text-gray-500 mb-3">
						Click below to scan Business and Company transactions for matches.
						Business transactions always prevail — matched Company transactions can be removed.
					</p>
					<Button
						onclick={runMatching}
						disabled={businessTxs.length === 0 || companyTxs.length === 0}
						class="bg-orange-600 hover:bg-orange-700"
					>
						Run Matching
					</Button>
					{#if businessTxs.length === 0 || companyTxs.length === 0}
						<p class="mt-2 text-xs text-red-500">
							Need both Business and Company transactions to resolve.
							{#if businessTxs.length === 0}No business expenses found.{/if}
							{#if companyTxs.length === 0}No company expenses found.{/if}
						</p>
					{/if}
				</div>
			{:else}
				<!-- Match results -->
				<div class="space-y-4">
					{#if matches.length > 0}
						<div class="flex items-center justify-between">
							<h3 class="text-sm font-bold">
								Matched Pairs ({matches.length})
								<span class="font-normal text-gray-500">— {confirmedCount} confirmed</span>
							</h3>
							<div class="flex gap-2">
								<Button variant="outline" size="sm" onclick={confirmAll}>Confirm All</Button>
								<Button variant="outline" size="sm" onclick={confirmNone}>Unconfirm All</Button>
								<Button
									size="sm"
									onclick={applyResolution}
									disabled={confirmedCount === 0}
									class={confirmedCount > 0 ? 'bg-red-600 hover:bg-red-700' : ''}
								>
									Remove {confirmedCount} Company Dupes
								</Button>
							</div>
						</div>

						<div class="max-h-[32rem] space-y-2 overflow-y-auto">
							{#each matches as pair, i}
								<div
									class="rounded-lg border p-3 cursor-pointer transition-colors {pair.confirmed ? scoreBg(pair.score) : 'border-gray-200 bg-white opacity-60'}"
									onclick={() => toggleConfirm(i)}
								>
									<div class="flex items-start justify-between gap-3">
										<div class="flex items-center gap-2">
											<input
												type="checkbox"
												checked={pair.confirmed}
												onclick={(e) => e.stopPropagation()}
												onchange={() => toggleConfirm(i)}
												class="rounded"
											/>
											<span class="rounded px-1.5 py-0.5 text-xs font-medium {scoreColor(pair.score)}">
												{pair.score}%
											</span>
											<span class="text-xs text-gray-500">{pair.reason}</span>
										</div>
										<span class="text-sm font-bold">${pair.business.amount.toFixed(2)}</span>
									</div>
									<div class="mt-2 grid grid-cols-2 gap-3 text-xs">
										<div>
											<span class="font-medium text-amber-700">Business:</span>
											<span class="ml-1 text-gray-700">{pair.business.description}</span>
											<span class="ml-1 text-gray-400">({MONTH_NAMES[pair.business.monthIndex].slice(0, 3)} {pair.business.year})</span>
										</div>
										<div>
											<span class="font-medium text-purple-700">Company:</span>
											<span class="ml-1 text-gray-700">{pair.company.description}</span>
											<span class="ml-1 text-gray-400">({MONTH_NAMES[pair.company.monthIndex].slice(0, 3)} {pair.company.year})</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
							No matches found between Business and Company transactions.
						</div>
					{/if}

					<!-- Unmatched sections -->
					{#if unmatchedBusiness.length > 0}
						<div>
							<h3 class="mb-2 text-sm font-bold text-amber-700">
								Unmatched Business ({unmatchedBusiness.length})
								<span class="font-normal text-gray-500">— unique to your bank statements</span>
							</h3>
							<div class="max-h-48 overflow-y-auto rounded-lg border">
								<table class="w-full text-xs">
									<thead class="bg-gray-50">
										<tr>
											<th class="px-3 py-1.5 text-left font-medium text-gray-600">Description</th>
											<th class="px-3 py-1.5 text-left font-medium text-gray-600">Month</th>
											<th class="px-3 py-1.5 text-right font-medium text-gray-600">Amount</th>
										</tr>
									</thead>
									<tbody class="divide-y">
										{#each unmatchedBusiness as tx}
											<tr class="hover:bg-gray-50">
												<td class="px-3 py-1.5 max-w-xs truncate">{tx.description}</td>
												<td class="px-3 py-1.5 text-gray-500">{MONTH_NAMES[tx.monthIndex].slice(0, 3)} {tx.year}</td>
												<td class="px-3 py-1.5 text-right font-medium">${tx.amount.toFixed(2)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}

					{#if unmatchedCompany.length > 0}
						<div>
							<h3 class="mb-2 text-sm font-bold text-purple-700">
								Unmatched Company ({unmatchedCompany.length})
								<span class="font-normal text-gray-500">— no matching business transaction found</span>
							</h3>
							<div class="max-h-48 overflow-y-auto rounded-lg border">
								<table class="w-full text-xs">
									<thead class="bg-gray-50">
										<tr>
											<th class="px-3 py-1.5 text-left font-medium text-gray-600">Description</th>
											<th class="px-3 py-1.5 text-left font-medium text-gray-600">Month</th>
											<th class="px-3 py-1.5 text-right font-medium text-gray-600">Amount</th>
										</tr>
									</thead>
									<tbody class="divide-y">
										{#each unmatchedCompany as tx}
											<tr class="hover:bg-gray-50">
												<td class="px-3 py-1.5 max-w-xs truncate">{tx.description}</td>
												<td class="px-3 py-1.5 text-gray-500">{MONTH_NAMES[tx.monthIndex].slice(0, 3)} {tx.year}</td>
												<td class="px-3 py-1.5 text-right font-medium">${tx.amount.toFixed(2)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}

					<!-- Re-run button -->
					<div class="text-center pt-2">
						<Button variant="outline" size="sm" onclick={() => { hasRun = false; matches = []; resolveResults = null; }}>
							Re-run Matching
						</Button>
					</div>
				</div>
			{/if}
		</Content>
	</Card>
</div>
