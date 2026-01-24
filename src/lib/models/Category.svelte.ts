import { generateId } from '$lib/commands.svelte';

export interface CategoryData {
    id: string;
    name: string;
    parent_id: string | null;
    created: string;
}

export class Category {
    private _state = $state<CategoryData>({
        id: '',
        name: '',
        parent_id: null,
        created: new Date().toISOString()
    });

    constructor(name: string = '', parent_id: string | null = null) {
        this._state.id = generateId();
        this._state.name = name;
        this._state.parent_id = parent_id;
        this._state.created = new Date().toISOString();
    }

    // Getters
    get id() { return this._state.id; }
    get name() { return this._state.name; }
    get parent_id() { return this._state.parent_id; }
    get created() { return this._state.created; }

    // Setters
    set name(value: string) {
        this._state.name = value;
    }

    set parent_id(value: string | null) {
        this._state.parent_id = value;
    }

    // Serialization
    toJSON(): CategoryData {
        return { ...this._state };
    }

    static fromJSON(data: CategoryData): Category {
        const category = new Category();
        category._state = { ...data };
        return category;
    }
}

// Default expense categories with hierarchy
export const DEFAULT_CATEGORIES: { name: string; children?: string[] }[] = [
    {
        name: 'Housing',
        children: ['Rent/Mortgage', 'Utilities', 'Insurance', 'Maintenance']
    },
    {
        name: 'Transportation',
        children: ['Gas', 'Car Payment', 'Insurance', 'Maintenance', 'Parking']
    },
    {
        name: 'Food',
        children: ['Groceries', 'Dining Out', 'Coffee/Drinks']
    },
    {
        name: 'Health',
        children: ['Insurance', 'Medical', 'Pharmacy', 'Gym']
    },
    {
        name: 'Entertainment',
        children: ['Streaming', 'Movies/Events', 'Hobbies']
    },
    {
        name: 'Shopping',
        children: ['Clothing', 'Electronics', 'Household']
    },
    { name: 'Subscriptions' },
    { name: 'Personal Care' },
    { name: 'Education' },
    { name: 'Gifts' },
    { name: 'Travel' },
    { name: 'Savings' },
    { name: 'Other' }
];
