import { handleGetPricingEstimate } from "../../src/tools/pricing.js";
import { createMockClient, mockGame, mockLedgerEntry } from "../helpers/mocks.js";

describe("handleGetPricingEstimate", () => {
  it("returns ledger entries when available", async () => {
    const client = createMockClient();
    const entries = [mockLedgerEntry(), mockLedgerEntry({ id: "le-2", name: "Box" })];
    (client.getGameLedgerEntries as ReturnType<typeof vi.fn>).mockResolvedValue(entries);
    (client.getGame as ReturnType<typeof vi.fn>).mockResolvedValue(mockGame());

    const handler = handleGetPricingEstimate(client);
    const result = await handler({ game_id: "game-001" });

    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Ledger entries:");
    expect(text).toContain("le-2");
  });

  it("falls back to game pricing when no ledger entries", async () => {
    const client = createMockClient();
    (client.getGameLedgerEntries as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (client.getGame as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockGame({
        cost: "13.89",
        retail_price_each: 18.99,
        designer_profit: 3.57,
      }),
    );

    const handler = handleGetPricingEstimate(client);
    const result = await handler({ game_id: "game-001" });

    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Pricing summary from game details");
    const parsed = JSON.parse(text.split("\n\n")[1]);
    expect(parsed.cost).toBe("13.89");
    expect(parsed.retail_price_each).toBe(18.99);
    expect(parsed.designer_profit).toBe(3.57);
  });

  it("calls both endpoints in parallel", async () => {
    const client = createMockClient();
    (client.getGameLedgerEntries as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (client.getGame as ReturnType<typeof vi.fn>).mockResolvedValue(mockGame());

    const handler = handleGetPricingEstimate(client);
    await handler({ game_id: "game-001" });

    expect(client.getGameLedgerEntries).toHaveBeenCalledWith("game-001");
    expect(client.getGame).toHaveBeenCalledWith("game-001");
  });

  it("fallback includes all expected pricing fields", async () => {
    const client = createMockClient();
    (client.getGameLedgerEntries as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (client.getGame as ReturnType<typeof vi.fn>).mockResolvedValue(mockGame());

    const handler = handleGetPricingEstimate(client);
    const result = await handler({ game_id: "game-001" });

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text.split("\n\n")[1]);
    expect(parsed).toHaveProperty("game_id");
    expect(parsed).toHaveProperty("name");
    expect(parsed).toHaveProperty("cost");
    expect(parsed).toHaveProperty("retail_price_each");
    expect(parsed).toHaveProperty("msrp");
    expect(parsed).toHaveProperty("designer_profit");
    expect(parsed).toHaveProperty("component_list");
  });
});
