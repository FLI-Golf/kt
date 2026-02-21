<script lang="ts">
	import { appStore, MONTH_NAMES, type AccountType } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content, Footer } from '$lib/components/ui/card';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let rawText = $state('');
	let statementYear = $state(2026);
	let accountType = $state<AccountType>('company');
	let importResult = $state<string | null>(null);

	interface ParsedTransaction {
		date: string;
		month: number;
		day: number;
		description: string;
		amount: number;
		isCredit: boolean;
		selected: boolean;
	}

	let parsed = $state<ParsedTransaction[]>([]);
	let parseError = $state<string | null>(null);

	const parseChaseStatement = () => {
		parseError = null;
		parsed = [];

		if (!rawText.trim()) {
			parseError = 'Paste your Chase statement data above.';
			return;
		}

		const lines = rawText.split('\n');
		const results: ParsedTransaction[] = [];

		// Pattern: MM/DD followed by optional & then description then amount
		// Amount is at the end, may have commas, may be negative
		const txRegex = /^(\d{2})\/(\d{2})\s+&?\s*(.+?)\s+(-?[\d,]+\.\d{2})\s*$/;

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			const match = trimmed.match(txRegex);
			if (match) {
				const month = parseInt(match[1], 10);
				const day = parseInt(match[2], 10);
				const description = match[3].trim();
				const amountStr = match[4].replace(/,/g, '');
				const amount = parseFloat(amountStr);

				if (!isNaN(amount) && month >= 1 && month <= 12) {
					results.push({
						date: `${match[1]}/${match[2]}`,
						month,
						day,
						description,
						amount: Math.abs(amount),
						isCredit: amount < 0,
						selected: amount > 0, // Pre-select expenses (positive amounts)
					});
				}
			}
		}

		if (results.length === 0) {
			parseError = `No transactions found. Expected lines like: 12/26 & ONA.COM KIEL 25.00`;
			return;
		}

		parsed = results;
	};

	const selectedCount = $derived(parsed.filter(t => t.selected).length);
	const selectedTotal = $derived(
		parsed.filter(t => t.selected).reduce((sum, t) => sum + t.amount, 0)
	);

	const toggleAll = () => {
		const allSelected = parsed.every(t => t.selected);
		parsed = parsed.map(t => ({ ...t, selected: !allSelected }));
	};

	const toggleTransaction = (index: number) => {
		parsed[index].selected = !parsed[index].selected;
	};

	// Group by month for import
	const handleImport = () => {
		const selected = parsed.filter(t => t.selected);
		if (selected.length === 0) return;

		// Group by month
		const byMonth = new Map<number, ParsedTransaction[]>();
		for (const t of selected) {
			const existing = byMonth.get(t.month) || [];
			existing.push(t);
			byMonth.set(t.month, existing);
		}

		let totalImported = 0;
		const monthNames: string[] = [];

		for (const [monthNum, transactions] of byMonth) {
			const monthIndex = monthNum - 1; // 0-based

			// Find or create month
			let month = appStore.months.find(
				m => m.year === statementYear && m.monthIndex === monthIndex && m.accountType === accountType
			);

			if (!month) {
				month = appStore.createMonth(statementYear, monthIndex, accountType);
			}

			for (const t of transactions) {
				const tx = month.addTransaction(t.description);
				tx.amount = t.amount;
				if (t.isCredit) {
					tx.type = 'refund';
				} else {
					tx.type = 'expense';
				}
			}

			month.calculateTotals();
			monthNames.push(MONTH_NAMES[monthIndex]);
			totalImported += transactions.length;
		}

		appStore.save();
		importResult = `Imported ${totalImported} transactions into ${monthNames.join(', ')} ${statementYear} (${accountType}).`;
	};
</script>

