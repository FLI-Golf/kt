import { generateId } from '$lib/commands.svelte';
import { Transaction, type TransactionData } from './Transaction.svelte';

export type MonthStatus = 'active' | 'pending_close' | 'closed';
export type AccountType = 'personal' | 'company';

export const SUPPORTED_YEARS = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030] as const;
export const DEFAULT_YEAR = 2026;

export const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
] as const;

export interface MonthData {
	id: string;
	name: string;
	year: number;
	monthIndex: number; // 0-11
	accountType: AccountType;
	transactions: TransactionData[];
	start: string;
	end: string;
	total_amount: number;
	total_reimbursement: number;
	total_refund: number;
	total_expenses: number;
	total_paid: number;
	total_unpaid: number;
	net_balance: number;
	status: MonthStatus;
	closed_date: string | null;
	previous_month_id: string | null;
	next_month_id: string | null;
	created: string;
	updated: string;
}

/** Build a display name like "January 2026 - Personal" */
function buildMonthName(year: number, monthIndex: number, accountType: AccountType): string {
	const label = accountType === 'company' ? 'Company' : 'Personal';
	return `${MONTH_NAMES[monthIndex]} ${year} - ${label}`;
}

/** First day of the month as ISO string */
function monthStart(year: number, monthIndex: number): string {
	return new Date(year, monthIndex, 1, 12, 0, 0).toISOString();
}

/** Last day of the month as ISO string */
function monthEnd(year: number, monthIndex: number): string {
	// Day 0 of next month = last day of this month
	return new Date(year, monthIndex + 1, 0, 12, 0, 0).toISOString();
}

export class Month {
	private _state = $state<Omit<MonthData, 'transactions'>>({
		id: '',
		name: '',
		year: DEFAULT_YEAR,
		monthIndex: new Date().getMonth(),
		accountType: 'personal',
		start: monthStart(DEFAULT_YEAR, new Date().getMonth()),
		end: monthEnd(DEFAULT_YEAR, new Date().getMonth()),
		total_amount: 0,
		total_reimbursement: 0,
		total_refund: 0,
		total_expenses: 0,
		total_paid: 0,
		total_unpaid: 0,
		net_balance: 0,
		status: 'active',
		closed_date: null,
		previous_month_id: null,
		next_month_id: null,
		created: new Date().toISOString(),
		updated: new Date().toISOString()
	});

	private _transactions = $state<Transaction[]>([]);

	constructor(year: number = DEFAULT_YEAR, monthIndex: number = new Date().getMonth(), accountType: AccountType = 'personal') {
		this._state.id = generateId();
		this._state.year = year;
		this._state.monthIndex = monthIndex;
		this._state.accountType = accountType;
		this._state.name = buildMonthName(year, monthIndex, accountType);
		this._state.start = monthStart(year, monthIndex);
		this._state.end = monthEnd(year, monthIndex);
		this._state.created = new Date().toISOString();
		this._state.updated = new Date().toISOString();
	}

	// Getters
	get id() { return this._state.id; }
	get name() { return this._state.name; }
	get year() { return this._state.year; }
	get monthIndex() { return this._state.monthIndex; }
	get accountType() { return this._state.accountType; }
	get isPersonal() { return this._state.accountType === 'personal'; }
	get isCompany() { return this._state.accountType === 'company'; }
	get start() { return this._state.start; }
	get end() { return this._state.end; }
	get total_amount() { return this._state.total_amount; }
	get total_reimbursement() { return this._state.total_reimbursement; }
	get total_refund() { return this._state.total_refund; }
	get total_expenses() { return this._state.total_expenses; }
	get total_paid() { return this._state.total_paid; }
	get total_unpaid() { return this._state.total_unpaid; }
	get net_balance() { return this._state.net_balance; }
	get status() { return this._state.status; }
	get closed_date() { return this._state.closed_date; }
	get previous_month_id() { return this._state.previous_month_id; }
	get next_month_id() { return this._state.next_month_id; }
	get created() { return this._state.created; }
	get updated() { return this._state.updated; }
	get transactions() { return this._transactions; }

	// Status helpers
	get isActive() { return this._state.status === 'active'; }
	get isPendingClose() { return this._state.status === 'pending_close'; }
	get isClosed() { return this._state.status === 'closed'; }

	// Legacy getter for backward compatibility
	get active() { return this._state.status === 'active'; }

	// Setters
	set name(value: string) {
		this._state.name = value;
		this.touch();
	}

	set start(value: string) {
		this._state.start = value;
		this.touch();
	}

	set end(value: string) {
		this._state.end = value;
		this.touch();
	}

	set status(value: MonthStatus) {
		this._state.status = value;
		this.touch();
	}

	set previous_month_id(value: string | null) {
		this._state.previous_month_id = value;
		this.touch();
	}

