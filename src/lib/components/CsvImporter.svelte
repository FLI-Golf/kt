<script lang="ts">
	import { type Month, appStore, MONTH_NAMES, SUPPORTED_YEARS } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content, Footer } from '$lib/components/ui/card';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	interface ParsedRow {
		date: string;
		year: number;
		monthIndex: number;
		description: string;
		amount: number;
		type: 'expense' | 'refund';
		selected: boolean;
		runningBal: string;
	}

	interface MonthGroup {
		year: number;
		monthIndex: number;
		label: string;
		rows: ParsedRow[];
		existingMonth: Month | undefined;
		willCreate: boolean;
	}

	let parsedRows = $state<ParsedRow[]>([]);
	let parseError = $state<string | null>(null);
	let fileName = $state('');
	let pastedText = $state('');
	let importing = $state(false);
	let importDone = $state(false);
	let importResults = $state<{ monthName: string; count: number }[]>([]);

	const SKIP_PATTERNS = [
		/^KEEP THE CHANGE TRANSFER/i,
		/^Beginning balance/i,
		/^Ending balance/i,
		/^Total credits/i,
		/^Total debits/i,
	];

	function parseAmount(raw: string): number {
		if (!raw || raw.trim() === '') return 0;
		const cleaned = raw.replace(/[",\s]/g, '');
		return parseFloat(cleaned) || 0;
	}

	function parseCsvLine(line: string): string[] {
		const fields: string[] = [];
		let current = '';
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (ch === '"') {
				inQuotes = !inQuotes;
			} else if (ch === ',' && !inQuotes) {
				fields.push(current.trim());
				current = '';
			} else {
				current += ch;
			}
		}
		fields.push(current.trim());
		return fields;
	}

	function parseDateParts(dateStr: string): { year: number; monthIndex: number } | null {
		// MM/DD/YYYY
		const parts = dateStr.split('/');
		if (parts.length !== 3) return null;
		const m = parseInt(parts[0], 10);
		const y = parseInt(parts[2], 10);
		if (isNaN(m) || isNaN(y)) return null;
		return { year: y, monthIndex: m - 1 };
	}

	function parseFile(text: string) {
		parseError = null;
		parsedRows = [];

		const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

		let dataStartIndex = -1;
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].toLowerCase().startsWith('date,description,amount')) {
				dataStartIndex = i + 1;
				break;
			}
		}

		if (dataStartIndex === -1) {
			parseError = 'Could not find transaction header row (Date,Description,Amount,Running Bal.)';
			return;
		}

		const rows: ParsedRow[] = [];

		for (let i = dataStartIndex; i < lines.length; i++) {
			const fields = parseCsvLine(lines[i]);
			if (fields.length < 3) continue;

			const [date, description, amountStr, runningBal] = fields;
			if (!amountStr || amountStr.trim() === '') continue;

			const amount = parseAmount(amountStr);
			if (amount === 0) continue;

			const dateParts = parseDateParts(date);
			if (!dateParts) continue;

			const shouldSkip = SKIP_PATTERNS.some(p => p.test(description));

			rows.push({
				date,
				year: dateParts.year,
				monthIndex: dateParts.monthIndex,
				description,
				amount: Math.abs(amount),
				type: amount < 0 ? 'expense' : 'refund',
				selected: !shouldSkip,
				runningBal: runningBal || ''
			});
		}

		if (rows.length === 0) {
			parseError = 'No transactions found in the CSV file.';
			return;
		}

		parsedRows = rows;
	}

	// Group rows by year+month
	const monthGroups = $derived<MonthGroup[]>(() => {
		const map = new Map<string, ParsedRow[]>();

		for (const row of parsedRows) {
			const key = `${row.year}-${row.monthIndex}`;
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(row);
		}

		const groups: MonthGroup[] = [];
		for (const [key, rows] of map) {
			const [yearStr, miStr] = key.split('-');
			const year = parseInt(yearStr);
			const monthIndex = parseInt(miStr);
			const existing = appStore.months.find(
				m => m.year === year && m.monthIndex === monthIndex && m.accountType === 'personal'
			);

			groups.push({
				year,
				monthIndex,
				label: `${MONTH_NAMES[monthIndex]} ${year}`,
				rows,
				existingMonth: existing,
				willCreate: !existing
			});
		}

		// Sort chronologically
		groups.sort((a, b) => a.year !== b.year ? a.year - b.year : a.monthIndex - b.monthIndex);
		return groups;
	});

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;
		const file = input.files[0];
		fileName = file.name;
		const reader = new FileReader();
		reader.onload = () => parseFile(reader.result as string);
		reader.readAsText(file);
		input.value = '';
	}

	function handlePaste() {
		if (!pastedText.trim()) return;
		fileName = 'Pasted data';
		parseFile(pastedText);
	}

	function toggleAll(selected: boolean) {
		parsedRows = parsedRows.map(r => ({ ...r, selected }));
	}

	function toggleGroup(year: number, monthIndex: number, selected: boolean) {
		parsedRows = parsedRows.map(r =>
			r.year === year && r.monthIndex === monthIndex ? { ...r, selected } : r
		);
	}

	function toggleRow(index: number) {
		// Find the global index
		const row = parsedRows[index];
		if (row) row.selected = !row.selected;
		parsedRows = [...parsedRows];
	}

	function getGlobalIndex(row: ParsedRow): number {
		return parsedRows.indexOf(row);
	}

	function handleImport() {
		importing = true;
		const results: { monthName: string; count: number }[] = [];

		for (const group of monthGroups()) {
			const selectedRows = group.rows.filter(r => r.selected);
			if (selectedRows.length === 0) continue;

			// Find or create the month
			let month = group.existingMonth;
			if (!month) {
				if (!SUPPORTED_YEARS.includes(group.year as any)) continue;
				month = appStore.createMonth(group.year, group.monthIndex, 'personal');
			}

			for (const row of selectedRows) {
				const transaction = month.addTransaction(row.description);
				transaction.amount = row.amount;
				transaction.type = row.type;
				transaction.note = `Bank: ${row.date}`;
			}

			month.calculateTotals();
			results.push({ monthName: month.name, count: selectedRows.length });
		}

		appStore.save();
		importResults = results;
		importing = false;
		importDone = true;
	}

	const selectedCount = $derived(parsedRows.filter(r => r.selected).length);
	const totalSelectedExpenses = $derived(
		parsedRows.filter(r => r.selected && r.type === 'expense').reduce((s, r) => s + r.amount, 0)
	);
	const totalSelectedCredits = $derived(
		parsedRows.filter(r => r.selected && r.type === 'refund').reduce((s, r) => s + r.amount, 0)
	);
