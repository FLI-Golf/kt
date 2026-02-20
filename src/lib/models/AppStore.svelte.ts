import { Month, type MonthData, DEFAULT_YEAR, SUPPORTED_YEARS } from './Month.svelte';
import { Category, type CategoryData, DEFAULT_CATEGORIES } from './Category.svelte';
import { CommonTransaction, type CommonTransactionData } from './CommonTransaction.svelte';
import { pbService } from '$lib/services';

const STORAGE_KEY = 'kt_app_data';
const DISABLE_CLOUD_SYNC =
  (import.meta as any).env?.VITE_DISABLE_CLOUD_SYNC === 'true';

interface AppData {
    months: MonthData[];
    categories: CategoryData[];
    commonTransactions: CommonTransactionData[];
    activeMonthId: string | null;
    version: number;
}

// Support loading legacy data that used "weeks"
interface LegacyAppData {
    weeks?: any[];
    activeWeekId?: string | null;
}

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export class AppStore {
    private _months = $state<Month[]>([]);
    private _categories = $state<Category[]>([]);
    private _commonTransactions = $state<CommonTransaction[]>([]);
    private _activeMonthId = $state<string | null>(null);
    private _initialized = $state(false);
    private _syncState = $state<SyncState>('idle');
    private _syncError = $state<string | null>(null);
    private _lastSynced = $state<string | null>(null);
    private _saveTimeout: ReturnType<typeof setTimeout> | null = null;

    get months() { return this._months; }
    get categories() { return this._categories; }
    get commonTransactions() { return this._commonTransactions; }
    get activeMonthId() { return this._activeMonthId; }
    get initialized() { return this._initialized; }
    get syncState() { return this._syncState; }
    get syncError() { return this._syncError; }
    get lastSynced() { return this._lastSynced; }
    get isCloudEnabled() {
        return !DISABLE_CLOUD_SYNC && pbService.isConfigured;
    }

    get activeMonth(): Month | undefined {
        if (!this._activeMonthId) return undefined;
        return this._months.find(m => m.id === this._activeMonthId);
    }

    get activeMonths() {
        return this._months.filter(m => m.active);
    }

    get inactiveMonths() {
        return this._months.filter(m => !m.active);
    }

    get monthCount() { return this._months.length; }
    get categoryCount() { return this._categories.length; }
    get commonTransactionCount() { return this._commonTransactions.length; }

    get parentCategories() {
        return this._categories.filter(c => c.parent_id === null);
    }

    getChildCategories(parentId: string) {
        return this._categories.filter(c => c.parent_id === parentId);
    }

    getCategory(id: string): Category | undefined {
        return this._categories.find(c => c.id === id);
    }

    getCategoryFullName(id: string): string {
        const category = this.getCategory(id);
        if (!category) return '';
        if (category.parent_id) {
            const parent = this.getCategory(category.parent_id);
            if (parent) return `${parent.name} > ${category.name}`;
        }
        return category.name;
    }

    // Initialization
    async init() {
        if (this._initialized) return;
        this.loadLocal();
        if (this._categories.length === 0) {
            this.initializeDefaultCategories();
        }
        this._initialized = true;

        if (!DISABLE_CLOUD_SYNC && pbService.isConfigured) {
            await this.syncFromCloud();
        } else {
            this._syncState = 'idle';
            this._syncError = null;
        }
    }

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
        const children = this.getChildCategories(id);
        for (const child of children) {
            const childIndex = this._categories.findIndex(c => c.id === child.id);
            if (childIndex !== -1) this._categories.splice(childIndex, 1);
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

    // Month Management
    createMonth(year: number = DEFAULT_YEAR, monthIndex: number = new Date().getMonth()): Month {
        const month = new Month(year, monthIndex);
        month.activate();
        this._months.push(month);
        this.save();
        return month;
    }

    deleteMonth(id: string): boolean {
        const index = this._months.findIndex(m => m.id === id);
        if (index !== -1) {
            this._months.splice(index, 1);
            if (this._activeMonthId === id) this._activeMonthId = null;
            this.save();
            return true;
        }
        return false;
    }

    getMonth(id: string): Month | undefined {
        return this._months.find(m => m.id === id);
    }

    setActiveMonth(id: string | null) {
        this._activeMonthId = id;
        this.save();
    }

    monthExists(year: number, monthIndex: number): boolean {
        return this._months.some(m => m.year === year && m.monthIndex === monthIndex);
    }

    createNextMonthFromClosed(closedMonthId: string): Month | undefined {
        const closedMonth = this.getMonth(closedMonthId);
        if (!closedMonth || !closedMonth.isClosed) return undefined;

        let nextYear = closedMonth.year;
        let nextMonthIndex = closedMonth.monthIndex + 1;
        if (nextMonthIndex > 11) {
            nextMonthIndex = 0;
            nextYear++;
        }
        if (!SUPPORTED_YEARS.includes(nextYear as any)) return undefined;
        if (this.monthExists(nextYear, nextMonthIndex)) return undefined;

        const newMonth = this.createMonth(nextYear, nextMonthIndex);
        newMonth.previous_month_id = closedMonth.id;
        closedMonth.next_month_id = newMonth.id;
        newMonth.calculateTotals();
        this.save();
        return newMonth;
    }

    getExpenseSummary(): {
        totalExpenses: number;
        totalPaid: number;
        totalUnpaid: number;
        byCategory: Map<string, number>;
    } {
        let totalExpenses = 0;
        let totalPaid = 0;
        const byCategory = new Map<string, number>();

        for (const month of this._months) {
            totalExpenses += month.total_amount;
            totalPaid += month.total_paid;
            const monthCategories = month.getTotalsByCategory();
            for (const [catId, amount] of monthCategories) {
                const current = byCategory.get(catId) || 0;
                byCategory.set(catId, current + amount);
            }
        }

        return { totalExpenses, totalPaid, totalUnpaid: totalExpenses - totalPaid, byCategory };
    }

    // Persistence
    private getAppData(): AppData {
        return {
            months: this._months.map(m => m.toJSON()),
            categories: this._categories.map(c => c.toJSON()),
            commonTransactions: this._commonTransactions.map(ct => ct.toJSON()),
            activeMonthId: this._activeMonthId,
            version: 3
        };
    }

    private applyAppData(data: AppData & Partial<LegacyAppData>) {
        const monthsRaw = data.months ?? data.weeks ?? [];
        this._months = monthsRaw.map((m: any) => Month.fromJSON(m));
        this._categories = (data.categories || []).map(c => Category.fromJSON(c));
        this._commonTransactions = (data.commonTransactions || []).map(ct => CommonTransaction.fromJSON(ct));
        this._activeMonthId = data.activeMonthId ?? data.activeWeekId ?? null;
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
            await pbService.writeAppState(this.getAppData(), 3);
            this._syncState = 'success';
            this._lastSynced = new Date().toISOString();
            setTimeout(() => { if (this._syncState === 'success') this._syncState = 'idle'; }, 2000);
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
            const data = JSON.parse(raw);
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
            const state = await pbService.readAppState<AppData & Partial<LegacyAppData>>();
            if (state?.data) {
                this.applyAppData(state.data);
                this.saveLocal();
                this._syncState = 'success';
                this._lastSynced = new Date().toISOString();
                setTimeout(() => { if (this._syncState === 'success') this._syncState = 'idle'; }, 2000);
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

    save() {
        this.saveLocal();
        if (this._saveTimeout) clearTimeout(this._saveTimeout);
        if (pbService.isConfigured) {
            this._saveTimeout = setTimeout(() => { this.syncToCloud(); }, 1000);
        }
    }

    async forceSyncToCloud() {
        if (this._saveTimeout) { clearTimeout(this._saveTimeout); this._saveTimeout = null; }
        await this.syncToCloud();
    }

    clear() {
        this._months = [];
        this._categories = [];
        this._commonTransactions = [];
        this._activeMonthId = null;
        if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
        if (pbService.isConfigured) this.syncToCloud();
    }

    export(): string {
        return JSON.stringify(this.getAppData(), null, 2);
    }

    import(jsonString: string): boolean {
        try {
            const data = JSON.parse(jsonString);
            this.applyAppData(data);
            this.save();
            return true;
        } catch (e) {
            console.error('Failed to import data:', e);
            return false;
        }
    }
}

export const appStore = new AppStore();