	set next_month_id(value: string | null) {
		this._state.next_month_id = value;
		this.touch();
	}

	// Legacy setter for backward compatibility
	set active(value: boolean) {
		this._state.status = value ? 'active' : 'closed';
		this.touch();
	}

	// Computed properties
	get transactionCount() { return this._transactions.length; }

	// Payment status counts
	get transactionsPaid() { return this._transactions.filter(t => t.payment_status === 'paid'); }
	get transactionsUnpaid() { return this._transactions.filter(t => t.payment_status === 'unpaid'); }
	get transactionsPending() { return this._transactions.filter(t => t.payment_status === 'pending'); }

	// Methods
	private touch() {
		this._state.updated = new Date().toISOString();
	}

	calculateTotals() {
		this._state.total_reimbursement = this._transactions
			.filter(t => t.type === 'reimbursement')
			.reduce((sum, t) => sum + t.amount, 0);

		this._state.total_refund = this._transactions
			.filter(t => t.type === 'refund')
			.reduce((sum, t) => sum + t.amount, 0);

		this._state.total_expenses = this._transactions
			.filter(t => t.type === 'expense')
			.reduce((sum, t) => sum + t.amount, 0);

		this._state.total_amount = this._transactions.reduce((sum, t) => sum + t.amount, 0);

		// Net balance = (reimbursements + refunds) - expenses
		this._state.net_balance = (this._state.total_reimbursement + this._state.total_refund) - this._state.total_expenses;

		// Paid/unpaid only applies to expenses
		this._state.total_paid = this._transactions
			.filter(t => t.type === 'expense' && t.payment_status === 'paid')
			.reduce((sum, t) => sum + t.amount, 0);

		this._state.total_unpaid = this._transactions
			.filter(t => t.type === 'expense' && t.payment_status !== 'paid')
			.reduce((sum, t) => sum + t.amount, 0);
	}

	// Get totals grouped by category
	getTotalsByCategory(): Map<string, number> {
		const totals = new Map<string, number>();
		for (const transaction of this._transactions) {
			for (const categoryId of transaction.category_ids) {
				const current = totals.get(categoryId) || 0;
				totals.set(categoryId, current + transaction.amount);
			}
		}
		return totals;
	}

	addTransaction(description: string): Transaction {
		const transaction = new Transaction(description);
		this._transactions.push(transaction);
		this.touch();
		return transaction;
	}

	removeTransaction(id: string): boolean {
		const index = this._transactions.findIndex(t => t.id === id);
		if (index !== -1) {
			this._transactions.splice(index, 1);
			this.calculateTotals();
			this.touch();
			return true;
		}
		return false;
	}

	getTransaction(id: string): Transaction | undefined {
		return this._transactions.find(t => t.id === id);
	}

	activate() {
		this._state.status = 'active';
		this.touch();
	}

	deactivate() {
		this._state.status = 'closed';
		this.touch();
	}

	// Month lifecycle methods
	startClose() {
		this._state.status = 'pending_close';
		this.touch();
	}

	cancelClose() {
		this._state.status = 'active';
		this._transactions.forEach(t => t.resetPaymentStatus());
		this.calculateTotals();
		this.touch();
	}

	finalizeClose() {
		this._state.status = 'closed';
		this._state.closed_date = new Date().toISOString();
		this.calculateTotals();
		this.touch();
	}

	// Mark all transactions as paid
	markAllPaid() {
		this._transactions.forEach(t => {
			if (t.amount > 0) {
				t.markPaid();
			}
		});
		this.calculateTotals();
		this.touch();
	}

	// Serialization
	toJSON(): MonthData {
		return {
			...this._state,
			transactions: this._transactions.map(t => t.toJSON())
		};
	}

	static fromJSON(data: MonthData): Month {
		const month = new Month();
		month._state = {
			id: data.id,
			name: data.name,
			year: data.year ?? DEFAULT_YEAR,
			monthIndex: data.monthIndex ?? 0,
			accountType: data.accountType ?? 'personal',
			start: data.start,
			end: data.end,
			total_amount: data.total_amount || 0,
			total_reimbursement: data.total_reimbursement || 0,
			total_refund: data.total_refund || 0,
			total_expenses: data.total_expenses || 0,
			total_paid: data.total_paid || 0,
			total_unpaid: data.total_unpaid || 0,
			net_balance: data.net_balance || 0,
			status: data.status || ((data as MonthData & { active?: boolean }).active ? 'active' : 'closed'),
			closed_date: data.closed_date || null,
			previous_month_id: data.previous_month_id || null,
			next_month_id: data.next_month_id || null,
			created: data.created,
			updated: data.updated
		};
		month._transactions = (data.transactions || []).map(t => Transaction.fromJSON(t));
		month.calculateTotals();
		return month;
	}
}