</script>

<Card class="w-full">
	<Header>
		<Title class="text-xl font-bold">Import Bank Statement (CSV)</Title>
		<p class="text-sm text-gray-500">Transactions are grouped by month and imported into the correct period</p>
	</Header>
	<Content class="p-4">
		{#if importDone}
			<div class="rounded-lg bg-green-50 p-6 text-center">
				<p class="text-lg font-medium text-green-700">Import Complete</p>
				<div class="mt-3 space-y-1">
					{#each importResults as result}
						<p class="text-sm text-gray-700">
							<span class="font-medium">{result.monthName}</span>: {result.count} transaction{result.count !== 1 ? 's' : ''}
						</p>
					{/each}
				</div>
				<Button onclick={onClose} class="mt-4">Done</Button>
			</div>
		{:else if parsedRows.length === 0}
			<div class="space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<label
						class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-6 text-gray-500 transition-colors hover:border-indigo-400 hover:text-indigo-600"
					>
						<svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
						</svg>
						<span class="text-sm font-medium">Upload CSV file</span>
						<span class="text-xs">Bank of America format</span>
						<input
							type="file"
							accept=".csv,text/csv"
							class="hidden"
							onchange={handleFileSelect}
						/>
					</label>
					<div class="flex flex-col gap-2">
						<textarea
							bind:value={pastedText}
							placeholder="Or paste CSV data here..."
							class="h-32 w-full rounded-lg border border-gray-300 p-3 text-xs font-mono text-gray-700 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
						></textarea>
						<button
							type="button"
							onclick={handlePaste}
							disabled={!pastedText.trim()}
							class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Parse Pasted Data
						</button>
					</div>
				</div>

				{#if parseError}
					<div class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{parseError}</div>
				{/if}

				<div class="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
					<p class="font-medium">Expected CSV format:</p>
					<p class="mt-1 font-mono">Date,Description,Amount,Running Bal.</p>
					<p class="font-mono">11/13/2025,"STORE NAME","-6.02","5,375.86"</p>
				</div>
			</div>
		{:else}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium">{fileName}</p>
						<p class="text-xs text-gray-500">
							{parsedRows.length} transactions across {monthGroups().length} month{monthGroups().length !== 1 ? 's' : ''} — {selectedCount} selected
						</p>
					</div>
					<div class="flex gap-2">
						<Button variant="outline" size="sm" onclick={() => toggleAll(true)}>Select All</Button>
						<Button variant="outline" size="sm" onclick={() => toggleAll(false)}>Deselect All</Button>
					</div>
				</div>

				{#if selectedCount > 0}
					<div class="grid grid-cols-3 gap-3 text-center">
						<div class="rounded-lg bg-red-50 p-2">
							<p class="text-xs text-gray-600">Expenses</p>
							<p class="text-lg font-bold text-red-600">-${totalSelectedExpenses.toFixed(2)}</p>
						</div>
						<div class="rounded-lg bg-green-50 p-2">
							<p class="text-xs text-gray-600">Credits</p>
							<p class="text-lg font-bold text-green-600">+${totalSelectedCredits.toFixed(2)}</p>
						</div>
						<div class="rounded-lg bg-blue-50 p-2">
							<p class="text-xs text-gray-600">Net</p>
							<p class="text-lg font-bold {totalSelectedCredits - totalSelectedExpenses >= 0 ? 'text-blue-600' : 'text-orange-600'}">
								${(totalSelectedCredits - totalSelectedExpenses).toFixed(2)}
							</p>
						</div>
					</div>
				{/if}

				<!-- Grouped by month -->
				<div class="space-y-4 max-h-[28rem] overflow-y-auto">
					{#each monthGroups() as group}
						{@const groupSelected = group.rows.filter(r => r.selected).length}
						{@const groupExpenses = group.rows.filter(r => r.selected && r.type === 'expense').reduce((s, r) => s + r.amount, 0)}
						{@const groupCredits = group.rows.filter(r => r.selected && r.type === 'refund').reduce((s, r) => s + r.amount, 0)}

						<div class="rounded-lg border">
							<!-- Month header -->
							<div class="flex items-center justify-between border-b bg-gray-50 px-3 py-2">
								<div class="flex items-center gap-2">
									<h3 class="text-sm font-bold">{group.label}</h3>
									{#if group.willCreate}
										<span class="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700">New</span>
									{:else}
										<span class="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">Exists</span>
									{/if}
									<span class="text-xs text-gray-500">
										{groupSelected}/{group.rows.length} selected
									</span>
								</div>
								<div class="flex items-center gap-3">
									<span class="text-xs">
										<span class="text-red-600">-${groupExpenses.toFixed(2)}</span>
										{' / '}
										<span class="text-green-600">+${groupCredits.toFixed(2)}</span>
									</span>
									<div class="flex gap-1">
										<Button variant="ghost" size="sm" class="h-6 px-2 text-xs" onclick={() => toggleGroup(group.year, group.monthIndex, true)}>All</Button>
										<Button variant="ghost" size="sm" class="h-6 px-2 text-xs" onclick={() => toggleGroup(group.year, group.monthIndex, false)}>None</Button>
									</div>
								</div>
							</div>

							<!-- Rows -->
							<table class="w-full text-sm">
								<tbody>
									{#each group.rows as row}
										{@const gi = getGlobalIndex(row)}
										<tr
											class="border-b last:border-0 {row.selected ? 'bg-white' : 'bg-gray-50 opacity-50'} hover:bg-gray-100 cursor-pointer"
											onclick={() => toggleRow(gi)}
										>
											<td class="w-8 p-2">
												<input
													type="checkbox"
													checked={row.selected}
													onclick={(e) => e.stopPropagation()}
													onchange={() => toggleRow(gi)}
													class="rounded"
												/>
											</td>
											<td class="p-2 whitespace-nowrap text-xs text-gray-500">{row.date}</td>
											<td class="p-2 max-w-xs truncate text-xs" title={row.description}>{row.description}</td>
											<td class="p-2 text-right text-xs font-medium {row.type === 'expense' ? 'text-red-600' : 'text-green-600'}">
												{row.type === 'expense' ? '-' : '+'}${row.amount.toFixed(2)}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/each}
				</div>

				<p class="text-xs text-gray-500">
					Months marked <span class="rounded bg-yellow-100 px-1 py-0.5 text-yellow-700">New</span> will be created automatically as Personal months.
					"KEEP THE CHANGE" rows are auto-deselected.
				</p>
			</div>
		{/if}
	</Content>
	{#if !importDone}
		<Footer class="flex justify-between p-4">
			<Button variant="outline" onclick={onClose}>Cancel</Button>
			{#if parsedRows.length > 0}
				<div class="flex gap-2">
					<Button variant="outline" onclick={() => { parsedRows = []; fileName = ''; parseError = null; pastedText = ''; }}>
						Different File
					</Button>
					<Button
						onclick={handleImport}
						disabled={selectedCount === 0 || importing}
						class={selectedCount > 0 ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
					>
						{importing ? 'Importing...' : `Import ${selectedCount} Transactions`}
					</Button>
				</div>
			{/if}
		</Footer>
	{/if}
</Card>