<Card class="w-full">
	<Header class="space-y-3">
		<div class="flex items-center justify-between">
			<Title class="text-xl font-bold">Import Chase Statement</Title>
			<Button variant="outline" size="sm" onclick={onClose}>Close</Button>
		</div>
		<p class="text-sm text-gray-500">
			Copy transaction lines from your Chase PDF statement and paste below. Each line should start with a date like <code class="rounded bg-gray-100 px-1">12/26</code>.
		</p>
	</Header>
	<Content class="space-y-4 p-4">
		<!-- Settings -->
		<div class="flex flex-wrap gap-3">
			<div class="flex flex-col gap-1">
				<label class="text-xs font-medium text-gray-500">Statement Year</label>
				<select bind:value={statementYear} class="rounded border border-gray-300 px-2 py-1 text-sm">
					{#each [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030] as y}
						<option value={y}>{y}</option>
					{/each}
				</select>
			</div>
			<div class="flex flex-col gap-1">
				<label class="text-xs font-medium text-gray-500">Account Type</label>
				<div class="flex gap-1 rounded-lg bg-gray-100 p-1">
					<button
						class="rounded-md px-3 py-1 text-sm font-medium transition-colors {accountType === 'personal' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}"
						onclick={() => (accountType = 'personal')}
					>
						Personal
					</button>
					<button
						class="rounded-md px-3 py-1 text-sm font-medium transition-colors {accountType === 'company' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600'}"
						onclick={() => (accountType = 'company')}
					>
						Company
					</button>
				</div>
			</div>
		</div>

		<!-- Paste area -->
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Paste Statement Data</label>
			<textarea
				bind:value={rawText}
				placeholder={"12/24 & SOURCEGRAPH INC SAN FRANCISCO CA -19.00\n12/26 & ONA.COM KIEL 25.00\n12/26 & AMAZON PRIME*QG7AW53A3 888-802-3080 WA 19.99"}
				rows="8"
				class="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
			></textarea>
		</div>

		<Button onclick={parseChaseStatement} size="sm">Parse Transactions</Button>

		{#if parseError}
			<div class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{parseError}</div>
		{/if}

		{#if importResult}
			<div class="rounded-lg bg-green-50 p-3 text-sm text-green-700">{importResult}</div>
		{/if}

		<!-- Parsed results -->
		{#if parsed.length > 0}
			<div class="flex items-center justify-between rounded-lg bg-indigo-50 px-4 py-3">
				<div class="text-sm">
					<span class="font-medium text-indigo-700">{selectedCount}</span>
					<span class="text-indigo-600"> of {parsed.length} selected</span>
				</div>
				<div class="text-lg font-bold text-indigo-700">
					${selectedTotal.toFixed(2)}
				</div>
			</div>

			<div class="max-h-96 overflow-auto">
				<table class="w-full text-sm">
					<thead class="sticky top-0 bg-white">
						<tr class="border-b text-left text-gray-600">
							<th class="pb-2 pr-2">
								<input
									type="checkbox"
									checked={parsed.every(t => t.selected)}
									onchange={toggleAll}
									class="rounded"
								/>
							</th>
							<th class="pb-2 font-medium">Date</th>
							<th class="pb-2 font-medium">Description</th>
							<th class="pb-2 text-right font-medium">Amount</th>
							<th class="pb-2 text-center font-medium">Type</th>
						</tr>
					</thead>
					<tbody>
						{#each parsed as transaction, i (i)}
							<tr
								class="cursor-pointer border-b last:border-0 transition-colors {transaction.selected ? 'bg-indigo-50' : 'hover:bg-gray-50'}"
								onclick={() => toggleTransaction(i)}
							>
								<td class="py-2 pr-2">
									<input
										type="checkbox"
										checked={transaction.selected}
										onchange={() => toggleTransaction(i)}
										onclick={(e) => e.stopPropagation()}
										class="rounded"
									/>
								</td>
								<td class="py-2 text-gray-500">{transaction.date}</td>
								<td class="py-2 font-medium">{transaction.description}</td>
								<td class="py-2 text-right font-medium {transaction.isCredit ? 'text-green-600' : 'text-red-600'}">
									{transaction.isCredit ? '+' : '-'}${transaction.amount.toFixed(2)}
								</td>
								<td class="py-2 text-center">
									<span class="rounded px-1.5 py-0.5 text-xs font-medium {transaction.isCredit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
										{transaction.isCredit ? 'Credit' : 'Expense'}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Content>
	{#if parsed.length > 0 && selectedCount > 0}
		<Footer class="flex items-center justify-between p-4">
			<p class="text-xs text-gray-500">
				Credits will be imported as refunds. Expenses grouped by month.
			</p>
			<Button onclick={handleImport} class="bg-green-600 hover:bg-green-700">
				Import {selectedCount} Transaction{selectedCount !== 1 ? 's' : ''} — ${selectedTotal.toFixed(2)}
			</Button>
		</Footer>
	{/if}
</Card>
