<script lang="ts">
	import { appStore, MONTH_NAMES } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';

	type ResolveMode = 'cross-account' | 'internal-dupes';
	let resolveMode = $state<ResolveMode>('internal-dupes');

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

	// A group of duplicate transactions within business
	interface DupGroup {
		key: string;
		transactions: FlatTx[];
		keepId: string | null; // which tx to keep (null = not yet decided)
		amount: number;
		reason: string;
		score: number;
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

	// ── Internal Business Duplicate Detection ──

	// All business transactions (expenses + credits) for internal dupe scan
	const allBusinessTxs = $derived<FlatTx[]>(
		appStore.months
			.filter(m => m.accountType === 'business')
			.flatMap(m =>
				m.transactions.map(t => ({
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

	let dupGroups = $state<DupGroup[]>([]);
	let noDupsTxs = $state<FlatTx[]>([]);
	let dupHasRun = $state(false);
	let dupResolveResults = $state<{ resolved: number; deleted: number } | null>(null);

	function runInternalDupeDetection() {
		const groups: Map<string, FlatTx[]> = new Map();

		// Group by amount (exact match) within same year/month
		for (const tx of allBusinessTxs) {
			const key = `${tx.amount.toFixed(2)}_${tx.year}_${tx.monthIndex}`;
			const existing = groups.get(key) || [];
			existing.push(tx);
			groups.set(key, existing);
		}

		// Also check cross-month: same amount, similar description
		const crossMonthGroups: Map<string, FlatTx[]> = new Map();
		for (let i = 0; i < allBusinessTxs.length; i++) {
			const a = allBusinessTxs[i];
			for (let j = i + 1; j < allBusinessTxs.length; j++) {
				const b = allBusinessTxs[j];
				if (Math.abs(a.amount - b.amount) > AMOUNT_TOLERANCE) continue;
				if (a.year === b.year && a.monthIndex === b.monthIndex) continue; // already handled above
				const sim = similarity(a.description, b.description);
				if (sim >= 40) {
					const key = `cross_${[a.id, b.id].sort().join('_')}`;
					if (!crossMonthGroups.has(key)) {
						crossMonthGroups.set(key, [a, b]);
					}
				}
			}
		}

		const result: DupGroup[] = [];
		const usedIds = new Set<string>();

		// Same-month groups: require same amount + description similarity
		for (const [key, txs] of groups) {
			if (txs.length < 2) continue;

			// Sub-group by description similarity
			const subGroups: FlatTx[][] = [];
			const assigned = new Set<number>();

			for (let i = 0; i < txs.length; i++) {
				if (assigned.has(i)) continue;
				const group = [txs[i]];
				assigned.add(i);
				for (let j = i + 1; j < txs.length; j++) {
					if (assigned.has(j)) continue;
					const sim = similarity(txs[i].description, txs[j].description);
					// Also match if descriptions are very different but amounts are exact
					// (common when same charge appears from different import sources)
					if (sim >= 30 || normalize(txs[i].description).includes(normalize(txs[j].description)) || normalize(txs[j].description).includes(normalize(txs[i].description))) {
						group.push(txs[j]);
						assigned.add(j);
					}
				}
				if (group.length >= 2) subGroups.push(group);
			}

			for (const group of subGroups) {
				const sim = similarity(group[0].description, group[1].description);
				for (const tx of group) usedIds.add(tx.id);
				result.push({
					key: `same_${key}_${group[0].id}`,
					transactions: group,
					keepId: null,
					amount: group[0].amount,
					reason: sim >= 60 ? 'Same month, same amount, similar description' : 'Same month, same amount',
					score: Math.min(100, sim + 30), // boost for same-month
				});
			}
		}

		// Cross-month groups
		for (const [key, txs] of crossMonthGroups) {
			const allNew = txs.every(t => !usedIds.has(t.id));
			if (!allNew) continue;
			const sim = similarity(txs[0].description, txs[1].description);
			for (const tx of txs) usedIds.add(tx.id);
			result.push({
				key,
				transactions: txs,
				keepId: null,
				amount: txs[0].amount,
				reason: 'Cross-month, same amount, similar description',
				score: sim,
			});
		}

		result.sort((a, b) => b.score - a.score);
		dupGroups = result;
		noDupsTxs = allBusinessTxs.filter(t => !usedIds.has(t.id));
		dupHasRun = true;
	}

	function setKeep(groupIndex: number, txId: string) {
		dupGroups[groupIndex].keepId = dupGroups[groupIndex].keepId === txId ? null : txId;
		dupGroups = [...dupGroups];
	}

	function autoKeepFirst() {
		dupGroups = dupGroups.map(g => ({ ...g, keepId: g.transactions[0].id }));
	}

	function clearKeepAll() {
		dupGroups = dupGroups.map(g => ({ ...g, keepId: null }));
	}

	const readyToResolveCount = $derived(dupGroups.filter(g => g.keepId !== null).length);
	const totalDupesToRemove = $derived(
		dupGroups.filter(g => g.keepId !== null).reduce((sum, g) => sum + g.transactions.length - 1, 0)
	);

	function applyInternalResolution() {
		const ready = dupGroups.filter(g => g.keepId !== null);
		if (ready.length === 0) return;

		const msg = `This will remove ${totalDupesToRemove} duplicate transaction(s) from ${ready.length} group(s). The selected "keep" transaction in each group will remain. Continue?`;
		if (!confirm(msg)) return;

		let deleted = 0;
		for (const group of ready) {
			const toRemove = group.transactions.filter(t => t.id !== group.keepId);
			for (const tx of toRemove) {
				const month = appStore.months.find(m => m.id === tx.monthId);
				if (month) {
					month.removeTransaction(tx.id);
					month.calculateTotals();
					deleted++;
				}
			}
		}

		appStore.save();
		dupResolveResults = { resolved: ready.length, deleted };

		// Reset
		dupHasRun = false;
		dupGroups = [];
		noDupsTxs = [];
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
						<Title class="text-xl font-bold">Resolve Duplicates</Title>
						<p class="text-sm text-gray-500">Find and remove duplicate transactions</p>
					</div>
				</div>
			</div>
			<!-- Mode switcher -->
			<div class="mt-3 flex gap-2">
				<button
					onclick={() => resolveMode = 'internal-dupes'}
					class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors {resolveMode === 'internal-dupes' ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
				>
					Business Internal
					{#if allBusinessTxs.length > 0}
						<span class="ml-1 rounded-full px-1.5 py-0.5 text-xs {resolveMode === 'internal-dupes' ? 'bg-amber-500' : 'bg-gray-300 text-gray-600'}">{allBusinessTxs.length}</span>
					{/if}
				</button>
				<button
					onclick={() => resolveMode = 'cross-account'}
					class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors {resolveMode === 'cross-account' ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
				>
					Business vs Company
					{#if companyTxs.length > 0}
						<span class="ml-1 rounded-full px-1.5 py-0.5 text-xs {resolveMode === 'cross-account' ? 'bg-orange-500' : 'bg-gray-300 text-gray-600'}">{companyTxs.length}</span>
					{/if}
				</button>
			</div>
		</Header>
		<Content class="p-4">
			{#if resolveMode === 'internal-dupes'}
				<!-- ── INTERNAL BUSINESS DUPLICATES ── -->
				<div class="mb-4 grid grid-cols-3 gap-3 text-center">
					<div class="rounded-lg bg-amber-50 p-3">
						<p class="text-xs text-gray-600">Business Transactions</p>
						<p class="text-2xl font-bold text-amber-700">{allBusinessTxs.length}</p>
						<p class="text-xs text-gray-500">${allBusinessTxs.reduce((s, t) => s + t.amount, 0).toFixed(2)}</p>
					</div>
					<div class="rounded-lg bg-red-50 p-3">
						<p class="text-xs text-gray-600">Dupe Groups</p>
						{#if dupHasRun}
							<p class="text-2xl font-bold text-red-700">{dupGroups.length}</p>
							<p class="text-xs text-gray-500">{dupGroups.reduce((s, g) => s + g.transactions.length - 1, 0)} extra txs</p>
						{:else}
							<p class="text-sm font-medium text-gray-400 mt-2">Not run yet</p>
						{/if}
					</div>
					<div class="rounded-lg bg-green-50 p-3">
						<p class="text-xs text-gray-600">Unique</p>
						{#if dupHasRun}
							<p class="text-2xl font-bold text-green-700">{noDupsTxs.length}</p>
							<p class="text-xs text-gray-500">no duplicates</p>
						{:else}
							<p class="text-sm font-medium text-gray-400 mt-2">—</p>
						{/if}
					</div>
				</div>

				{#if dupResolveResults}
					<div class="mb-4 rounded-lg bg-green-50 p-4 text-center">
						<p class="text-lg font-medium text-green-700">Duplicates Removed</p>
						<p class="text-sm text-gray-600">
							{dupResolveResults.resolved} groups resolved, {dupResolveResults.deleted} duplicate transactions removed.
						</p>
						<Button onclick={() => { dupResolveResults = null; }} class="mt-2" size="sm" variant="outline">Dismiss</Button>
					</div>
				{/if}

				{#if !dupHasRun}
					<div class="text-center py-6">
						<p class="text-gray-500 mb-3">
							Scan business transactions for internal duplicates — same amount and similar description within the same or nearby months.
						</p>
						<Button
							onclick={runInternalDupeDetection}
							disabled={allBusinessTxs.length === 0}
							class="bg-amber-600 hover:bg-amber-700"
						>
							Scan for Duplicates
						</Button>
						{#if allBusinessTxs.length === 0}
							<p class="mt-2 text-xs text-red-500">No business transactions found.</p>
						{/if}
					</div>
				{:else}
					<div class="space-y-4">
						{#if dupGroups.length > 0}
							<div class="flex items-center justify-between flex-wrap gap-2">
								<h3 class="text-sm font-bold">
									Duplicate Groups ({dupGroups.length})
									<span class="font-normal text-gray-500">— {readyToResolveCount} ready, {totalDupesToRemove} to remove</span>
								</h3>
								<div class="flex gap-2">
									<Button variant="outline" size="sm" onclick={autoKeepFirst}>Auto-keep First</Button>
									<Button variant="outline" size="sm" onclick={clearKeepAll}>Clear All</Button>
									<Button
										size="sm"
										onclick={applyInternalResolution}
										disabled={readyToResolveCount === 0}
										class={readyToResolveCount > 0 ? 'bg-red-600 hover:bg-red-700' : ''}
									>
										Remove {totalDupesToRemove} Dupes
									</Button>
								</div>
							</div>

							<div class="max-h-[40rem] space-y-3 overflow-y-auto">
								{#each dupGroups as group, gi}
									<div class="rounded-lg border p-3 {group.keepId ? scoreBg(group.score) : 'border-gray-200 bg-white'}">
										<div class="flex items-center justify-between gap-2 mb-2">
											<div class="flex items-center gap-2">
												<span class="rounded px-1.5 py-0.5 text-xs font-medium {scoreColor(group.score)}">
													{group.score}%
												</span>
												<span class="text-xs text-gray-500">{group.reason}</span>
											</div>
											<span class="text-sm font-bold">${group.amount.toFixed(2)}</span>
										</div>
										<div class="space-y-1">
											{#each group.transactions as tx, ti}
												<div
													class="flex items-center gap-2 rounded p-2 text-xs cursor-pointer transition-colors {group.keepId === tx.id ? 'bg-green-100 border border-green-300' : group.keepId && group.keepId !== tx.id ? 'bg-red-50 border border-red-200 line-through opacity-60' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}"
													onclick={() => setKeep(gi, tx.id)}
												>
													<div class="flex-1">
														<span class="font-medium text-gray-800">{tx.description}</span>
														<span class="ml-2 text-gray-400">{MONTH_NAMES[tx.monthIndex].slice(0, 3)} {tx.year}</span>
														{#if tx.note}
															<span class="ml-2 text-gray-400 italic">({tx.note})</span>
														{/if}
													</div>
													<div class="flex items-center gap-2">
														<span class="text-gray-500">{tx.type}</span>
														<span class="text-gray-500">{tx.payment_status}</span>
														{#if group.keepId === tx.id}
															<span class="rounded bg-green-600 px-1.5 py-0.5 text-white text-xs font-medium">KEEP</span>
														{:else if group.keepId}
															<span class="rounded bg-red-500 px-1.5 py-0.5 text-white text-xs font-medium">REMOVE</span>
														{:else}
															<span class="rounded bg-gray-300 px-1.5 py-0.5 text-gray-600 text-xs">click to keep</span>
														{/if}
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="rounded-lg bg-green-50 p-4 text-center text-sm text-green-700">
								No duplicates found within business transactions.
							</div>
						{/if}

						<div class="text-center pt-2">
							<Button variant="outline" size="sm" onclick={() => { dupHasRun = false; dupGroups = []; dupResolveResults = null; }}>
								Re-scan
							</Button>
						</div>
					</div>
				{/if}

			{:else}
				<!-- ── CROSS-ACCOUNT: BUSINESS vs COMPANY ── -->
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
			{/if}
		</Content>
	</Card>
</div>
