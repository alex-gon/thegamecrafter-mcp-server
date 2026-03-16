import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TgcClient } from "../client/tgc-client.js";

export function handleGetMyGames(client: TgcClient) {
  return async (args: {
    designer_id: string;
    page_number?: number;
  }): Promise<CallToolResult> => {
    const games = await client.getGames(args.designer_id, args.page_number);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(games, null, 2),
        },
      ],
    };
  };
}

export function handleGetGameDetails(client: TgcClient) {
  return async (args: { game_id: string }): Promise<CallToolResult> => {
    const game = await client.getGame(args.game_id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(game, null, 2),
        },
      ],
    };
  };
}

export function handleCreateGame(client: TgcClient) {
  return async (args: {
    name: string;
    designer_id: string;
    description?: string;
  }): Promise<CallToolResult> => {
    const game = await client.createGame(
      args.name,
      args.designer_id,
      args.description,
    );
    return {
      content: [
        {
          type: "text",
          text: `Game "${game.name}" created successfully.\n\n${JSON.stringify(game, null, 2)}`,
        },
      ],
    };
  };
}

export function handleUpdateGame(client: TgcClient) {
  return async (args: {
    game_id: string;
    name?: string;
    description?: string;
    is_public?: boolean;
  }): Promise<CallToolResult> => {
    const game = await client.updateGame(args.game_id, {
      name: args.name,
      description: args.description,
      is_public: args.is_public,
    });
    return {
      content: [
        {
          type: "text",
          text: `Game "${game.name}" updated successfully.\n\n${JSON.stringify(game, null, 2)}`,
        },
      ],
    };
  };
}

export function handleDeleteGame(client: TgcClient) {
  return async (args: { game_id: string }): Promise<CallToolResult> => {
    await client.deleteGame(args.game_id);
    return {
      content: [
        {
          type: "text",
          text: `Game ${args.game_id} deleted permanently.`,
        },
      ],
    };
  };
}
