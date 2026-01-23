// src/lib/models/AuthStore.svelte.ts
import { pbService } from "$lib/services/pbService";

export type AuthState = "idle" | "authenticating" | "authenticated" | "error";

export class AuthStore {
  private _state = $state<AuthState>("idle");
  private _error = $state<string | null>(null);

  get state() {
    return this._state;
  }

  get error() {
    return this._error;
  }

  get isAuthed(): boolean {
    return pbService.isAuthed;
  }

  get userId(): string | null {
    return pbService.authedUserId;
  }

  async login(email: string, password: string) {
    this._state = "authenticating";
    this._error = null;

    try {
      await pbService.login(email, password);
      this._state = "authenticated";
      return true;
    } catch (e: any) {
      this._state = "error";
      this._error = e?.message ?? "Login failed";
      return false;
    }
  }

  logout() {
    pbService.logout();
    this._state = "idle";
  }

  async restoreSession(): Promise<boolean> {
    try {
      const ok = await pbService.refreshAuth();
      if (ok) {
        this._state = "authenticated";
        return true;
      }
    } catch {
      // ignore
    }
    this._state = "idle";
    return false;
  }
}

// singleton
export const authStore = new AuthStore();
