import { generateId } from '$lib/commands.svelte';
import { Transaction, type TransactionData } from './Transaction.svelte';

export type WeekStatus = 'active' | 'pending_close' | 'closed';

export interface WeekData {
    id: string;
    name: string;
    transactions: TransactionData[];
    start: string;
    end: string;
    total_amount: number;
    total_income: number;
    total_expenses: number;
    total_paid: number;
    total_unpaid: number;
    net_balance: number;
    status: WeekStatus;
    closed_date: string | null;
    previous_week_id: string | null;
    next_week_id: string | null;
    created: string;
    updated: string;
}

export class Week {
    private _state = $state<Omit<WeekData, 'transactions'>>({
        id: '',
        name: '',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        total_amount: 0,
        total_income: 0,
        total_expenses: 0,
        total_paid: 0,
        total_unpaid: 0,
        net_balance: 0,
        status: 'active',
        closed_date: null,
        previous_week_id: null,
        next_week_id: null,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
    });

    private _transactions = $state<Transaction[]>([]);

    constructor(name: string = '') {
        this._state.id = generateId();
        this._state.name = name;
        this._state.created = new Date().toISOString();
        this._state.updated = new Date().toISOString();
    }

    // Getters
    get id() { return this._state.id; }
    get name() { return this._state.name; }
    get start() { return this._state.start; }
    get end() { return this._state.end; }
    get total_amount() { return this._state.total_amount; }
    get total_income() { return this._state.total_income; }
    get total_expenses() { return this._state.total_expenses; }
    get total_paid() { return this._state.total_paid; }
    get total_unpaid() { return this._state.total_unpaid; }
    get net_balance() { return this._state.net_balance; }
    get status() { return this._state.status; }
    get closed_date() { return this._state.closed_date; }
    get previous_week_id() { return this._state.previous_week_id; }
    get next_week_id() { return this._state.next_week_id; }
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

    set status(value: WeekStatus) {
        this._state.status = value;
        this.touch();
    }

    set previous_week_id(value: string | null) {
        this._state.previous_week_id = value;
        this.touch();
    }

    set next_week_id(value: string | null) {
        this._state.next_week_id = value;
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
        // Calculate income total
        this._state.total_income = this._transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        // Calculate expenses total
        this._state.total_expenses = this._transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        
        // Total amount is all transactions
        this._state.total_amount = this._transactions.reduce((sum, t) => sum + t.amount, 0);
        
        // Net balance = income - expenses
        this._state.net_balance = this._state.total_income - this._state.total_expenses;
        
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

    // Week lifecycle methods
    startClose() {
        this._state.status = 'pending_close';
        this.touch();
    }

    cancelClose() {
        this._state.status = 'active';
        // Reset all payment statuses to pending
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
    toJSON(): WeekData {
        return {
            ...this._state,
            transactions: this._transactions.map(t => t.toJSON())
        };
    }

    static fromJSON(data: WeekData): Week {
        const week = new Week();
        week._state = {
            id: data.id,
            name: data.name,
            start: data.start,
            end: data.end,
            total_amount: data.total_amount || 0,
            total_income: data.total_income || 0,
            total_expenses: data.total_expenses || 0,
            total_paid: data.total_paid || 0,
            total_unpaid: data.total_unpaid || 0,
            net_balance: data.net_balance || 0,
            status: data.status || ((data as WeekData & { active?: boolean }).active ? 'active' : 'closed'),
            closed_date: data.closed_date || null,
            previous_week_id: data.previous_week_id || null,
            next_week_id: data.next_week_id || null,
            created: data.created,
            updated: data.updated
        };
        week._transactions = (data.transactions || []).map(t => Transaction.fromJSON(t));
        // Recalculate totals to ensure consistency with loaded transactions
        week.calculateTotals();
        return week;
    }
}
