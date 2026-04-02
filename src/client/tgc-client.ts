import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { TgcConfig } from "../config.js";
import type {
  TgcSession,
  TgcUser,
  TgcDesigner,
  TgcGame,
  TgcGamePart,
  TgcProduct,
  TgcFile,
  TgcGameLedgerEntry,
  TgcPaginatedResponse,
} from "../types/tgc-api.js";
// Note: /tgc/products returns a flat TgcProduct[], not TgcPaginatedResponse.
import { TgcError } from "../types/errors.js";
import { RateLimiter } from "./rate-limiter.js";
import { RequestBudget } from "./request-budget.js";
import { SessionManager } from "./session.js";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

function getMimeType(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  const ext = filename.slice(dot).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 && status <= 504;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TgcClient {
  public readonly session: SessionManager;
  private readonly rateLimiter: RateLimiter;
  private readonly budget: RequestBudget;

  constructor(private readonly config: TgcConfig) {
    this.session = new SessionManager();
    this.rateLimiter = new RateLimiter({
      maxTokens: 180,
      refillRatePerSecond: 3,
    });
    this.budget = new RequestBudget();
  }

  // --- Core HTTP methods ---

  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, string>;
      body?: Record<string, unknown>;
      formData?: FormData;
      requiresAuth?: boolean;
    } = {},
  ): Promise<T> {
    const url = new URL(`${this.config.apiBase}${path}`);

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.set(key, value);
      }
    }

    if (options.requiresAuth !== false) {
      const sessionId = this.session.sessionId;
      if (sessionId) {
        url.searchParams.set("session_id", sessionId);
      }
    }

    const fetchOptions: RequestInit = { method };

    if (options.formData) {
      fetchOptions.body = options.formData;
    } else if (options.body) {
      fetchOptions.headers = { "Content-Type": "application/json" };
      fetchOptions.body = JSON.stringify(options.body);
    }

    this.budget.check(method);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.rateLimiter.acquire();

      let response: Response;
      try {
        response = await fetch(url.toString(), fetchOptions);
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          console.error(
            `Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`,
          );
          await sleep(delay);
          continue;
        }
        throw new TgcError(
          err instanceof Error ? err.message : String(err),
          "network",
        );
      }

      if (!response.ok) {
        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          console.error(
            `TGC API returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`,
          );
          await sleep(delay);
          continue;
        }

        try {
          await this.handleHttpError(response);
        } catch (error) {
          if (
            error instanceof TgcError &&
            error.category === "auth" &&
            this.session.isActive
          ) {
            this.session.clear();
            throw new TgcError(
              "Session has expired. Please call the `authenticate` tool to create a new session.",
              "auth",
              error.statusCode,
            );
          }
          throw error;
        }
      }

      return (await response.json()) as T;
    }

    throw new TgcError("Max retries exceeded", "network");
  }

  private async handleHttpError(response: Response): Promise<never> {
    let message: string;
    try {
      const body = await response.json();
      message =
        (body as { error?: { message?: string } }).error?.message ??
        JSON.stringify(body);
    } catch {
      message = response.statusText;
    }

    if (response.status === 401 || response.status === 403) {
      throw new TgcError(message, "auth", response.status);
    }

    if (response.status === 429) {
      const retryAfter = parseInt(
        response.headers.get("retry-after") ?? "15",
        10,
      );
      this.rateLimiter.drain(retryAfter);
      throw new TgcError(
        `Rate limit exceeded: ${message}`,
        "rate_limit",
        429,
        retryAfter,
      );
    }

    if (response.status === 400 || response.status === 422) {
      throw new TgcError(message, "validation", response.status);
    }

    throw new TgcError(message, "tgc_api", response.status);
  }

  // --- Typed API methods ---

  async authenticate(overrides?: {
    apiKeyId?: string;
    username?: string;
    password?: string;
  }): Promise<TgcSession> {
    let apiKeyId: string | undefined;
    let username: string | undefined;
    let password: string | undefined;

    const hasAnyOverride =
      overrides?.apiKeyId || overrides?.username || overrides?.password;

    if (hasAnyOverride) {
      if (!overrides?.apiKeyId || !overrides?.username || !overrides?.password) {
        throw new TgcError(
          "Partial credentials provided. You must provide all three: api_key_id, username, and password.",
          "auth",
        );
      }
      apiKeyId = overrides.apiKeyId;
      username = overrides.username;
      password = overrides.password;
    } else {
      apiKeyId = this.config.apiKeyId;
      username = this.config.username;
      password = this.config.password;
      if (!apiKeyId || !username || !password) {
        throw new TgcError(
          "No TGC credentials available. Provide api_key_id, username, and password parameters, or set TGC_API_KEY_ID, TGC_USERNAME, and TGC_PASSWORD environment variables.",
          "auth",
        );
      }
    }

    const result = await this.request<{ result: TgcSession }>(
      "POST",
      "/session",
      {
        body: { api_key_id: apiKeyId, username, password },
        requiresAuth: false,
      },
    );
    this.session.store(result.result);
    this.budget.reset();
    return result.result;
  }

  async logout(): Promise<void> {
    const session = this.session.getOrThrow();
    await this.request("DELETE", `/session/${session.id}`);
    this.session.clear();
  }

  async getUser(userId: string): Promise<TgcUser> {
    const result = await this.request<{ result: TgcUser }>(
      "GET",
      `/user/${userId}`,
    );
    return result.result;
  }

  async getDesigners(): Promise<TgcDesigner[]> {
    const session = this.session.getOrThrow();
    const user = await this.getUser(session.user_id);
    const result = await this.request<{ result: { items: TgcDesigner[] } }>(
      "GET",
      `/user/${user.id}/designers`,
    );
    return result.result.items;
  }

  async getProducts(category?: string): Promise<TgcProduct[]> {
    const result = await this.request<{ result: TgcProduct[] }>(
      "GET",
      "/tgc/products",
      { requiresAuth: false },
    );
    if (category) {
      const lower = category.toLowerCase();
      return result.result.filter((p) =>
        p.categories?.some((c) => c.toLowerCase() === lower),
      );
    }
    return result.result;
  }

  async getGames(
    designerId: string,
    page?: number,
  ): Promise<TgcPaginatedResponse<TgcGame>> {
    const params: Record<string, string> = {};
    if (page) {
      params._page_number = String(page);
    }
    const result = await this.request<{
      result: TgcPaginatedResponse<TgcGame>;
    }>("GET", `/designer/${designerId}/games`, { params });
    return result.result;
  }

  async getGame(gameId: string): Promise<TgcGame> {
    const result = await this.request<{ result: TgcGame }>(
      "GET",
      `/game/${gameId}`,
      {
        params: { _include_relationships: "1" },
      },
    );
    return result.result;
  }

  async createGame(
    name: string,
    designerId: string,
    description?: string,
  ): Promise<TgcGame> {
    const body: Record<string, unknown> = {
      name,
      designer_id: designerId,
    };
    if (description) {
      body.description = description;
    }
    const result = await this.request<{ result: TgcGame }>(
      "POST",
      "/game",
      { body },
    );
    return result.result;
  }

  async updateGame(
    gameId: string,
    updates: { name?: string; description?: string; is_public?: boolean },
  ): Promise<TgcGame> {
    const body: Record<string, unknown> = {};
    if (updates.name !== undefined) body.name = updates.name;
    if (updates.description !== undefined)
      body.description = updates.description;
    if (updates.is_public !== undefined) body.is_public = updates.is_public;
    const result = await this.request<{ result: TgcGame }>(
      "PUT",
      `/game/${gameId}`,
      { body },
    );
    return result.result;
  }

  async deleteGame(gameId: string): Promise<void> {
    await this.request("DELETE", `/game/${gameId}`);
  }

  async addGamePart(
    gameId: string,
    partId: string,
    quantity: number,
    name?: string,
  ): Promise<TgcGamePart> {
    const body: Record<string, unknown> = {
      game_id: gameId,
      part_id: partId,
      quantity,
    };
    if (name) {
      body.name = name;
    }
    const result = await this.request<{ result: TgcGamePart }>(
      "POST",
      "/gamepart",
      { body },
    );
    return result.result;
  }

  async createPrintableComponent(
    createApi: string,
    identity: string,
    gameId: string,
    name?: string,
    quantity?: number,
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {
      game_id: gameId,
      identity,
    };
    if (name) body.name = name;
    if (quantity !== undefined) body.quantity = quantity;
    const result = await this.request<{ result: Record<string, unknown> }>(
      "POST",
      createApi,
      { body },
    );
    return result.result;
  }

  async getPart(partId: string): Promise<TgcProduct> {
    const result = await this.request<{ result: TgcProduct }>(
      "GET",
      `/part/${partId}`,
      { requiresAuth: false },
    );
    return result.result;
  }

  async uploadFile(
    folderId: string,
    filePath: string,
    filename?: string,
  ): Promise<TgcFile> {
    const fileBuffer = await readFile(filePath);
    const resolvedFilename = filename ?? basename(filePath);
    const blob = new Blob([fileBuffer], { type: getMimeType(resolvedFilename) });

    const formData = new FormData();
    formData.set("folder_id", folderId);
    formData.set("file", blob, resolvedFilename);
    const sessionId = this.session.getOrThrow().id;
    formData.set("session_id", sessionId);

    const result = await this.request<{ result: TgcFile }>(
      "POST",
      "/file",
      { formData, requiresAuth: false },
    );
    return result.result;
  }

  async uploadFileFromUrl(
    folderId: string,
    url: string,
    filename: string,
  ): Promise<TgcFile> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new TgcError(
        `Failed to download file from URL: ${err instanceof Error ? err.message : String(err)}`,
        "validation",
      );
    }
    if (!response.ok) {
      throw new TgcError(
        `Failed to download file from URL: ${response.status} ${response.statusText}`,
        "validation",
      );
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 50 * 1024 * 1024) {
      throw new TgcError(
        `File from URL is too large (${(parseInt(contentLength, 10) / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 50 MB.`,
        "validation",
      );
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 50 * 1024 * 1024) {
      throw new TgcError(
        `Downloaded file is too large (${(buffer.byteLength / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 50 MB.`,
        "validation",
      );
    }
    const blob = new Blob([buffer], { type: getMimeType(filename) });

    const formData = new FormData();
    formData.set("folder_id", folderId);
    formData.set("file", blob, filename);
    const sessionId = this.session.getOrThrow().id;
    formData.set("session_id", sessionId);

    const result = await this.request<{ result: TgcFile }>(
      "POST",
      "/file",
      { formData, requiresAuth: false },
    );
    return result.result;
  }

  async uploadFileFromBuffer(
    folderId: string,
    buffer: Uint8Array<ArrayBuffer>,
    filename: string,
  ): Promise<TgcFile> {
    const blob = new Blob([buffer], { type: getMimeType(filename) });

    const formData = new FormData();
    formData.set("folder_id", folderId);
    formData.set("file", blob, filename);
    const sessionId = this.session.getOrThrow().id;
    formData.set("session_id", sessionId);

    const result = await this.request<{ result: TgcFile }>(
      "POST",
      "/file",
      { formData, requiresAuth: false },
    );
    return result.result;
  }

  async getGameLedgerEntries(
    gameId: string,
  ): Promise<TgcGameLedgerEntry[]> {
    const result = await this.request<{
      result: { items: TgcGameLedgerEntry[] };
    }>("GET", `/game/${gameId}/gameledgerentries`);
    return result.result.items;
  }
}
