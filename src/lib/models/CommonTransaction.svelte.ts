import { generateId } from '$lib/commands.svelte';

export interface CommonTransactionData {
    id: string;
    description: string;
    default_amount: number;
    category_ids: string[];
    created: string;
}

export class CommonTransaction {
    private _state = $state<CommonTransactionData>({
        id: '',
        description: '',
        default_amount: 0,
        category_ids: [],
        created: new Date().toISOString()
    });

    constructor(description: string = '', default_amount: number = 0, category_ids: string[] = []) {
        this._state.id = generateId();
        this._state.description = description;
        this._state.default_amount = default_amount;
        this._state.category_ids = [...category_ids];
        this._state.created = new Date().toISOString();
    }

    // Getters
    get id() { return this._state.id; }
    get description() { return this._state.description; }
    get default_amount() { return this._state.default_amount; }
    get category_ids() { return this._state.category_ids; }
    get created() { return this._state.created; }

    // Setters
    set description(value: string) {
        this._state.description = value;
    }

    set default_amount(value: number) {
        this._state.default_amount = Math.abs(value);
    }

    set category_ids(value: string[]) {
        this._state.category_ids = [...value];
    }

    // Serialization
    toJSON(): CommonTransactionData {
        return { ...this._state };
    }

    static fromJSON(data: CommonTransactionData): CommonTransaction {
        const ct = new CommonTransaction();
        ct._state = { ...data };
        return ct;
    }
}
