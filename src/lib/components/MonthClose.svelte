<script lang="ts">
	import { type Month, appStore } from '$lib/models';
	import { Button } from '$lib/components/ui/button';
	import { Card, Header, Title, Content, Footer } from '$lib/components/ui/card';

	interface Props {
		month: Month;
		onCancel: () => void;
		onFinalize: () => void;
	}

	let { month, onCancel, onFinalize }: Props = $props();

	const sortedTransactions = $derived([...month.transactions].sort((a, b) => {
		if (a.type !== b.type) return a.type === 'expense' ? -1 : 1;
		return a.description.localeCompare(b.description);
	}));

	const expenseTransactions = $derived(month.transactions.filter(t => t.type === 'expense'));
	const creditTransactions = $derived(month.transactions.filter(t => t.type === 'reimbursement' || t.type === 'refund'));
	const pendingExpenses = $derived(expenseTransactions.filter(t => t.payment_status === 'unpaid'));

	const handleMarkPaid = (transactionId: string) => {
		const transaction = month.getTransaction(transactionId);
		if (transaction) {
			transaction.markPaid();
			month.calculateTotals();
			appStore.save();
		}
	};

	const handleMarkUnpaid = (transactionId: string) => {
		const transaction = month.getTransaction(transactionId);
		if (transaction) {
			transaction.markUnpaid();
			month.calculateTotals();
			appStore.save();
		}
	};

	const handleMarkAllPaid = () => {
		month.markAllPaid();
		appStore.save();
	};

	const handleCancelClose = () => {
		month.cancelClose();
		appStore.save();
		onCancel();
	};

	const handleFinalizeClose = () => {
		month.finalizeClose();
		appStore.save();
		onFinalize();
	};

	const allReviewed = $derived(pendingExpenses.length === 0);

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'paid': return 'bg-green-100 text-green-700';
			case 'unpaid': return 'bg-red-100 text-red-700';
			default: return 'bg-gray-100 text-gray-700';
		}
	};

	const categoryTotals = $derived(() => {
		const totals = month.getTotalsByCategory();
		const result: { id: string; name: string; amount: number }[] = [];
		for (const [catId, amount] of totals) {
			result.push({ id: catId, name: appStore.getCategoryFullName(catId), amount });
		}
		return result.sort((a, b) => b.amount - a.amount);
	});

	const getCategoryNames = (categoryIds: string[]) => {
		return categoryIds.map(id => appStore.getCategoryFullName(id)).filter(Boolean);
	};
</script>

<div class="space-y-4">
	<Card class="w-full">
		<Header>
			<Title class="text-xl font-bold">Close Month: {month.name}</Title>
			<p class="text-sm text-gray-500">Review each expense's payment status before closing</p>
		</Header>
		<Content class="p-4">
			<div class="mb-6 grid grid-cols-2 gap-4 text-center md:grid-cols-4">
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

			{#if categoryTotals().length > 0}
				<div class="mb-6">
					<h3 class="text-sm font-medium text-gray-700 mb-2">Expenses by Category</h3>
					<div class="space-y-1">
						{#each categoryTotals() as cat}
							<div class="flex justify-between text-sm">
								<span class="text-gray-600">{cat.name}</span>
								<span class="font-medium">${cat.amount.toFixed(2)}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="mb-4">
				<div class="flex justify-between text-sm">
					<span>Expense Review Progress</span>
					<span>{expenseTransactions.length - pendingExpenses.length} / {expenseTransactions.length} reviewed</span>
				</div>
				<div class="mt-1 h-2 w-full rounded-full bg-gray-200">
					<div
						class="h-2 rounded-full bg-indigo-500 transition-all"
						style="width: {expenseTransactions.length > 0 ? ((expenseTransactions.length - pendingExpenses.length) / expenseTransactions.length) * 100 : 100}%"
					></div>
				</div>
			</div>

			<div class="mb-4 flex gap-2">
				<Button variant="outline" size="sm" onclick={handleMarkAllPaid}>Mark All Paid</Button>
			</div>

			{#if creditTransactions.length > 0}
				<div class="mb-4">
					<h3 class="text-sm font-medium text-gray-700 mb-2">{month.isCompany ? "Reimbursements" : "Refunds"} ({creditTransactions.length})</h3>
					<div class="space-y-2">
						{#each creditTransactions as transaction (transaction.id)}
							{@const categories = getCategoryNames(transaction.category_ids)}
							<div class="rounded-lg border border-green-200 bg-green-50 p-3">
								<div class="flex items-start justify-between">
									<div>
										<span class="font-medium">{transaction.description}</span>
										{#if categories.length > 0}
											<div class="mt-1 flex flex-wrap gap-1">
												{#each categories as cat}
													<span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{cat}</span>
												{/each}
											</div>
										{/if}
									</div>
									<span class="font-medium text-green-600">+${transaction.amount.toFixed(2)}</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if expenseTransactions.length === 0}
				<p class="text-center text-gray-500">No expenses in this month</p>
			{:else}
				<h3 class="text-sm font-medium text-gray-700 mb-2">Expenses ({expenseTransactions.length})</h3>
				<div class="space-y-3">
					{#each sortedTransactions.filter(t => t.type === 'expense') as transaction (transaction.id)}
						{@const categories = getCategoryNames(transaction.category_ids)}
						<div class="rounded-lg border p-3 {transaction.payment_status === 'unpaid' ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}">
							<div class="flex items-start justify-between">
								<div>
									<div class="flex items-center gap-2">
										<span class="font-medium">{transaction.description}</span>
										<span class="rounded px-2 py-0.5 text-xs font-medium {getStatusBadge(transaction.payment_status)}">
											{transaction.payment_status}
										</span>
									</div>
									{#if categories.length > 0}
										<div class="mt-1 flex flex-wrap gap-1">
											{#each categories as cat}
												<span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{cat}</span>
											{/each}
										</div>
									{/if}
									<div class="mt-1 text-sm text-gray-600">
										<span class="font-medium text-red-600">-${transaction.amount.toFixed(2)}</span>
									</div>
									{#if transaction.note}
										<p class="text-xs text-gray-500 mt-1">{transaction.note}</p>
									{/if}
									{#if transaction.hasImages}
										<div class="mt-1 flex gap-1">
											{#each transaction.images as img (img.id)}
												<img src={img.dataUrl} alt={img.name} class="h-10 w-10 rounded border object-cover" />
											{/each}
										</div>
									{/if}
								</div>

								{#if transaction.payment_status === 'unpaid'}
									<div class="flex gap-1">
										<Button size="sm" onclick={() => handleMarkPaid(transaction.id)} class="bg-green-600 hover:bg-green-700">Paid</Button>
										<Button size="sm" variant="outline" onclick={() => handleMarkUnpaid(transaction.id)} class="text-red-600 hover:bg-red-50">Unpaid</Button>
									</div>
								{:else}
									<Button size="sm" variant="ghost" onclick={() => {
										const t = month.getTransaction(transaction.id);
										if (t) { t.resetPaymentStatus(); month.calculateTotals(); appStore.save(); }
									}}>Reset</Button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Content>
		<Footer class="flex justify-between p-4">
			<Button variant="outline" onclick={handleCancelClose}>
				Cancel & Return to Active
			</Button>
			<Button
				onclick={handleFinalizeClose}
				disabled={!allReviewed}
				class={allReviewed ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
			>
				{#if allReviewed}
					Finalize & Close Month
				{:else}
					Review All Expenses First ({month.transactionsPending.length} remaining)
				{/if}
			</Button>
		</Footer>
	</Card>
</div>
