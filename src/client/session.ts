import type { TgcSession } from "../types/tgc-api.js";
import { TgcError } from "../types/errors.js";

export class SessionManager {
  private session: TgcSession | null = null;

  store(session: TgcSession): void {
    this.session = session;
  }

  get(): TgcSession | null {
    return this.session;
  }

  getOrThrow(): TgcSession {
    if (!this.session) {
      throw new TgcError(
        "No active session.",
        "auth",
      );
    }
    return this.session;
  }

  clear(): void {
    this.session = null;
  }

  get isActive(): boolean {
    return this.session !== null;
  }

  get sessionId(): string | null {
    return this.session?.id ?? null;
  }
}
