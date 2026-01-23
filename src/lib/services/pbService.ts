
import { pb } from "./pb";

export type WeekRecord = {
  id: string;
  name: string;
  start: string;
  end: string;
  vig?: number;
  created?: string;
  updated?: string;
};

export type PlayerRecord = {
  id: string;
  name: string;
  account_number: number;
  active?: boolean;
  created?: string;
  updated?: string;
};

export type AppStateRecord<T = any> = {
  id: string;
  data: T;
  version?: number;
  created?: string;
  updated?: string;
};

export type WeekPlayerRecord = {
  id: string;
  week: string;
  player: string;
  amount_in?: number;
  result?: number;
  carry_amount?: number;
  source_week_id?: string;
  notes?: string;
  expand?: {
    player?: PlayerRecord;
  };
  created?: string;
  updated?: string;
};

const DISABLE_CLOUD_SYNC = import.meta.env.VITE_DISABLE_CLOUD_SYNC === "true";
const PB_READONLY = import.meta.env.VITE_PB_READONLY === "true";

export const pbService = {
  get isConfigured(): boolean {
    const pbUrl = import.meta.env.VITE_POCKETBASE_URL as string | undefined;
    return !DISABLE_CLOUD_SYNC && typeof pbUrl === "string" && pbUrl.length > 0;
  },

  get isReadonly(): boolean {
    return PB_READONLY;
  },

  // ---- generic helpers ----
  async update(collection: string, id: string, data: Record<string, any>) {
    if (PB_READONLY) throw new Error("READONLY mode enabled");
    return pb.collection(collection).update(id, data);
  },

  async create(collection: string, data: Record<string, any>) {
    if (PB_READONLY) throw new Error("READONLY mode enabled");
    return pb.collection(collection).create(data);
  },

  async upsert(collection: string, data: Record<string, any> & { id?: string }) {
    if (PB_READONLY) throw new Error("READONLY mode enabled");
    if (data.id) {
      const { id, ...rest } = data;
      return pb.collection(collection).update(id, rest);
    }
    return pb.collection(collection).create(data);
  },

  // ---- week ----
  async listWeeks(): Promise<WeekRecord[]> {
    return pb.collection("week").getFullList<WeekRecord>({ sort: "-start" });
  },

  async createWeek(data: Omit<WeekRecord, "id" | "created" | "updated">): Promise<WeekRecord> {
    if (PB_READONLY) throw new Error("READONLY mode enabled");
    return pb.collection("week").create<WeekRecord>(data);
  },

  async updateWeek(id: string, data: Partial<Omit<WeekRecord, "id">>): Promise<WeekRecord> {
    if (PB_READONLY) throw new Error("READONLY mode enabled");
    return pb.collection("week").update<WeekRecord>(id, data);
  },

  async deleteWeek(id: string): Promise<boolean> {
    if (PB_READONLY) throw new Error("READONLY mode enabled");
    await pb.collection("week").delete(id);
    return true;
  },

  // ---- player ----
  async listPlayers(): Promise<PlayerRecord[]> {
    return pb.collection("player").getFullList<PlayerRecord>({ sort: "name" });
  },

  async createPlayer(data: Omit<PlayerRecord, "id" | "created" | "updated">): Promise<PlayerRecord> {
    if (PB_READONLY) throw new Error("READONLY mode enabled");
    return pb.collection("player").create<PlayerRecord>(data);
  },

  async updatePlayer(id: string, data: Partial<Omit<PlayerRecord, "id">>): Promise<PlayerRecord> {
    if (PB_READONLY) throw new Error("READONLY mode enabled");
    return pb.collection("player").update<PlayerRecord>(id, data);
  },

  async deletePlayer(id: string): Promise<boolean> {
    if (PB_READONLY) throw new Error("READONLY mode enabled");
    await pb.collection("player").delete(id);
    return true;
  },

  // ---- week_player ----
  async listWeekPlayers(weekId: string): Promise<WeekPlayerRecord[]> {
    return pb.collection("week_player").getFullList<WeekPlayerRecord>({
      filter: `week = "${weekId}"`,
      expand: "player",
      sort: "created",
    });
  },

  async createWeekPlayer(
    data: Omit<WeekPlayerRecord, "id" | "created" | "updated" | "expand">
  ): Promise<WeekPlayerRecord> {
    if (PB_READONLY) throw new Error("READONLY mode enabled");
    return pb.collection("week_player").create<WeekPlayerRecord>(data);
  },

  async updateWeekPlayer(
    id: string,
    data: Partial<Omit<WeekPlayerRecord, "id" | "created" | "updated" | "expand">>
  ): Promise<WeekPlayerRecord> {
    if (PB_READONLY) throw new Error("READONLY mode enabled");
    return pb.collection("week_player").update<WeekPlayerRecord>(id, data);
  },

  async deleteWeekPlayer(id: string): Promise<boolean> {
    if (PB_READONLY) throw new Error("READONLY mode enabled");
    await pb.collection("week_player").delete(id);
    return true;
  },
  
    // ---- app_state (blob sync) ----
  async readAppState<T = any>(): Promise<AppStateRecord<T> | null> {
    // If cloud sync is disabled, behave like "no cloud data"
    if (!this.isConfigured) return null;

    const list = await pb.collection("app_state").getFullList<AppStateRecord<T>>({
      sort: "-updated",
      perPage: 1,
    });

    return list[0] ?? null;
  },

  async writeAppState<T = any>(data: T, version: number = 1): Promise<AppStateRecord<T>> {
    if (PB_READONLY) throw new Error("READONLY mode enabled");
    if (!this.isConfigured) throw new Error("PocketBase not configured");

    const existing = await this.readAppState<T>();

    if (existing) {
      return pb.collection("app_state").update<AppStateRecord<T>>(existing.id, { data, version });
    }

    return pb.collection("app_state").create<AppStateRecord<T>>({ data, version });
  },

};
