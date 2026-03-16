import {
  handleAddComponentToGame,
  handleGetComponentDetails,
} from "../../src/tools/components.js";
import { createMockClient, mockProduct, mockGamePart } from "../helpers/mocks.js";

describe("handleAddComponentToGame", () => {
  it("uses createPrintableComponent for catalog identity with create_api", async () => {
    const client = createMockClient();
    const product = mockProduct({ identity: "PokerDeck", create_api: "/api/deck" });
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([product]);
    (client.createPrintableComponent as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "deck-1",
      name: "Main Deck",
    });

    const handler = handleAddComponentToGame(client);
    const result = await handler({
      game_id: "game-1",
      part_id: "PokerDeck",
      quantity: 52,
      name: "Main Deck",
    });

    expect(client.createPrintableComponent).toHaveBeenCalledWith(
      "/deck", // /api prefix stripped
      "PokerDeck",
      "game-1",
      "Main Deck",
      52,
    );
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Poker Deck");
    expect(text).toContain("added to game successfully");
  });

  it("falls back to addGamePart for unknown part_id", async () => {
    const client = createMockClient();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([mockProduct()]);
    (client.addGamePart as ReturnType<typeof vi.fn>).mockResolvedValue(mockGamePart());

    const handler = handleAddComponentToGame(client);
    await handler({
      game_id: "game-1",
      part_id: "some-uuid-part",
      quantity: 3,
    });

    expect(client.addGamePart).toHaveBeenCalledWith("game-1", "some-uuid-part", 3, undefined);
    expect(client.createPrintableComponent).not.toHaveBeenCalled();
  });

  it("falls back to addGamePart when catalog product has no create_api", async () => {
    const client = createMockClient();
    const product = mockProduct({ identity: "CustomPart", create_api: undefined });
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([product]);
    (client.addGamePart as ReturnType<typeof vi.fn>).mockResolvedValue(mockGamePart());

    const handler = handleAddComponentToGame(client);
    await handler({ game_id: "game-1", part_id: "CustomPart", quantity: 1 });

    expect(client.addGamePart).toHaveBeenCalled();
  });

  it("returns success content with JSON", async () => {
    const client = createMockClient();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (client.addGamePart as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockGamePart({ id: "gp-99" }),
    );

    const handler = handleAddComponentToGame(client);
    const result = await handler({ game_id: "g-1", part_id: "p-1", quantity: 1 });

    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toHaveProperty("type", "text");
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("gp-99");
  });
});

describe("handleGetComponentDetails", () => {
  it("returns catalog product when identity matches", async () => {
    const client = createMockClient();
    const product = mockProduct({ identity: "PokerDeck" });
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([product]);

    const handler = handleGetComponentDetails(client);
    const result = await handler({ part_id: "PokerDeck" });

    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.identity).toBe("PokerDeck");
    expect(client.getPart).not.toHaveBeenCalled();
  });

  it("falls back to getPart for UUID", async () => {
    const client = createMockClient();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([mockProduct()]);
    (client.getPart as ReturnType<typeof vi.fn>).mockResolvedValue({
      identity: "part-uuid",
      name: "Some Part",
    });

    const handler = handleGetComponentDetails(client);
    const result = await handler({ part_id: "some-uuid-id" });

    expect(client.getPart).toHaveBeenCalledWith("some-uuid-id");
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.identity).toBe("part-uuid");
  });
});
