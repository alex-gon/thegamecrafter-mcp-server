import {
  handleGetGameCatalog,
  handleGetComponentSizes,
} from "../../src/tools/catalog.js";
import { createMockClient, mockProduct } from "../helpers/mocks.js";

describe("handleGetGameCatalog", () => {
  it("calls getProducts with no args when no category", async () => {
    const client = createMockClient();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([mockProduct()]);
    const handler = handleGetGameCatalog(client);
    await handler({});
    expect(client.getProducts).toHaveBeenCalledWith(undefined);
  });

  it("passes category to getProducts", async () => {
    const client = createMockClient();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const handler = handleGetGameCatalog(client);
    await handler({ category: "cards" });
    expect(client.getProducts).toHaveBeenCalledWith("cards");
  });
});

describe("handleGetComponentSizes", () => {
  it("returns all products mapped to size fields when no part_id", async () => {
    const client = createMockClient();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockProduct(),
      mockProduct({ identity: "SmallBox", name: "Small Box", size: { pixels: [300, 400] } }),
    ]);
    const handler = handleGetComponentSizes(client);
    const result = await handler({});
    const sizes = JSON.parse((result.content[0] as { text: string }).text);
    expect(sizes).toHaveLength(2);
    expect(sizes[0].identity).toBe("PokerDeck");
    expect(sizes[0].width_px).toBe(825);
    expect(sizes[0].height_px).toBe(1125);
  });

  it("returns single item when part_id matches", async () => {
    const client = createMockClient();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockProduct(),
      mockProduct({ identity: "BridgeDeck", name: "Bridge Deck" }),
    ]);
    const handler = handleGetComponentSizes(client);
    const result = await handler({ part_id: "PokerDeck" });
    const sizes = JSON.parse((result.content[0] as { text: string }).text);
    expect(sizes).toHaveLength(1);
    expect(sizes[0].identity).toBe("PokerDeck");
  });

  it("returns isError when part_id not found", async () => {
    const client = createMockClient();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([mockProduct()]);
    const handler = handleGetComponentSizes(client);
    const result = await handler({ part_id: "NonExistent" });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("NonExistent");
  });

  it("returns null for missing size data", async () => {
    const client = createMockClient();
    (client.getProducts as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockProduct({ size: undefined }),
    ]);
    const handler = handleGetComponentSizes(client);
    const result = await handler({});
    const sizes = JSON.parse((result.content[0] as { text: string }).text);
    expect(sizes[0].width_px).toBeNull();
    expect(sizes[0].height_px).toBeNull();
    expect(sizes[0].finished_inches).toBeNull();
  });
});
