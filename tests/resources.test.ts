import { vi } from "vitest";
import {
  registerCatalogResource,
  registerComponentSizesResource,
  registerGameSummaryResource,
} from "../src/resources.js";
import { createMockClient, mockProduct, mockGame } from "./helpers/mocks.js";

function createMockServer() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    registerResource: vi.fn(
      (
        name: string,
        _uriOrTemplate: unknown,
        _metadata: unknown,
        handler: (...args: unknown[]) => unknown,
      ) => {
        handlers.set(name, handler);
      },
    ),
    getHandler: (name: string) => handlers.get(name)!,
  };
}

describe("registerCatalogResource", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("fetches products on first call", async () => {
    const client = createMockClient();
    const server = createMockServer();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([mockProduct()]);

    registerCatalogResource(server as never, client);
    const handler = server.getHandler("catalog");
    const result = await handler() as { contents: Array<{ text: string }> };

    expect(client.getProducts).toHaveBeenCalledTimes(1);
    expect(result.contents[0].text).toContain("PokerDeck");
  });

  it("returns cached data within 30 minutes", async () => {
    const client = createMockClient();
    const server = createMockServer();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([mockProduct()]);

    registerCatalogResource(server as never, client);
    const handler = server.getHandler("catalog");

    await handler(); // first call fetches
    vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes
    await handler(); // second call within TTL

    expect(client.getProducts).toHaveBeenCalledTimes(1); // only fetched once
  });

  it("refetches after 30 minutes", async () => {
    const client = createMockClient();
    const server = createMockServer();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([mockProduct()]);

    registerCatalogResource(server as never, client);
    const handler = server.getHandler("catalog");

    await handler(); // first call
    vi.advanceTimersByTime(31 * 60 * 1000); // 31 minutes
    await handler(); // should refetch

    expect(client.getProducts).toHaveBeenCalledTimes(2);
  });
});

describe("registerComponentSizesResource", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("returns cached sizes within TTL", async () => {
    const client = createMockClient();
    const server = createMockServer();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([mockProduct()]);

    registerComponentSizesResource(server as never, client);
    const handler = server.getHandler("component_sizes");

    await handler();
    vi.advanceTimersByTime(5 * 60 * 1000);
    await handler();

    expect(client.getProducts).toHaveBeenCalledTimes(1);
  });

  it("returns correct size fields", async () => {
    const client = createMockClient();
    const server = createMockServer();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockProduct({ identity: "TestDeck", size: { pixels: [100, 200] } }),
    ]);

    registerComponentSizesResource(server as never, client);
    const handler = server.getHandler("component_sizes");
    const result = await handler() as { contents: Array<{ text: string }> };

    const sizes = JSON.parse(result.contents[0].text);
    expect(sizes[0].identity).toBe("TestDeck");
    expect(sizes[0].width_px).toBe(100);
    expect(sizes[0].height_px).toBe(200);
  });
});

describe("registerGameSummaryResource", () => {
  it("fetches game by ID (no caching)", async () => {
    const client = createMockClient();
    const server = createMockServer();
    (client.getGame as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockGame({ id: "g-1", name: "Test" }),
    );

    registerGameSummaryResource(server as never, client);
    const handler = server.getHandler("game_summary");

    // ResourceTemplate handler receives (uri, variables)
    const result = await handler(
      new URL("tgc://game/g-1/summary"),
      { id: "g-1" },
    ) as { contents: Array<{ text: string; uri: string }> };

    expect(client.getGame).toHaveBeenCalledWith("g-1");
    expect(result.contents[0].uri).toBe("tgc://game/g-1/summary");
    const parsed = JSON.parse(result.contents[0].text);
    expect(parsed.name).toBe("Test");
  });
});
