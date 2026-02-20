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
    // Personal categories
    {
        name: 'Housing',
        children: ['Mortgage', 'Utilities', 'Home Insurance', 'Maintenance', 'HOA']
    },
    {
        name: 'Transportation',
        children: ['Gas', 'Car Payment', 'Car Insurance', 'Car Maintenance', 'Parking', 'Car Wash']
    },
    {
        name: 'Food & Dining',
        children: ['Groceries', 'Restaurants', 'Fast Food', 'Coffee/Drinks']
    },
    {
        name: 'Bills & Payments',
        children: ['Credit Card Payment', 'Phone/Internet', 'Subscriptions', 'Apple/iCloud']
    },
    {
        name: 'Transfers',
        children: ['Venmo', 'Apple Cash', 'Bank Transfer', 'Check']
    },
    {
        name: 'Entertainment',
        children: ['Golf', 'Bowling', 'Movies/Events', 'Streaming', 'Hobbies']
    },
    {
        name: 'Shopping',
        children: ['Clothing', 'Electronics', 'Household', 'Amazon']
    },
    {
        name: 'Health',
        children: ['Health Insurance', 'Medical', 'Pharmacy', 'Gym']
    },
    {
        name: 'Travel',
        children: ['Hotel', 'Flights', 'Rental Car', 'Travel Meals']
    },
    { name: 'Personal Care' },
    { name: 'Gifts' },
    { name: 'Education' },
    // Company categories
    {
        name: 'Meals & Entertainment',
        children: ['Client Meals', 'Team Meals', 'Events']
    },
    {
        name: 'Business Travel',
        children: ['Mileage', 'Hotel (Business)', 'Flights (Business)', 'Rental Car (Business)', 'Parking (Business)']
    },
    {
        name: 'Office',
        children: ['Supplies', 'Software', 'Equipment']
    },
    { name: 'Professional Services' },
    { name: 'Marketing' },
    { name: 'Other' }
];
