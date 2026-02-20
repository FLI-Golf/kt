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
		category: string;
		service: string;
		notes: string;
		payment: string;
		isPaid: boolean;
		receiptUrls: string[];
		selected: boolean;
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

	function parseAmount(raw: string): number {
		if (!raw || raw.trim() === '') return 0;
		const cleaned = raw.replace(/[$",\s]/g, '');
		return Math.abs(parseFloat(cleaned) || 0);
	}

	function parseDateParts(dateStr: string): { year: number; monthIndex: number } | null {
		// M/D/YYYY or MM/DD/YYYY
		const parts = dateStr.trim().split('/');
		if (parts.length !== 3) return null;
		const m = parseInt(parts[0], 10);
		const y = parseInt(parts[2], 10);
		if (isNaN(m) || isNaN(y) || m < 1 || m > 12) return null;
		return { year: y, monthIndex: m - 1 };
	}

	function extractReceiptUrls(raw: string): string[] {
		if (!raw || raw.trim() === '') return [];
		const urls: string[] = [];
		// Extract URLs from the SeaTable JSON-like format: 'url': 'https://...'
		const matches = raw.matchAll(/'url':\s*'([^']+)'/g);
		for (const match of matches) {
			urls.push(match[1]);
		}
		return urls;
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
				fields.push(current);
				current = '';
			} else {
				current += ch;
			}
		}
		fields.push(current);
		return fields;
	}

	function parseFile(text: string) {
		parseError = null;
		parsedRows = [];

		const lines = text.split('\n').filter(l => l.trim().length > 0);
		if (lines.length < 2) {
			parseError = 'CSV file is empty or has no data rows.';
			return;
		}

		// Verify header
		const headerLine = lines[0].toLowerCase();
		if (!headerLine.includes('expense') || !headerLine.includes('total cost')) {
			parseError = 'Expected headers: Expense, Receipt, Reimbursements, Category, Employee, Notes, Date, Total cost, Payment, Service, Signature, Paid?';
			return;
		}

		const rows: ParsedRow[] = [];

		for (let i = 1; i < lines.length; i++) {
			const fields = parseCsvLine(lines[i]);
			if (fields.length < 12) continue;

			const [expense, receipt, _reimbursements, category, _employee, notes, date, totalCost, payment, service, _signature, paid] = fields;

			const amount = parseAmount(totalCost);
			if (amount === 0) continue;

			const dateParts = parseDateParts(date);
			if (!dateParts) continue;

			const receiptUrls = extractReceiptUrls(receipt);

			rows.push({
				date: date.trim(),
				year: dateParts.year,
				monthIndex: dateParts.monthIndex,
				description: expense.trim(),
				amount,
				category: category.trim(),
				service: service.trim(),
				notes: notes.trim(),
				payment: payment.trim(),
				isPaid: paid.trim().toLowerCase() === 'true',
				receiptUrls,
				selected: true
			});
		}

		if (rows.length === 0) {
			parseError = 'No valid expense rows found in the CSV.';
			return;
		}

		parsedRows = rows;
	}

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
				m => m.year === year && m.monthIndex === monthIndex && m.accountType === 'company'
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
		const row = parsedRows[index];
		if (row) row.selected = !row.selected;
		parsedRows = [...parsedRows];
	}

	function getGlobalIndex(row: ParsedRow): number {
		return parsedRows.indexOf(row);
	}

	// Map SeaTable category/service values to our category names
	const CATEGORY_MAP: Record<string, string> = {
		'food & drinks': 'Client Meals',
		'meals and entertainment': 'Meals & Entertainment',
		'travel': 'Business Travel',
		'mileage': 'Mileage',
		'hotel': 'Hotel (Business)',
		'office supplies': 'Supplies',
		'software': 'Software',
		'equipment': 'Equipment',
	};

	function findCategoryId(csvCategory: string, csvService: string): string[] {
		const ids: string[] = [];
		const searchTerms = [csvCategory, csvService].filter(Boolean);

		for (const term of searchTerms) {
			const lower = term.toLowerCase();

			// Check explicit mapping first
			const mapped = CATEGORY_MAP[lower];
			if (mapped) {
				const match = appStore.categories.find(c => c.name === mapped);
				if (match && !ids.includes(match.id)) {
					ids.push(match.id);
					continue;
				}
			}

			// Fuzzy match
			const match = appStore.categories.find(c =>
				c.name.toLowerCase() === lower ||
				c.name.toLowerCase().includes(lower) ||
				lower.includes(c.name.toLowerCase())
			);
			if (match && !ids.includes(match.id)) {
				ids.push(match.id);
			}
		}
		return ids;
	}

	function handleImport() {
		importing = true;
		const results: { monthName: string; count: number }[] = [];

		for (const group of monthGroups()) {
			const selectedRows = group.rows.filter(r => r.selected);
			if (selectedRows.length === 0) continue;

			let month = group.existingMonth;
			if (!month) {
				if (!SUPPORTED_YEARS.includes(group.year as any)) continue;
				month = appStore.createMonth(group.year, group.monthIndex, 'company');
			}

			for (const row of selectedRows) {
				const transaction = month.addTransaction(row.description);
				transaction.amount = row.amount;
				transaction.type = 'expense';

				// Build note from CSV fields
				const noteParts: string[] = [];
				if (row.notes) noteParts.push(row.notes);
				if (row.payment) noteParts.push(`Payment: ${row.payment}`);
				noteParts.push(`Date: ${row.date}`);
				transaction.note = noteParts.join(' | ');

				// Match categories
				const catIds = findCategoryId(row.category, row.service);
				if (catIds.length > 0) transaction.category_ids = catIds;

				// Set payment status
				if (row.isPaid) {
					transaction.markPaid();
				}
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
	const totalAmount = $derived(parsedRows.filter(r => r.selected).reduce((s, r) => s + r.amount, 0));
	const paidCount = $derived(parsedRows.filter(r => r.selected && r.isPaid).length);
	const unpaidCount = $derived(parsedRows.filter(r => r.selected && !r.isPaid).length);
</script>

<Card class="w-full">
	<Header>
		<Title class="text-xl font-bold">Import Company Expenses (CSV)</Title>
		<p class="text-sm text-gray-500">Import past company expense data grouped by month</p>
	</Header>
	<Content class="p-4">
		{#if importDone}
			<div class="rounded-lg bg-green-50 p-6 text-center">
				<p class="text-lg font-medium text-green-700">Import Complete</p>
				<div class="mt-3 space-y-1">
					{#each importResults as result}
						<p class="text-sm text-gray-700">
							<span class="font-medium">{result.monthName}</span>: {result.count} expense{result.count !== 1 ? 's' : ''}
						</p>
					{/each}
				</div>
				<Button onclick={onClose} class="mt-4">Done</Button>
			</div>
		{:else if parsedRows.length === 0}
			<div class="space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<label
						class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-6 text-gray-500 transition-colors hover:border-purple-400 hover:text-purple-600"
					>
						<svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
						</svg>
						<span class="text-sm font-medium">Upload CSV file</span>
						<span class="text-xs">SeaTable / expense report format</span>
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
							class="h-32 w-full rounded-lg border border-gray-300 p-3 text-xs font-mono text-gray-700 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
						></textarea>
						<button
							type="button"
							onclick={handlePaste}
							disabled={!pastedText.trim()}
							class="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Parse Pasted Data
						</button>
					</div>
				</div>

				{#if parseError}
					<div class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{parseError}</div>
				{/if}

				<div class="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
					<p class="font-medium">Expected CSV headers:</p>
					<p class="mt-1 font-mono">Expense, Receipt, Reimbursements, Category, Employee, Notes, Date, Total cost, Payment, Service, Signature, Paid?</p>
				</div>
			</div>
		{:else}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium">{fileName}</p>
						<p class="text-xs text-gray-500">
							{parsedRows.length} expenses across {monthGroups().length} month{monthGroups().length !== 1 ? 's' : ''} — {selectedCount} selected
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
							<p class="text-xs text-gray-600">Total Expenses</p>
							<p class="text-lg font-bold text-red-600">${totalAmount.toFixed(2)}</p>
						</div>
						<div class="rounded-lg bg-green-50 p-2">
							<p class="text-xs text-gray-600">Paid</p>
							<p class="text-lg font-bold text-green-600">{paidCount}</p>
						</div>
						<div class="rounded-lg bg-orange-50 p-2">
							<p class="text-xs text-gray-600">Unpaid</p>
							<p class="text-lg font-bold text-orange-600">{unpaidCount}</p>
						</div>
					</div>
				{/if}

				<div class="space-y-4 max-h-[28rem] overflow-y-auto">
					{#each monthGroups() as group}
						{@const groupSelected = group.rows.filter(r => r.selected).length}
						{@const groupTotal = group.rows.filter(r => r.selected).reduce((s, r) => s + r.amount, 0)}

						<div class="rounded-lg border">
							<div class="flex items-center justify-between border-b bg-gray-50 px-3 py-2">
								<div class="flex items-center gap-2">
									<h3 class="text-sm font-bold">{group.label}</h3>
									<span class="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">Company</span>
									{#if group.willCreate}
										<span class="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700">New</span>
									{:else}
										<span class="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">Exists</span>
									{/if}
									<span class="text-xs text-gray-500">{groupSelected}/{group.rows.length}</span>
								</div>
								<div class="flex items-center gap-3">
									<span class="text-xs text-red-600">${groupTotal.toFixed(2)}</span>
									<div class="flex gap-1">
										<Button variant="ghost" size="sm" class="h-6 px-2 text-xs" onclick={() => toggleGroup(group.year, group.monthIndex, true)}>All</Button>
										<Button variant="ghost" size="sm" class="h-6 px-2 text-xs" onclick={() => toggleGroup(group.year, group.monthIndex, false)}>None</Button>
									</div>
								</div>
							</div>

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
											<td class="p-2 max-w-[14rem] truncate text-xs" title={row.description}>
												{row.description}
												{#if row.receiptUrls.length > 0}
													<span class="ml-1 text-indigo-500" title="{row.receiptUrls.length} receipt(s)">
														[{row.receiptUrls.length} img]
													</span>
												{/if}
											</td>
											<td class="p-2 text-xs text-gray-500">{row.category}</td>
											<td class="p-2 text-right text-xs font-medium text-red-600">${row.amount.toFixed(2)}</td>
											<td class="p-2 text-center">
												<span class="rounded px-1.5 py-0.5 text-xs font-medium {row.isPaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">
													{row.isPaid ? 'Paid' : 'Unpaid'}
												</span>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/each}
				</div>

				<p class="text-xs text-gray-500">
					Months marked <span class="rounded bg-yellow-100 px-1 py-0.5 text-yellow-700">New</span> will be created as Company months.
					Categories are auto-matched when possible.
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
						class={selectedCount > 0 ? 'bg-purple-600 hover:bg-purple-700' : ''}
					>
						{importing ? 'Importing...' : `Import ${selectedCount} Expenses`}
					</Button>
				</div>
			{/if}
		</Footer>
	{/if}
</Card>
