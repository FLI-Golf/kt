<script lang="ts">
	import { type Week, type CommonTransaction } from '$lib/models';
	import { appStore } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content } from '$lib/components/ui/card';
	import TransactionList from './TransactionList.svelte';
	import TransactionForm from './TransactionForm.svelte';
	import CommonTransactionList from './CommonTransactionList.svelte';
	import TransactionDropZone from './TransactionDropZone.svelte';
	import WeekClose from './WeekClose.svelte';

	interface Props {
		week: Week;
		onBack: () => void;
		onEdit: () => void;
		onCreateNextWeek?: () => void;
	}

	let { week, onBack, onEdit, onCreateNextWeek }: Props = $props();

	let showAddTransaction = $state(false);
	let editingTransactionId = $state<string | null>(null);

	// Handle selecting a common transaction - adds it directly to the week
	const handleSelectCommonTransaction = (ct: CommonTransaction) => {
		const transaction = week.addTransaction(ct.description);
		transaction.amount = ct.default_amount;
		transaction.category_ids = [...ct.category_ids];
		week.calculateTotals();
		appStore.save();
	};

	// Recalculate totals when component mounts or week changes
	$effect(() => {
		week.calculateTotals();
	});

	const formatDate = (iso: string) => {
		return new Date(iso).toLocaleDateString();
	};

	const handleAddTransaction = (data: { description: string; amount: number; category_ids: string[]; note: string }) => {
		const transaction = week.addTransaction(data.description);
		transaction.amount = data.amount;
		transaction.category_ids = data.category_ids;
		transaction.note = data.note;
		week.calculateTotals();
		appStore.save();
		showAddTransaction = false;
	};

	const handleEditTransaction = (data: { description: string; amount: number; category_ids: string[]; note: string }) => {
		if (!editingTransactionId) return;
		const transaction = week.getTransaction(editingTransactionId);
		if (transaction) {
			transaction.description = data.description;
			transaction.amount = data.amount;
			transaction.category_ids = data.category_ids;
			transaction.note = data.note;
			week.calculateTotals();
			appStore.save();
		}
		editingTransactionId = null;
	};

	const handleDeleteTransaction = (id: string) => {
		week.removeTransaction(id);
		appStore.save();
	};

	const handleStartClose = () => {
		week.startClose();
		appStore.save();
	};

	const handleCancelClose = () => {
		// WeekClose component handles this
	};

	const handleFinalizeClose = () => {
		// Week is now closed
		if (onCreateNextWeek) {
			if (confirm('Week closed. Create next week?')) {
				onCreateNextWeek();
			}
		}
	};

	const handleReopenWeek = () => {
		if (confirm('Reopen this week? This will reset all payment statuses.')) {
			week.cancelClose();
			appStore.save();
		}
	};

	const handleDeleteWeek = () => {
		if (confirm('Are you sure you want to delete this week?')) {
			appStore.deleteWeek(week.id);
			onBack();
		}
	};

	const handleDropTransaction = (data: { description: string; category_ids: string[]; default_amount?: number }) => {
		const transaction = week.addTransaction(data.description);
		transaction.amount = data.default_amount || 0;
		transaction.category_ids = [...data.category_ids];
		week.calculateTotals();
		appStore.save();
	};

	const editingTransaction = $derived(editingTransactionId ? week.getTransaction(editingTransactionId) : undefined);

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'active': return { class: 'bg-green-100 text-green-700', label: 'Active' };
			case 'pending_close': return { class: 'bg-orange-100 text-orange-700', label: 'Pending Close' };
			case 'closed': return { class: 'bg-gray-100 text-gray-700', label: 'Closed' };
			default: return { class: 'bg-gray-100 text-gray-700', label: status };
		}
	};

	const statusBadge = $derived(getStatusBadge(week.status));
</script>

{#if week.isPendingClose}
	<!-- Week Close Review Mode -->
	<div class="space-y-4">
		<Button variant="ghost" size="sm" onclick={onBack} class="mb-2">← Back</Button>
		<WeekClose 
			{week} 
			onCancel={handleCancelClose} 
			onFinalize={handleFinalizeClose} 
		/>
	</div>
{:else}
	<!-- Normal Week View -->
	<div class="space-y-4">
		<Card class="w-full">
			<Header class="flex flex-row items-start justify-between">
				<div>
					<Button variant="ghost" size="sm" onclick={onBack} class="mb-2">← Back</Button>
					<div class="flex items-center gap-2">
						<Title class="text-2xl font-bold">{week.name}</Title>
						<span class="rounded px-2 py-1 text-xs font-medium {statusBadge.class}">
							{statusBadge.label}
						</span>
					</div>
					<p class="text-sm text-gray-500">
						{formatDate(week.start)} - {formatDate(week.end)}
					</p>
				</div>
				<div class="flex gap-2">
					{#if week.isActive}
						<Button size="sm" onclick={handleStartClose} class="bg-orange-500 hover:bg-orange-600">
							Close Week
						</Button>
						<Button variant="outline" size="sm" onclick={onEdit}>Edit</Button>
					{:else if week.isClosed}
						<Button variant="outline" size="sm" onclick={handleReopenWeek}>
							Reopen
						</Button>
						{#if onCreateNextWeek}
							<Button size="sm" onclick={onCreateNextWeek} class="bg-indigo-500 hover:bg-indigo-600">
								Create Next Week
							</Button>
						{/if}
					{/if}
					<Button variant="outline" size="sm" onclick={handleDeleteWeek} class="text-red-600 hover:bg-red-50">
						Delete
					</Button>
				</div>
			</Header>
			<Content class="p-4">
				<div class="grid grid-cols-3 gap-4 text-center">
					<div class="rounded-lg bg-blue-50 p-3">
						<p class="text-sm text-gray-600">Total Expenses</p>
						<p class="text-xl font-bold text-blue-600">${week.total_amount.toFixed(2)}</p>
					</div>
					<div class="rounded-lg bg-green-50 p-3">
						<p class="text-sm text-gray-600">Paid</p>
						<p class="text-xl font-bold text-green-600">${week.total_paid.toFixed(2)}</p>
					</div>
					<div class="rounded-lg bg-red-50 p-3">
						<p class="text-sm text-gray-600">Unpaid</p>
						<p class="text-xl font-bold text-red-600">${week.total_unpaid.toFixed(2)}</p>
					</div>
				</div>
			</Content>
		</Card>

		{#if week.isActive}
			<!-- Transaction management for active weeks -->
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-4">
				<!-- Common Transactions (sidebar) -->
				<div class="lg:col-span-1">
					<CommonTransactionList onSelect={handleSelectCommonTransaction} />
				</div>

				<!-- Week Transactions (main area) -->
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
								transactions={week.transactions}
								onAddTransaction={() => (showAddTransaction = true)}
								onEditTransaction={(id) => (editingTransactionId = id)}
								onDeleteTransaction={handleDeleteTransaction}
							/>
						</TransactionDropZone>
					{/if}
				</div>
			</div>
		{:else}
			<!-- Read-only transaction list for closed weeks -->
			<TransactionList
				transactions={week.transactions}
				onAddTransaction={() => {}}
				onEditTransaction={() => {}}
				onDeleteTransaction={() => {}}
			/>
		{/if}
	</div>
{/if}
