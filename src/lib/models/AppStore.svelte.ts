import { Week, type WeekData } from './Week.svelte';
import { Category, type CategoryData, DEFAULT_CATEGORIES } from './Category.svelte';
import { CommonTransaction, type CommonTransactionData } from './CommonTransaction.svelte';
import { pbService } from '$lib/services';

const STORAGE_KEY = 'kt_app_data';
const DISABLE_CLOUD_SYNC =
  (import.meta as any).env?.VITE_DISABLE_CLOUD_SYNC === 'true';

interface AppData {
    weeks: WeekData[];
    categories: CategoryData[];
    commonTransactions: CommonTransactionData[];
    activeWeekId: string | null;
    version: number;
}

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export class AppStore {
    private _weeks = $state<Week[]>([]);
    private _categories = $state<Category[]>([]);
    private _commonTransactions = $state<CommonTransaction[]>([]);
    private _activeWeekId = $state<string | null>(null);
    private _initialized = $state(false);
    private _syncState = $state<SyncState>('idle');
    private _syncError = $state<string | null>(null);
    private _lastSynced = $state<string | null>(null);
    private _saveTimeout: ReturnType<typeof setTimeout> | null = null;

    // Getters
    get weeks() { return this._weeks; }
    get categories() { return this._categories; }
    get commonTransactions() { return this._commonTransactions; }
    get activeWeekId() { return this._activeWeekId; }
    get initialized() { return this._initialized; }
    get syncState() { return this._syncState; }
    get syncError() { return this._syncError; }
    get lastSynced() { return this._lastSynced; }
    get isCloudEnabled() { 
        return !DISABLE_CLOUD_SYNC && pbService.isConfigured; 
    }

    get activeWeek(): Week | undefined {
        if (!this._activeWeekId) return undefined;
        return this._weeks.find(w => w.id === this._activeWeekId);
    }

    get activeWeeks() {
        return this._weeks.filter(w => w.active);
    }

    get inactiveWeeks() {
        return this._weeks.filter(w => !w.active);
    }

    get weekCount() {
        return this._weeks.length;
    }

    get categoryCount() {
        return this._categories.length;
    }

    get commonTransactionCount() {
        return this._commonTransactions.length;
    }

    // Get parent categories (no parent_id)
    get parentCategories() {
        return this._categories.filter(c => c.parent_id === null);
    }

    // Get child categories for a parent
    getChildCategories(parentId: string) {
        return this._categories.filter(c => c.parent_id === parentId);
    }

    // Get category by ID
    getCategory(id: string): Category | undefined {
        return this._categories.find(c => c.id === id);
    }

    // Get category name with parent prefix
    getCategoryFullName(id: string): string {
        const category = this.getCategory(id);
        if (!category) return '';
        
        if (category.parent_id) {
            const parent = this.getCategory(category.parent_id);
            if (parent) {
                return `${parent.name} > ${category.name}`;
            }
        }
        return category.name;
    }

    // Initialization
    async init() {
        if (this._initialized) return;
        
        // First load from localStorage for immediate display
        this.loadLocal();
        
        // Initialize default categories if none exist
        if (this._categories.length === 0) {
            this.initializeDefaultCategories();
        }
        
        this._initialized = true;

        // Then try to sync from cloud
        if (!DISABLE_CLOUD_SYNC && pbService.isConfigured) {
            await this.syncFromCloud();
        } else {
            this._syncState = 'idle';
            this._syncError = null;
        }
    }

    // Initialize default expense categories
    private initializeDefaultCategories() {
        for (const cat of DEFAULT_CATEGORIES) {
            const parent = new Category(cat.name, null);
            this._categories.push(parent);
            
            if (cat.children) {
                for (const childName of cat.children) {
                    const child = new Category(childName, parent.id);
                    this._categories.push(child);
                }
            }
        }
        this.save();
    }

    // Category Management
    addCategory(name: string, parentId: string | null = null): Category {
        const category = new Category(name, parentId);
        this._categories.push(category);
        this.save();
        return category;
    }

    removeCategory(id: string): boolean {
        // Also remove child categories
        const children = this.getChildCategories(id);
        for (const child of children) {
            const childIndex = this._categories.findIndex(c => c.id === child.id);
            if (childIndex !== -1) {
                this._categories.splice(childIndex, 1);
            }
        }
        
        const index = this._categories.findIndex(c => c.id === id);
        if (index !== -1) {
            this._categories.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }

    // Common Transaction Management
    addCommonTransaction(description: string, default_amount: number = 0, category_ids: string[] = []): CommonTransaction {
        const ct = new CommonTransaction(description, default_amount, category_ids);
        this._commonTransactions.push(ct);
        this.save();
        return ct;
    }

    removeCommonTransaction(id: string): boolean {
        const index = this._commonTransactions.findIndex(ct => ct.id === id);
        if (index !== -1) {
            this._commonTransactions.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }

    getCommonTransaction(id: string): CommonTransaction | undefined {
        return this._commonTransactions.find(ct => ct.id === id);
    }

    updateCommonTransaction(id: string, data: { description?: string; default_amount?: number; category_ids?: string[] }): boolean {
        const ct = this.getCommonTransaction(id);
        if (ct) {
            if (data.description !== undefined) ct.description = data.description;
            if (data.default_amount !== undefined) ct.default_amount = data.default_amount;
            if (data.category_ids !== undefined) ct.category_ids = data.category_ids;
            this.save();
            return true;
        }
        return false;
    }

    // Week Management
    createWeek(name: string): Week {
        const week = new Week(name);
        this._weeks.push(week);
        this.save();
        return week;
    }

    deleteWeek(id: string): boolean {
        const index = this._weeks.findIndex(w => w.id === id);
        if (index !== -1) {
            this._weeks.splice(index, 1);
            if (this._activeWeekId === id) {
                this._activeWeekId = null;
            }
            this.save();
            return true;
        }
        return false;
    }

    getWeek(id: string): Week | undefined {
        return this._weeks.find(w => w.id === id);
    }

    setActiveWeek(id: string | null) {
        this._activeWeekId = id;
        this.save();
    }

    // Create next week from a closed week
    createNextWeekFromClosed(closedWeekId: string): Week | undefined {
        const closedWeek = this.getWeek(closedWeekId);
        if (!closedWeek || !closedWeek.isClosed) return undefined;

        // Generate next week name
        const weekNum = this._weeks.length + 1;
        const newWeek = this.createWeek(`Week ${weekNum}`);

        // Set date range - start day after closed week's end
        const closedEndDate = new Date(closedWeek.end);
        const startDate = new Date(closedEndDate);
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(12, 0, 0, 0);
        
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(12, 0, 0, 0);
        
        newWeek.start = startDate.toISOString();
        newWeek.end = endDate.toISOString();

        // Link weeks
        newWeek.previous_week_id = closedWeek.id;
        closedWeek.next_week_id = newWeek.id;

        newWeek.calculateTotals();
        newWeek.activate();
        this.save();

        return newWeek;
    }

    // Get expense summary across all weeks
    getExpenseSummary(): { 
        totalExpenses: number; 
        totalPaid: number; 
        totalUnpaid: number;
        byCategory: Map<string, number>;
    } {
        let totalExpenses = 0;
        let totalPaid = 0;
        const byCategory = new Map<string, number>();

        for (const week of this._weeks) {
            totalExpenses += week.total_amount;
            totalPaid += week.total_paid;
            
            const weekCategories = week.getTotalsByCategory();
            for (const [catId, amount] of weekCategories) {
                const current = byCategory.get(catId) || 0;
                byCategory.set(catId, current + amount);
            }
        }

        return {
            totalExpenses,
            totalPaid,
            totalUnpaid: totalExpenses - totalPaid,
            byCategory
        };
    }

    // Persistence - Local Storage
    private getAppData(): AppData {
        return {
            weeks: this._weeks.map(w => w.toJSON()),
            categories: this._categories.map(c => c.toJSON()),
            commonTransactions: this._commonTransactions.map(ct => ct.toJSON()),
            activeWeekId: this._activeWeekId,
            version: 2
        };
    }

    private applyAppData(data: AppData) {
        this._weeks = data.weeks.map(w => Week.fromJSON(w));
        this._categories = (data.categories || []).map(c => Category.fromJSON(c));
        this._commonTransactions = (data.commonTransactions || []).map(ct => CommonTransaction.fromJSON(ct));
        this._activeWeekId = data.activeWeekId;
        
        // Initialize default categories if none exist after loading
        if (this._categories.length === 0) {
            this.initializeDefaultCategories();
        }
    }

    private async syncToCloud() {
        if (!pbService.isConfigured) {
            this._syncState = 'idle';
            this._syncError = null;
            return;
        }

        this._syncState = 'syncing';
        this._syncError = null;

        try {
            await pbService.writeAppState(this.getAppData(), 2);
            this._syncState = 'success';
            this._lastSynced = new Date().toISOString();
            setTimeout(() => {
                if (this._syncState === 'success') this._syncState = 'idle';
            }, 2000);
        } catch (e: any) {
            this._syncState = 'error';
            this._syncError = e?.message ?? String(e);
        }
    }

    private saveLocal() {
        if (typeof localStorage === 'undefined') return;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.getAppData()));
        } catch (e) {
            console.error('Failed to save app data locally:', e);
        }
    }

    private loadLocal() {
        if (typeof localStorage === 'undefined') return;

        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;

            const data: AppData = JSON.parse(raw);
            this.applyAppData(data);
        } catch (e) {
            console.error('Failed to load app data locally:', e);
        }
    }

    async syncFromCloud(): Promise<boolean> {
        if (DISABLE_CLOUD_SYNC || !pbService.isConfigured) {
            this._syncState = 'idle';
            this._syncError = null;
            return false;
        }

        this._syncState = 'syncing';
        this._syncError = null;

        try {
            const state = await pbService.readAppState<AppData>();

            if (state?.data) {
                this.applyAppData(state.data);
                this.saveLocal();
                this._syncState = 'success';
                this._lastSynced = new Date().toISOString();
                setTimeout(() => {
                    if (this._syncState === 'success') this._syncState = 'idle';
                }, 2000);
                return true;
            }

            this._syncState = 'idle';
            return false;
        } catch (e: any) {
            this._syncState = 'error';
            this._syncError = e?.message ?? String(e);
            return false;
        }
    }

    // Debounced save - saves locally immediately, syncs to cloud after delay
    save() {
        this.saveLocal();

        // Debounce cloud sync to avoid too many API calls
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }

        if (pbService.isConfigured) {
            this._saveTimeout = setTimeout(() => {
                this.syncToCloud();
            }, 1000);
        }
    }

    // Force immediate sync to cloud
    async forceSyncToCloud() {
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
            this._saveTimeout = null;
        }
        await this.syncToCloud();
    }

    clear() {
        this._weeks = [];
        this._categories = [];
        this._commonTransactions = [];
        this._activeWeekId = null;
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
        }
        // Also clear cloud data
        if (pbService.isConfigured) {
            this.syncToCloud();
        }
    }

    // Export/Import for backup
    export(): string {
        return JSON.stringify(this.getAppData(), null, 2);
    }

    import(jsonString: string): boolean {
        try {
            const data: AppData = JSON.parse(jsonString);
            this._weeks = data.weeks.map(w => Week.fromJSON(w));
            this._categories = (data.categories || []).map(c => Category.fromJSON(c));
            this._commonTransactions = (data.commonTransactions || []).map(ct => CommonTransaction.fromJSON(ct));
            this._activeWeekId = data.activeWeekId;
            this.save();
            return true;
        } catch (e) {
            console.error('Failed to import data:', e);
            return false;
        }
    }
}

// Singleton instance
export const appStore = new AppStore();
