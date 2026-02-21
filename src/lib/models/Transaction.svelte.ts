import { generateId } from '$lib/commands.svelte';

export type PaymentStatus = 'pending' | 'paid' | 'unpaid';
export type TransactionType = 'expense' | 'reimbursement' | 'refund';

export interface ImageAttachment {
    id: string;
    /** base64 data URL (e.g. "data:image/jpeg;base64,...") */
    dataUrl: string;
    name: string;
    created: string;
}

export interface TransactionData {
    id: string;
    description: string;
    amount: number;
    type: TransactionType;
    category_ids: string[];
    payment_status: PaymentStatus;
    paid_date: string | null;
    check_number: string | null;
    payment_group_id: string | null;
    note: string;
    images: ImageAttachment[];
    created: string;
    updated: string;
}

export class Transaction {
    private _state = $state<TransactionData>({
        id: '',
        description: '',
        amount: 0,
        type: 'expense',
        category_ids: [],
        payment_status: 'unpaid',
        paid_date: null,
        check_number: null,
        payment_group_id: null,
        note: '',
        images: [],
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
    get type() { return this._state.type; }
    get category_ids() { return this._state.category_ids; }
    get payment_status() { return this._state.payment_status; }
    get paid_date() { return this._state.paid_date; }
    get check_number() { return this._state.check_number; }
    get payment_group_id() { return this._state.payment_group_id; }
    get note() { return this._state.note; }
    get images() { return this._state.images; }
    get created() { return this._state.created; }
    get updated() { return this._state.updated; }
    
    get isReimbursement() { return this._state.type === 'reimbursement'; }
    get isRefund() { return this._state.type === 'refund'; }
    get isExpense() { return this._state.type === 'expense'; }
    /** Returns true if this transaction puts money back (reimbursement or refund) */
    get isCredit() { return this._state.type === 'reimbursement' || this._state.type === 'refund'; }
    get hasImages() { return this._state.images.length > 0; }
    get imageCount() { return this._state.images.length; }

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

    set type(value: TransactionType) {
        this._state.type = value;
        this.touch();
    }

    set images(value: ImageAttachment[]) {
        this._state.images = [...value];
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

    // Image methods
    addImage(dataUrl: string, name: string = 'receipt') {
        const image: ImageAttachment = {
            id: generateId(),
            dataUrl,
            name,
            created: new Date().toISOString()
        };
        this._state.images = [...this._state.images, image];
        this.touch();
    }

    removeImage(imageId: string) {
        this._state.images = this._state.images.filter(img => img.id !== imageId);
        this.touch();
    }

    // Payment methods
    markPaid(checkNumber?: string, groupId?: string) {
        this._state.payment_status = 'paid';
        this._state.paid_date = new Date().toISOString();
        if (checkNumber) this._state.check_number = checkNumber;
        if (groupId) this._state.payment_group_id = groupId;
        this.touch();
    }

    markUnpaid() {
        this._state.payment_status = 'unpaid';
        this._state.paid_date = null;
        this._state.check_number = null;
        this._state.payment_group_id = null;
        this.touch();
    }

    resetPaymentStatus() {
        this._state.payment_status = 'unpaid';
        this._state.paid_date = null;
        this.touch();
    }

    // Serialization
    toJSON(): TransactionData {
        return { ...this._state };
    }

    static fromJSON(data: TransactionData): Transaction {
        const transaction = new Transaction();
        // Migrate legacy 'income' type to 'reimbursement'
        const type = (data.type as string) === 'income' ? 'reimbursement' : (data.type || 'expense');
        transaction._state = {
            ...data,
            type: type as TransactionType,
            payment_status: data.payment_status === 'pending' ? 'unpaid' : (data.payment_status || 'unpaid'),
            paid_date: data.paid_date || null,
            check_number: data.check_number || null,
            payment_group_id: data.payment_group_id || null,
            category_ids: data.category_ids || [],
            images: data.images || []
        };
        return transaction;
    }
}
