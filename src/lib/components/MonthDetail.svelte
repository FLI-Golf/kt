<script lang="ts">
	import { type Month, type CommonTransaction } from '$lib/models';
	import { appStore } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';
	import TransactionList from './TransactionList.svelte';
	import TransactionForm from './TransactionForm.svelte';
	import CommonTransactionList from './CommonTransactionList.svelte';
	import TransactionDropZone from './TransactionDropZone.svelte';
	import MonthClose from './MonthClose.svelte';
	import CsvImporter from './CsvImporter.svelte';

	interface Props {
		month: Month;
		onBack: () => void;
		onEdit: () => void;
		onCreateNextMonth?: () => void;
	}

	let { month, onBack, onEdit, onCreateNextMonth }: Props = $props();

	let showAddTransaction = $state(false);
	let showCsvImport = $state(false);
	let editingTransactionId = $state<string | null>(null);

	const handleSelectCommonTransaction = (ct: CommonTransaction) => {
		const transaction = month.addTransaction(ct.description);
		transaction.amount = ct.default_amount;
		transaction.category_ids = [...ct.category_ids];
		month.calculateTotals();
		appStore.save();
	};

	$effect(() => {
		month.calculateTotals();
	});

	const formatDate = (iso: string) => {
		return new Date(iso).toLocaleDateString();
	};

	const handleAddTransaction = (data: { description: string; amount: number; type: 'expense' | 'reimbursement'; category_ids: string[]; note: string; images: import('$lib/models').ImageAttachment[] }) => {
		const transaction = month.addTransaction(data.description);
		transaction.amount = data.amount;
		transaction.type = data.type;
		transaction.category_ids = data.category_ids;
		transaction.note = data.note;
		transaction.images = data.images;
		month.calculateTotals();
		appStore.save();
		showAddTransaction = false;
	};

	const handleEditTransaction = (data: { description: string; amount: number; type: 'expense' | 'reimbursement'; category_ids: string[]; note: string; images: import('$lib/models').ImageAttachment[] }) => {
		if (!editingTransactionId) return;
		const transaction = month.getTransaction(editingTransactionId);
		if (transaction) {
			transaction.description = data.description;
			transaction.amount = data.amount;
			transaction.type = data.type;
			transaction.category_ids = data.category_ids;
			transaction.note = data.note;
			transaction.images = data.images;
			month.calculateTotals();
			appStore.save();
		}
		editingTransactionId = null;
	};

	const handleDeleteTransaction = (id: string) => {
		month.removeTransaction(id);
		appStore.save();
	};

	const handleStartClose = () => {
		month.startClose();
		appStore.save();
	};

	const handleCancelClose = () => {
		// MonthClose component handles this
	};

	const handleFinalizeClose = () => {
		if (onCreateNextMonth) {
			if (confirm('Month closed. Create next month?')) {
				onCreateNextMonth();
			}
		}
	};

	const handleReopenMonth = () => {
		if (confirm('Reopen this month? This will reset all payment statuses.')) {
			month.cancelClose();
			appStore.save();
		}
	};

	const handleDeleteMonth = () => {
		if (confirm('Are you sure you want to delete this month?')) {
			appStore.deleteMonth(month.id);
			onBack();
		}
	};

	const handleDropTransaction = (data: { description: string; category_ids: string[]; default_amount?: number }) => {
		const transaction = month.addTransaction(data.description);
		transaction.amount = data.default_amount || 0;
		transaction.category_ids = [...data.category_ids];
		month.calculateTotals();
		appStore.save();
	};

	let undoMessage = $state<string | null>(null);
	let undoTimer: ReturnType<typeof setTimeout> | null = null;

	const handleMoveTransaction = (transactionId: string) => {
		const targetType = month.isPersonal ? 'company' : 'personal';
		const targetName = appStore.moveTransaction(month.id, transactionId, targetType);
		if (targetName) {
			month.calculateTotals();
			undoMessage = `Moved to ${targetName}`;
			if (undoTimer) clearTimeout(undoTimer);
			undoTimer = setTimeout(() => { undoMessage = null; }, 10_000);
		}
	};

	const handleUndo = () => {
		const restoredName = appStore.undoMoveTransaction();
		if (restoredName) {
			month.calculateTotals();
		}
		undoMessage = null;
		if (undoTimer) clearTimeout(undoTimer);
	};

	const moveLabel = $derived(month.isPersonal ? 'To Company' : 'To Personal');

	const editingTransaction = $derived(editingTransactionId ? month.getTransaction(editingTransactionId) : undefined);

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'active': return { class: 'bg-green-100 text-green-700', label: 'Active' };
			case 'pending_close': return { class: 'bg-orange-100 text-orange-700', label: 'Pending Close' };
			case 'closed': return { class: 'bg-gray-100 text-gray-700', label: 'Closed' };
			default: return { class: 'bg-gray-100 text-gray-700', label: status };
		}
	};

	const statusBadge = $derived(getStatusBadge(month.status));
