import { vi } from "vitest";
import type { TgcClient } from "../../src/client/tgc-client.js";
import type { TgcConfig } from "../../src/config.js";
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
} from "../../src/types/tgc-api.js";

// --- Mock TgcClient ---

export function createMockClient() {
  return {
    session: {
      store: vi.fn(),
      get: vi.fn().mockReturnValue(null),
      getOrThrow: vi.fn(),
      clear: vi.fn(),
      isActive: false,
      sessionId: null,
    },
    authenticate: vi.fn(),
    logout: vi.fn(),
    getUser: vi.fn(),
    getDesigners: vi.fn(),
    getProducts: vi.fn(),
    getGames: vi.fn(),
    getGame: vi.fn(),
    createGame: vi.fn(),
    updateGame: vi.fn(),
    addGamePart: vi.fn(),
    createPrintableComponent: vi.fn(),
    getPart: vi.fn(),
    uploadFile: vi.fn(),
    uploadFileFromUrl: vi.fn(),
    uploadFileFromBuffer: vi.fn(),
    getGameLedgerEntries: vi.fn(),
    deleteGame: vi.fn(),
  } as unknown as TgcClient & { [K in keyof TgcClient]: ReturnType<typeof vi.fn> };
}

// --- Test Data Factories ---

export function mockSession(overrides?: Partial<TgcSession>): TgcSession {
  return { id: "sess-123", user_id: "user-456", ...overrides };
}

export function mockUser(overrides?: Partial<TgcUser>): TgcUser {
  return { id: "user-456", username: "testuser", display_name: "Test User", ...overrides };
}

export function mockDesigner(overrides?: Partial<TgcDesigner>): TgcDesigner {
  return { id: "designer-789", name: "Test Studio", user_id: "user-456", ...overrides };
}

export function mockGame(overrides?: Partial<TgcGame>): TgcGame {
  return {
    id: "game-001",
    name: "Test Game",
    designer_id: "designer-789",
    cost: "5.00",
    price: "5.00",
    price1: "5.00",
    price10: "4.50",
    price100: "4.00",
    price500: "3.50",
    price1000: "3.00",
    retail_price_each: 9.99,
    msrp: 9.99,
    designer_profit: 2.50,
    component_list: [],
    ...overrides,
  };
}

export function mockProduct(overrides?: Partial<TgcProduct>): TgcProduct {
  return {
    identity: "PokerDeck",
    name: "Poker Deck",
    categories: ["Cards", "Traditional"],
    create_api: "/api/deck",
    size: { pixels: [825, 1125], finished_inches: ["2.5", "3.5", 0.013] },
    ...overrides,
  };
}

export function mockGamePart(overrides?: Partial<TgcGamePart>): TgcGamePart {
  return { id: "gp-001", game_id: "game-001", part_id: "part-001", quantity: 1, ...overrides };
}

export function mockFile(overrides?: Partial<TgcFile>): TgcFile {
  return { id: "file-001", filename: "card.png", folder_id: "folder-001", ...overrides };
}

export function mockLedgerEntry(overrides?: Partial<TgcGameLedgerEntry>): TgcGameLedgerEntry {
  return { id: "le-001", game_id: "game-001", name: "Poker Deck", amount: 5.99, ...overrides };
}

export function mockPaginatedResponse<T>(items: T[], page = 1): TgcPaginatedResponse<T> {
  return {
    items,
    paging: {
      total_items: items.length,
      page_number: page,
      items_per_page: 25,
      total_pages: 1,
    },
  };
}

// --- Fetch Mock Helpers ---

export function mockFetchResponse(
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: statusText(status),
    headers: new Headers(headers),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  } as unknown as Response;
}

function statusText(code: number): string {
  const map: Record<number, string> = {
    200: "OK", 201: "Created", 400: "Bad Request",
    401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
    422: "Unprocessable Entity", 429: "Too Many Requests",
    500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable",
  };
  return map[code] ?? "Unknown";
}

// --- Config Factory ---

export function mockConfig(): TgcConfig {
  return {
    apiKeyId: "test-api-key",
    username: "testuser",
    password: "testpass",
    apiBase: "https://www.thegamecrafter.com/api",
  };
}
