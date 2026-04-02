import { vi } from "vitest";
import { TgcClient } from "../../src/client/tgc-client.js";
import { TgcError } from "../../src/types/errors.js";
import { mockConfig, mockFetchResponse } from "../helpers/mocks.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("fake-image-data")),
}));

let mockFetch: ReturnType<typeof vi.fn>;
let client: TgcClient;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
  vi.useFakeTimers();
  client = new TgcClient(mockConfig());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("authenticate", () => {
  it("POSTs to /session with config credentials and stores session", async () => {
    mockFetch.mockResolvedValue(
      mockFetchResponse(200, { result: { id: "sess-1", user_id: "user-1" } }),
    );
    const session = await client.authenticate();
    expect(session.id).toBe("sess-1");
    expect(client.session.isActive).toBe(true);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/session");
    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body as string);
    expect(body.api_key_id).toBe("test-api-key");
    expect(body.username).toBe("testuser");
    expect(body.password).toBe("testpass");
  });

  it("does not include session_id in query params", async () => {
    mockFetch.mockResolvedValue(
      mockFetchResponse(200, { result: { id: "sess-1", user_id: "user-1" } }),
    );
    await client.authenticate();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).not.toContain("session_id");
  });

  it("uses override credentials when all three provided", async () => {
    mockFetch.mockResolvedValue(
      mockFetchResponse(200, { result: { id: "sess-2", user_id: "user-2" } }),
    );
    const session = await client.authenticate({
      apiKeyId: "override-key",
      username: "override-user",
      password: "override-pass",
    });
    expect(session.id).toBe("sess-2");
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.api_key_id).toBe("override-key");
    expect(body.username).toBe("override-user");
    expect(body.password).toBe("override-pass");
  });

  it("throws when only partial overrides provided", async () => {
    await expect(
      client.authenticate({ apiKeyId: "key-only" }),
    ).rejects.toThrow("Partial credentials");
  });

  it("throws when no config and no overrides", async () => {
    const emptyClient = new TgcClient({
      apiBase: "https://www.thegamecrafter.com/api",
    });
    await expect(emptyClient.authenticate()).rejects.toThrow(
      "No TGC credentials available",
    );
  });
});

describe("logout", () => {
  it("DELETEs /session/{id} and clears session", async () => {
    // First authenticate
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "sess-1", user_id: "user-1" } }),
    );
    await client.authenticate();

    // Then logout
    mockFetch.mockResolvedValueOnce(mockFetchResponse(200, { result: {} }));
    await client.logout();
    expect(client.session.isActive).toBe(false);

    const url = mockFetch.mock.calls[1][0] as string;
    expect(url).toContain("/session/sess-1");
    expect((mockFetch.mock.calls[1][1] as RequestInit).method).toBe("DELETE");
  });

  it("throws when no active session", async () => {
    await expect(client.logout()).rejects.toThrow(TgcError);
  });
});

describe("getProducts", () => {
  it("GETs /tgc/products and returns array", async () => {
    const products = [{ identity: "PokerDeck", name: "Poker Deck", categories: ["Cards"] }];
    mockFetch.mockResolvedValue(mockFetchResponse(200, { result: products }));
    const result = await client.getProducts();
    expect(result).toEqual(products);
    expect((mockFetch.mock.calls[0][0] as string)).toContain("/tgc/products");
  });

  it("filters by category client-side (case-insensitive)", async () => {
    const products = [
      { identity: "PokerDeck", name: "Poker", categories: ["Cards", "Traditional"] },
      { identity: "SmallBox", name: "Box", categories: ["Packaging"] },
    ];
    mockFetch.mockResolvedValue(mockFetchResponse(200, { result: products }));
    const result = await client.getProducts("cards");
    expect(result).toHaveLength(1);
    expect(result[0].identity).toBe("PokerDeck");
  });

  it("does not require authentication", async () => {
    mockFetch.mockResolvedValue(mockFetchResponse(200, { result: [] }));
    await client.getProducts();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).not.toContain("session_id");
  });
});

describe("getGames", () => {
  beforeEach(async () => {
    // Authenticate first
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "sess-1", user_id: "u-1" } }),
    );
    await client.authenticate();
  });

  it("GETs /designer/{id}/games with session_id", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { items: [], paging: {} } }),
    );
    await client.getGames("d-1");
    const url = mockFetch.mock.calls[1][0] as string;
    expect(url).toContain("/designer/d-1/games");
    expect(url).toContain("session_id=sess-1");
  });

  it("passes _page_number when page provided", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { items: [], paging: {} } }),
    );
    await client.getGames("d-1", 3);
    const url = mockFetch.mock.calls[1][0] as string;
    expect(url).toContain("_page_number=3");
  });
});

describe("getGame", () => {
  it("includes _include_relationships=1", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "sess-1", user_id: "u-1" } }),
    );
    await client.authenticate();

    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "g-1", name: "Test" } }),
    );
    await client.getGame("g-1");
    const url = mockFetch.mock.calls[1][0] as string;
    expect(url).toContain("_include_relationships=1");
  });
});

