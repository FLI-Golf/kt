import { generateId } from '$lib/commands.svelte';

export type PaymentStatus = 'pending' | 'paid' | 'unpaid';

export interface TransactionData {
    id: string;
    description: string;
    amount: number;
    category_ids: string[];
    payment_status: PaymentStatus;
    paid_date: string | null;
    note: string;
    created: string;
    updated: string;
}

export class Transaction {
    private _state = $state<TransactionData>({
        id: '',
        description: '',
        amount: 0,
        category_ids: [],
        payment_status: 'pending',
        paid_date: null,
        note: '',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
    });

    constructor(description: string = '') {
        this._state.id = generateId();
        this._state.description = description;
        this._state.created = new Date().toISOString();
        this._state.updated = new Date().toISOString();
    }

    // Getters
    get id() { return this._state.id; }
    get description() { return this._state.description; }
    get amount() { return this._state.amount; }
    get category_ids() { return this._state.category_ids; }
    get payment_status() { return this._state.payment_status; }
    get paid_date() { return this._state.paid_date; }
    get note() { return this._state.note; }
    get created() { return this._state.created; }
    get updated() { return this._state.updated; }

    // Setters with auto-update timestamp
    set description(value: string) {
        this._state.description = value;
        this.touch();
    }

    set amount(value: number) {
        this._state.amount = Math.abs(value);
        this.touch();
    }

    set category_ids(value: string[]) {
        this._state.category_ids = [...value];
        this.touch();
    }

    set note(value: string) {
        this._state.note = value;
        this.touch();
    }

    // Methods
    private touch() {
        this._state.updated = new Date().toISOString();
    }

    addCategory(categoryId: string) {
        if (!this._state.category_ids.includes(categoryId)) {
            this._state.category_ids = [...this._state.category_ids, categoryId];
            this.touch();
        }
    }

    removeCategory(categoryId: string) {
        this._state.category_ids = this._state.category_ids.filter(id => id !== categoryId);
        this.touch();
    }

    // Payment methods
    markPaid() {
        this._state.payment_status = 'paid';
        this._state.paid_date = new Date().toISOString();
        this.touch();
    }

    markUnpaid() {
        this._state.payment_status = 'unpaid';
        this._state.paid_date = null;
        this.touch();
    }

    resetPaymentStatus() {
        this._state.payment_status = 'pending';
        this._state.paid_date = null;
        this.touch();
    }

    // Serialization
    toJSON(): TransactionData {
        return { ...this._state };
    }

    static fromJSON(data: TransactionData): Transaction {
        const transaction = new Transaction();
        transaction._state = {
            ...data,
            payment_status: data.payment_status || 'pending',
            paid_date: data.paid_date || null,
            category_ids: data.category_ids || []
        };
        return transaction;
    }
}
