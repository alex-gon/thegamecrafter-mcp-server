import {
  handleGetMyGames,
  handleGetGameDetails,
  handleCreateGame,
  handleUpdateGame,
  handleDeleteGame,
} from "../../src/tools/games.js";
import {
  createMockClient,
  mockGame,
  mockPaginatedResponse,
} from "../helpers/mocks.js";

describe("handleGetMyGames", () => {
  it("calls getGames with designer_id and page", async () => {
    const client = createMockClient();
    (client.getGames as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPaginatedResponse([mockGame()]),
    );
    const handler = handleGetMyGames(client);
    await handler({ designer_id: "d-1", page_number: 2 });
    expect(client.getGames).toHaveBeenCalledWith("d-1", 2);
  });
});

describe("handleGetGameDetails", () => {
  it("calls getGame with game_id and returns JSON", async () => {
    const client = createMockClient();
    (client.getGame as ReturnType<typeof vi.fn>).mockResolvedValue(mockGame());
    const handler = handleGetGameDetails(client);
    const result = await handler({ game_id: "game-001" });
    expect(client.getGame).toHaveBeenCalledWith("game-001");
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.id).toBe("game-001");
  });
});

describe("handleCreateGame", () => {
  it("creates game and returns success message with name", async () => {
    const client = createMockClient();
    (client.createGame as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockGame({ name: "My New Game" }),
    );
    const handler = handleCreateGame(client);
    const result = await handler({ name: "My New Game", designer_id: "d-1" });
    expect(client.createGame).toHaveBeenCalledWith("My New Game", "d-1", undefined);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("My New Game");
    expect(text).toContain("created successfully");
  });

  it("passes description when provided", async () => {
    const client = createMockClient();
    (client.createGame as ReturnType<typeof vi.fn>).mockResolvedValue(mockGame());
    const handler = handleCreateGame(client);
    await handler({ name: "Game", designer_id: "d-1", description: "A test game" });
    expect(client.createGame).toHaveBeenCalledWith("Game", "d-1", "A test game");
  });
});

describe("handleUpdateGame", () => {
  it("updates game and returns success message", async () => {
    const client = createMockClient();
    (client.updateGame as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockGame({ name: "Updated Name" }),
    );
    const handler = handleUpdateGame(client);
    const result = await handler({ game_id: "game-001", name: "Updated Name" });
    expect(client.updateGame).toHaveBeenCalledWith("game-001", {
      name: "Updated Name",
      description: undefined,
      is_public: undefined,
    });
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("updated successfully");
  });

  it("handles partial updates", async () => {
    const client = createMockClient();
    (client.updateGame as ReturnType<typeof vi.fn>).mockResolvedValue(mockGame());
    const handler = handleUpdateGame(client);
    await handler({ game_id: "game-001", is_public: true });
    expect(client.updateGame).toHaveBeenCalledWith("game-001", {
      name: undefined,
      description: undefined,
      is_public: true,
    });
  });
});

describe("handleDeleteGame", () => {
  it("calls deleteGame and returns confirmation", async () => {
    const client = createMockClient();
    (client.deleteGame as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const handler = handleDeleteGame(client);
    const result = await handler({ game_id: "game-001" });
    expect(client.deleteGame).toHaveBeenCalledWith("game-001");
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("game-001");
    expect(text).toContain("deleted permanently");
  });
});