describe("createGame", () => {
  beforeEach(async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "sess-1", user_id: "u-1" } }),
    );
    await client.authenticate();
  });

  it("POSTs to /game with name and designer_id", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "g-1", name: "New Game" } }),
    );
    await client.createGame("New Game", "d-1");
    const opts = mockFetch.mock.calls[1][1] as RequestInit;
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body as string);
    expect(body.name).toBe("New Game");
    expect(body.designer_id).toBe("d-1");
  });

  it("includes description when provided", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "g-1" } }),
    );
    await client.createGame("Game", "d-1", "A description");
    const body = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);
    expect(body.description).toBe("A description");
  });
});

describe("updateGame", () => {
  it("PUTs to /game/{id} with update fields", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "sess-1", user_id: "u-1" } }),
    );
    await client.authenticate();

    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "g-1", name: "Updated" } }),
    );
    await client.updateGame("g-1", { name: "Updated", is_public: true });
    const url = mockFetch.mock.calls[1][0] as string;
    expect(url).toContain("/game/g-1");
    const opts = mockFetch.mock.calls[1][1] as RequestInit;
    expect(opts.method).toBe("PUT");
    const body = JSON.parse(opts.body as string);
    expect(body.name).toBe("Updated");
    expect(body.is_public).toBe(true);
  });
});

describe("deleteGame", () => {
  it("DELETEs /game/{id}", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "sess-1", user_id: "u-1" } }),
    );
    await client.authenticate();

    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { success: 1 } }),
    );
    await client.deleteGame("g-1");
    const url = mockFetch.mock.calls[1][0] as string;
    expect(url).toContain("/game/g-1");
    expect((mockFetch.mock.calls[1][1] as RequestInit).method).toBe("DELETE");
  });
});

describe("createPrintableComponent", () => {
  it("POSTs to createApi path with identity and game_id", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "sess-1", user_id: "u-1" } }),
    );
    await client.authenticate();

    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "deck-1" } }),
    );
    await client.createPrintableComponent("/deck", "PokerDeck", "g-1", "Main Deck", 52);
    const url = mockFetch.mock.calls[1][0] as string;
    expect(url).toContain("/deck");
    const body = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);
    expect(body.identity).toBe("PokerDeck");
    expect(body.game_id).toBe("g-1");
    expect(body.name).toBe("Main Deck");
    expect(body.quantity).toBe(52);
  });
});

describe("error handling", () => {
  beforeEach(async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "sess-1", user_id: "u-1" } }),
    );
    await client.authenticate();
  });

  it("401 throws auth error and clears session", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(401, { error: { message: "Unauthorized" } }),
    );
    await expect(client.getGames("d-1")).rejects.toThrow(TgcError);
    try {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(401, { error: { message: "Unauthorized" } }),
      );
      await client.getGames("d-1");
    } catch (e) {
      expect((e as TgcError).category).toBe("auth");
    }
  });

  it("429 throws rate_limit error", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(429, { error: { message: "Too many requests" } }, { "retry-after": "30" }),
    );
    try {
      await client.getGames("d-1");
    } catch (e) {
      expect((e as TgcError).category).toBe("rate_limit");
      expect((e as TgcError).retryAfterSeconds).toBe(30);
    }
  });

  it("400 throws validation error", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(400, { error: { message: "Bad request" } }),
    );
    try {
      await client.getGames("d-1");
    } catch (e) {
      expect((e as TgcError).category).toBe("validation");
    }
  });
});

describe("retry logic", () => {
  beforeEach(async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "sess-1", user_id: "u-1" } }),
    );
    await client.authenticate();
  });

  it("retries on 500 and succeeds on later attempt", async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(500, { error: { message: "Server error" } }))
      .mockResolvedValueOnce(
        mockFetchResponse(200, { result: { items: [], paging: {} } }),
      );

    const promise = client.getGames("d-1");
    await vi.advanceTimersByTimeAsync(2000); // backoff
    const result = await promise;
    expect(result).toBeDefined();
    // fetch called: 1 auth + 2 getGames attempts (1 fail + 1 success)
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry on 400", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(400, { error: { message: "Bad request" } }),
    );
    await expect(client.getGames("d-1")).rejects.toThrow(TgcError);
    // 1 auth + 1 failed getGames (no retry)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("session injection", () => {
  it("authenticated request includes session_id", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "sess-1", user_id: "u-1" } }),
    );
    await client.authenticate();

    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { items: [], paging: {} } }),
    );
    await client.getGames("d-1");
    const url = mockFetch.mock.calls[1][0] as string;
    expect(url).toContain("session_id=sess-1");
  });

  it("requiresAuth: false omits session_id", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(200, { result: { id: "sess-1", user_id: "u-1" } }),
    );
    await client.authenticate();

    mockFetch.mockResolvedValueOnce(mockFetchResponse(200, { result: [] }));
    await client.getProducts();
    const url = mockFetch.mock.calls[1][0] as string;
    expect(url).not.toContain("session_id");
  });
});