</script>

{#if month.isPendingClose}
	<div class="space-y-4">
		<Button variant="ghost" size="sm" onclick={onBack} class="mb-2">← Back</Button>
		<MonthClose
			{month}
			onCancel={handleCancelClose}
			onFinalize={handleFinalizeClose}
		/>
	</div>
{:else}
	<div class="space-y-4">
		<Card class="w-full">
			<Header class="flex flex-row items-start justify-between">
				<div>
					<Button variant="ghost" size="sm" onclick={onBack} class="mb-2">← Back</Button>
					<div class="flex items-center gap-2">
						<Title class="text-2xl font-bold">{month.name}</Title>
						<span class="rounded px-2 py-1 text-xs font-medium {statusBadge.class}">
							{statusBadge.label}
						</span>
					</div>
					<p class="text-sm text-gray-500">
						{formatDate(month.start)} - {formatDate(month.end)}
					</p>
				</div>
				<div class="flex gap-2">
					{#if month.isActive}
						<Button size="sm" onclick={handleStartClose} class="bg-orange-500 hover:bg-orange-600">
							Close Month
						</Button>
						<Button variant="outline" size="sm" onclick={onEdit}>Edit</Button>
					{:else if month.isClosed}
						<Button variant="outline" size="sm" onclick={handleReopenMonth}>
							Reopen
						</Button>
						{#if onCreateNextMonth}
							<Button size="sm" onclick={onCreateNextMonth} class="bg-indigo-500 hover:bg-indigo-600">
								Create Next Month
							</Button>
						{/if}
					{/if}
					<Button variant="outline" size="sm" onclick={handleDeleteMonth} class="text-red-600 hover:bg-red-50">
						Delete
					</Button>
				</div>
			</Header>
			<Content class="p-4">
				<div class="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
					<div class="rounded-lg bg-green-50 p-3">
						<p class="text-sm text-gray-600">{month.isCompany ? 'Reimbursements' : 'Refunds'}</p>
						<p class="text-xl font-bold text-green-600">+${(month.isCompany ? month.total_reimbursement : month.total_refund).toFixed(2)}</p>
					</div>
					<div class="rounded-lg bg-red-50 p-3">
						<p class="text-sm text-gray-600">Expenses</p>
						<p class="text-xl font-bold text-red-600">-${month.total_expenses.toFixed(2)}</p>
					</div>
					<div class="rounded-lg p-3 {month.net_balance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}">
						<p class="text-sm text-gray-600">Net Balance</p>
						<p class="text-xl font-bold {month.net_balance >= 0 ? 'text-blue-600' : 'text-orange-600'}">
							{month.net_balance >= 0 ? '+' : ''}${month.net_balance.toFixed(2)}
						</p>
					</div>
					<div class="rounded-lg bg-gray-50 p-3">
						<p class="text-sm text-gray-600">Unpaid Expenses</p>
						<p class="text-xl font-bold text-gray-600">${month.total_unpaid.toFixed(2)}</p>
					</div>
				</div>
			</Content>
		</Card>

		{#if month.isActive}
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-4">
				<div class="lg:col-span-1">
					<CommonTransactionList onSelect={handleSelectCommonTransaction} />
				</div>
				<div class="lg:col-span-3">
					{#if showCsvImport}
					<CsvImporter onClose={() => showCsvImport = false} />
				{:else if showAddTransaction}
						<TransactionForm
							accountType={month.accountType}
							onSave={handleAddTransaction}
							onCancel={() => (showAddTransaction = false)}
						/>
					{:else if editingTransaction}
						<TransactionForm
							accountType={month.accountType}
							transaction={editingTransaction}
							onSave={handleEditTransaction}
							onCancel={() => (editingTransactionId = null)}
						/>
					{:else}
						<TransactionDropZone onDrop={handleDropTransaction}>
							<TransactionList
								transactions={month.transactions}
								onAddTransaction={() => (showAddTransaction = true)}
								onEditTransaction={(id) => (editingTransactionId = id)}
								onDeleteTransaction={handleDeleteTransaction}
								onMoveTransaction={handleMoveTransaction}
								{moveLabel}
							/>
						</TransactionDropZone>
					{/if}
				</div>
			</div>
		{:else}
			<TransactionList
				transactions={month.transactions}
				onAddTransaction={() => {}}
				onEditTransaction={() => {}}
				onDeleteTransaction={() => {}}
				onMoveTransaction={handleMoveTransaction}
				{moveLabel}
			/>
		{/if}
	</div>
{/if}

{#if undoMessage}
	<div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
		<span>{undoMessage}</span>
		<button
			class="rounded bg-white px-3 py-1 text-sm font-medium text-gray-900 hover:bg-gray-100"
			onclick={handleUndo}
		>
			Undo
		</button>
		<button
			class="ml-1 text-gray-400 hover:text-white"
			onclick={() => { undoMessage = null; appStore.clearMoveUndo(); }}
		>
			✕
		</button>
	</div>
{/if}
