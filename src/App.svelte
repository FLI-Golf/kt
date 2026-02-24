<script lang="ts">
	import { appStore, type Month, type AccountType, DEFAULT_YEAR } from '$lib/models';
	import { MonthList, MonthForm, MonthDetail, MonthHistory, CategoryList, SyncStatus, CsvImporter, CompanyCsvImporter, ChaseImporter, ResolveView } from '$lib/components';

	// Initialize store on mount
	$effect(() => {
		appStore.init();
	});

	// View state
	type View = 'list' | 'create' | 'edit' | 'detail' | 'import' | 'import-company' | 'import-chase';
	let currentView = $state<View>('list');
	let selectedMonth = $state<Month | undefined>(undefined);
	
	// Tab state
	type Tab = 'active' | 'history' | 'categories' | 'resolve';
	let currentTab = $state<Tab>('active');

	// Counts for badges
	const activeCount = $derived(appStore.months.filter(m => !m.isClosed).length);
	const historyCount = $derived(appStore.months.filter(m => m.isClosed).length);
	const categoryCount = $derived(appStore.categoryCount);
	const companyTxCount = $derived(
		appStore.months.filter(m => m.accountType === 'company').reduce((s, m) => s + m.transactionCount, 0)
	);

	const handleSelectMonth = (month: Month) => {
		selectedMonth = month;
		appStore.setActiveMonth(month.id);
		currentView = 'detail';
	};

	const handleCreateMonth = () => {
		currentView = 'create';
	};

	const handleSaveNewMonth = (data: { year: number; monthIndex: number; accountType: AccountType }) => {
		if (appStore.monthExists(data.year, data.monthIndex, data.accountType)) {
			alert(`A ${data.accountType} month already exists for that period.`);
			return;
		}
		const month = appStore.createMonth(data.year, data.monthIndex, data.accountType);
		selectedMonth = month;
		currentView = 'detail';
	};

	const handleEditMonth = () => {
		currentView = 'edit';
	};

	const handleUpdateMonth = (data: { year: number; monthIndex: number; accountType: AccountType }) => {
		if (selectedMonth) {
			const labels: Record<string, string> = { personal: 'Personal', company: 'Company', business: 'Business' };
			const label = labels[data.accountType] || 'Personal';
			selectedMonth.name = `${['January','February','March','April','May','June','July','August','September','October','November','December'][data.monthIndex]} ${data.year} - ${label}`;
			appStore.save();
		}
		currentView = 'detail';
	};

	const handleBack = () => {
		selectedMonth = undefined;
		currentView = 'list';
	};

	const handleCancel = () => {
		if (selectedMonth) {
			currentView = 'detail';
		} else {
			currentView = 'list';
		}
	};

	const handleCreateNextMonth = () => {
		if (selectedMonth && selectedMonth.isClosed) {
			const nextMonth = appStore.createNextMonthFromClosed(selectedMonth.id);
			if (nextMonth) {
				selectedMonth = nextMonth;
				appStore.setActiveMonth(nextMonth.id);
			}
		}
	};

	let showRemoveMenu = $state(false);

	const handleRemoveData = (accountType: 'personal' | 'company' | 'business') => {
		const labels: Record<string, string> = { personal: 'Personal', company: 'Company', business: 'Business' };
		const months = appStore.months.filter(m => m.accountType === accountType);
		const txCount = months.reduce((s, m) => s + m.transactionCount, 0);
		if (months.length === 0) {
			alert(`No ${labels[accountType]} months to remove.`);
			showRemoveMenu = false;
			return;
		}
		if (!confirm(`Delete ALL ${months.length} ${labels[accountType]} month(s) and ${txCount} transaction(s)? This cannot be undone.`)) {
			showRemoveMenu = false;
			return;
		}
		for (const m of months) {
			appStore.deleteMonth(m.id);
		}
		showRemoveMenu = false;
		selectedMonth = undefined;
		currentView = 'list';
	};

	console.log("APP BOOTED", new Date().toISOString());
	console.log("PB URL", import.meta.env.VITE_POCKETBASE_URL);
</script>

