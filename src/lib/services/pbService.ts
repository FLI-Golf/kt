import { pb } from "./pb";

export type WeekRecord = {
  id: string;
  name: string;
  start: string; // ISO date
  end: string;   // ISO date
  vig: number;
  isClosed: boolean;
  totals?: unknown;
  created?: string;
  updated?: string;
};

export type PlayerRecord = {
  id: string;
  week: string; // relation to weeks.id
  name: string;
  accountNumber?: string;
  amount: number;
  carry?: number;
  result?: number;
  notes?: string;
  created?: string;
  updated?: string;
};

export const pbService = {
  get isConfigured(): boolean {
    const pbUrl = import.meta.env.VITE_POCKETBASE_URL as string | undefined;
    return typeof pbUrl === "string" && pbUrl.length > 0;
  },

    // ---- generic helpers (match AppStore expectations) ----
  async update(collection: string, id: string, data: Record<string, any>) {
    return pb.collection(collection).update(id, data);
  },

  async create(collection: string, data: Record<string, any>) {
    return pb.collection(collection).create(data);
  },

  async upsert(collection: string, data: Record<string, any> & { id?: string }) {
    if (data.id) {
      const { id, ...rest } = data;
      return pb.collection(collection).update(id, rest);
    }
    return pb.collection(collection).create(data);
  },

  // ---- weeks ----
  async listWeeks(): Promise<WeekRecord[]> {
    return pb.collection("weeks").getFullList<WeekRecord>({
      sort: "-created",
    });
  },

  async createWeek(
    data: Omit<WeekRecord, "id" | "created" | "updated">
  ): Promise<WeekRecord> {
    return pb.collection("weeks").create<WeekRecord>(data);
  },

  async updateWeek(
    id: string,
    data: Partial<Omit<WeekRecord, "id">>
  ): Promise<WeekRecord> {
    return pb.collection("weeks").update<WeekRecord>(id, data);
  },

  async deleteWeek(id: string): Promise<boolean> {
    await pb.collection("weeks").delete(id);
    return true;
  },

  // ---- players ----
  async listPlayersForWeek(weekId: string): Promise<PlayerRecord[]> {
    return pb.collection("players").getFullList<PlayerRecord>({
      filter: `week = "${weekId}"`,
      sort: "name",
    });
  },

  async createPlayer(
    data: Omit<PlayerRecord, "id" | "created" | "updated">
  ): Promise<PlayerRecord> {
    return pb.collection("players").create<PlayerRecord>(data);
  },

  async updatePlayer(
    id: string,
    data: Partial<Omit<PlayerRecord, "id">>
  ): Promise<PlayerRecord> {
    return pb.collection("players").update<PlayerRecord>(id, data);
  },

  async deletePlayer(id: string): Promise<boolean> {
    await pb.collection("players").delete(id);
    return true;
  },
};
