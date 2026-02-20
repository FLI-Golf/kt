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

	interface Props {
		month: Month;
		onBack: () => void;
		onEdit: () => void;
		onCreateNextMonth?: () => void;
	}

	let { month, onBack, onEdit, onCreateNextMonth }: Props = $props();

	let showAddTransaction = $state(false);
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

	const handleAddTransaction = (data: { description: string; amount: number; type: 'expense' | 'reimbursement'; category_ids: string[]; note: string }) => {
		const transaction = month.addTransaction(data.description);
		transaction.amount = data.amount;
		transaction.type = data.type;
		transaction.category_ids = data.category_ids;
		transaction.note = data.note;
		month.calculateTotals();
		appStore.save();
		showAddTransaction = false;
	};

	const handleEditTransaction = (data: { description: string; amount: number; type: 'expense' | 'reimbursement'; category_ids: string[]; note: string }) => {
		if (!editingTransactionId) return;
		const transaction = month.getTransaction(editingTransactionId);
		if (transaction) {
			transaction.description = data.description;
			transaction.amount = data.amount;
			transaction.type = data.type;
			transaction.category_ids = data.category_ids;
			transaction.note = data.note;
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
						<p class="text-sm text-gray-600">Reimbursements</p>
						<p class="text-xl font-bold text-green-600">+${month.total_reimbursement.toFixed(2)}</p>
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
					{#if showAddTransaction}
						<TransactionForm
							onSave={handleAddTransaction}
							onCancel={() => (showAddTransaction = false)}
						/>
					{:else if editingTransaction}
						<TransactionForm
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
			/>
		{/if}
	</div>
{/if}
