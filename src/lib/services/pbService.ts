import { pb } from "./pb";

export type AppStateRecord<T = any> = {
  id: string;
  data: T;
  version?: number;
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

  get isAuthed(): boolean {
    return pb.authStore.isValid;
  },

  get isReadonly(): boolean {
    return PB_READONLY;
  },

  async readAppState<T = any>(): Promise<AppStateRecord<T> | null> {
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