<main class="min-h-screen bg-gray-100 p-4 md:p-8">
	<div class="mx-auto max-w-4xl">
		<header class="mb-6 p-6">
			<div class="flex items-start justify-between">
			<div class="flex items-center gap-3">
				<div class="rounded-xl bg-indigo-100 p-2.5">
					<svg class="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
					</svg>
				</div>
				<div>
					<h1 class="text-3xl font-bold text-gray-900">Expense Tracker</h1>
					<p class="text-gray-500">Monthly Expense & Reimbursement Management</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<button
					onclick={() => currentView = 'import'}
					class="rounded-lg bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-200"
				>
					Import Personal
				</button>
				<button
					onclick={() => currentView = 'import-company'}
					class="rounded-lg bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-200"
				>
					Import Company
				</button>
				<button
					onclick={() => currentView = 'import-chase'}
					class="rounded-lg bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-200"
				>
					Import Chase
				</button>
				<div class="relative">
					<button
						onclick={() => showRemoveMenu = !showRemoveMenu}
						class="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
					>
						Remove Data
					</button>
					{#if showRemoveMenu}
						<div class="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
							<button
								onclick={() => handleRemoveData('personal')}
								class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-red-50 hover:text-red-700"
							>
								<span class="h-2 w-2 rounded-full bg-blue-500"></span>
								Personal
							</button>
							<button
								onclick={() => handleRemoveData('business')}
								class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-red-50 hover:text-red-700"
							>
								<span class="h-2 w-2 rounded-full bg-amber-500"></span>
								Business
							</button>
							<button
								onclick={() => handleRemoveData('company')}
								class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-red-50 hover:text-red-700"
							>
								<span class="h-2 w-2 rounded-full bg-purple-500"></span>
								Company
							</button>
						</div>
					{/if}
				</div>
				<SyncStatus />
			</div>
			</div>
		</header>

		{#if !appStore.initialized}
			<p class="text-center text-gray-500">Loading...</p>
		{:else if currentView === 'list'}
			<div class="space-y-4">
				<!-- Tab Buttons -->
				<div class="flex gap-2">
					<button
						onclick={() => currentTab = 'active'}
						class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors {currentTab === 'active' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
					>
						Active
						{#if activeCount > 0}
							<span class="rounded-full px-2 py-0.5 text-xs {currentTab === 'active' ? 'bg-indigo-500 text-white' : 'bg-gray-300 text-gray-600'}">
								{activeCount}
							</span>
						{/if}
					</button>
					<button
						onclick={() => currentTab = 'history'}
						class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors {currentTab === 'history' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
					>
						History
						{#if historyCount > 0}
							<span class="rounded-full px-2 py-0.5 text-xs {currentTab === 'history' ? 'bg-indigo-500 text-white' : 'bg-gray-300 text-gray-600'}">
								{historyCount}
							</span>
						{/if}
					</button>
					<button
						onclick={() => currentTab = 'categories'}
						class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors {currentTab === 'categories' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
					>
						Categories
						{#if categoryCount > 0}
							<span class="rounded-full px-2 py-0.5 text-xs {currentTab === 'categories' ? 'bg-indigo-500 text-white' : 'bg-gray-300 text-gray-600'}">
								{categoryCount}
							</span>
						{/if}
					</button>
					<button
						onclick={() => currentTab = 'resolve'}
						class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors {currentTab === 'resolve' ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
					>
						Resolve
						{#if companyTxCount > 0}
							<span class="rounded-full px-2 py-0.5 text-xs {currentTab === 'resolve' ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-600'}">
								{companyTxCount}
							</span>
						{/if}
					</button>

				</div>

				<!-- Tab Content -->
				{#if currentTab === 'active'}
					<MonthList onSelectMonth={handleSelectMonth} onCreateMonth={handleCreateMonth} />
				{:else if currentTab === 'history'}
					<MonthHistory onSelectMonth={handleSelectMonth} />
				{:else if currentTab === 'categories'}
					<CategoryList />
				{:else if currentTab === 'resolve'}
					<ResolveView />
				{/if}
			</div>
		{:else if currentView === 'create'}
			<MonthForm onSave={handleSaveNewMonth} onCancel={handleCancel} />
		{:else if currentView === 'edit' && selectedMonth}
			<MonthForm month={selectedMonth} onSave={handleUpdateMonth} onCancel={handleCancel} />
		{:else if currentView === 'detail' && selectedMonth}
			<MonthDetail
				month={selectedMonth}
				onBack={handleBack}
				onEdit={handleEditMonth}
				onCreateNextMonth={handleCreateNextMonth}
			/>
		{:else if currentView === 'import'}
			<CsvImporter onClose={() => currentView = 'list'} />
		{:else if currentView === 'import-company'}
			<CompanyCsvImporter onClose={() => currentView = 'list'} />
		{:else if currentView === 'import-chase'}
			<ChaseImporter onClose={() => currentView = 'list'} />
		{/if}
	</div>
</main>
