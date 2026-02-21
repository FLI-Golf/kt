export interface PaymentGroupTransaction {
    transactionId: string;
    monthId: string;
    description: string;
    amount: number;
}

export interface PaymentGroupData {
    id: string;
    checkNumber: string;
    note: string;
    transactions: PaymentGroupTransaction[];
    totalAmount: number;
    created: string;
}

export class PaymentGroup {
    private _state = $state<PaymentGroupData>({
        id: '',
        checkNumber: '',
        note: '',
        transactions: [],
        totalAmount: 0,
        created: new Date().toISOString(),
    });

    constructor(checkNumber: string = '') {
        this._state.id = crypto.randomUUID();
        this._state.checkNumber = checkNumber;
    }

    get id() { return this._state.id; }
    get checkNumber() { return this._state.checkNumber; }
    get note() { return this._state.note; }
    get transactions() { return this._state.transactions; }
    get totalAmount() { return this._state.totalAmount; }
    get transactionCount() { return this._state.transactions.length; }
    get created() { return this._state.created; }

    set checkNumber(value: string) { this._state.checkNumber = value; }
    set note(value: string) { this._state.note = value; }

    addTransaction(transactionId: string, monthId: string, description: string, amount: number) {
        this._state.transactions.push({ transactionId, monthId, description, amount });
        this._state.totalAmount = this._state.transactions.reduce((sum, t) => sum + t.amount, 0);
    }

    removeTransaction(transactionId: string) {
        this._state.transactions = this._state.transactions.filter(t => t.transactionId !== transactionId);
        this._state.totalAmount = this._state.transactions.reduce((sum, t) => sum + t.amount, 0);
    }

    toJSON(): PaymentGroupData {
        return { ...this._state, transactions: [...this._state.transactions] };
    }

    static fromJSON(data: PaymentGroupData): PaymentGroup {
        const group = new PaymentGroup();
        group._state = {
            ...data,
            transactions: data.transactions || [],
            totalAmount: data.totalAmount || 0,
        };
        return group;
    }
}
