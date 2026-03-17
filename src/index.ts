#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import { TgcClient } from "./client/tgc-client.js";
import { TgcError, formatToolError } from "./types/errors.js";
import * as schemas from "./schemas/tool-inputs.js";
import { handleAuthenticate, handleLogout } from "./tools/auth.js";
import { handleGetMyDesigners } from "./tools/designer.js";
import {
  handleGetGameCatalog,
  handleGetComponentSizes,
} from "./tools/catalog.js";
import {
  handleGetMyGames,
  handleGetGameDetails,
  handleCreateGame,
  handleUpdateGame,
  handleDeleteGame,
} from "./tools/games.js";
import {
  handleAddComponentToGame,
  handleGetComponentDetails,
} from "./tools/components.js";
import { handleUploadFile } from "./tools/files.js";
import { handleGetPricingEstimate } from "./tools/pricing.js";
import {
  registerCatalogResource,
  registerGameSummaryResource,
  registerComponentSizesResource,
} from "./resources.js";
import {
  registerNewGameSetupPrompt,
  registerEstimateGameCostPrompt,
} from "./prompts.js";

const config = loadConfig();
const client = new TgcClient(config);

const server = new McpServer({
  name: "The Game Crafter",
  version: "0.1.0",
});

// Wrap handlers to convert TgcError → MCP error results
function withErrorHandling<T>(
  handler: (args: T) => Promise<CallToolResult>,
): (args: T) => Promise<CallToolResult> {
  return async (args: T): Promise<CallToolResult> => {
    try {
      return await handler(args);
    } catch (error) {
      if (error instanceof TgcError) {
        return formatToolError(error);
      }
      return {
        content: [
          { type: "text", text: `Unexpected error: ${String(error)}` },
        ],
        isError: true,
      };
    }
  };
}

// --- Register all 14 tools ---

server.registerTool("get_game_catalog", {
  description:
    "Browse TGC printable component types (cards, boards, boxes, etc.). No authentication required.",
  inputSchema: schemas.getGameCatalogInput,
  annotations: { readOnlyHint: true },
}, withErrorHandling(handleGetGameCatalog(client)));

server.registerTool("authenticate", {
  description:
    "Create a TGC session using stored credentials. Must be called before any tool that requires authentication.",
  annotations: { readOnlyHint: false },
}, withErrorHandling(handleAuthenticate(client)));

server.registerTool("logout", {
  description: "Destroy the current TGC session.",
  annotations: { destructiveHint: true },
}, withErrorHandling(handleLogout(client)));

server.registerTool("get_my_designers", {
  description:
    "List designer profiles for the authenticated user. Returns designer ID, name, and user ID. Use the designer_id with get_my_games or create_game. Requires authentication.",
  annotations: { readOnlyHint: true },
}, withErrorHandling(handleGetMyDesigners(client)));

server.registerTool("get_my_games", {
  description:
    "List all games for a designer with name, ID, and status. Returns paginated results. Requires a designer_id from get_my_designers. Requires authentication.",
  inputSchema: schemas.getMyGamesInput,
  annotations: { readOnlyHint: true },
}, withErrorHandling(handleGetMyGames(client)));

server.registerTool("get_game_details", {
  description:
    "Get full game info including name, description, component list with quantities, file references, and pricing. Use this to review a game before making changes. Requires authentication.",
  inputSchema: schemas.getGameDetailsInput,
  annotations: { readOnlyHint: true },
}, withErrorHandling(handleGetGameDetails(client)));

server.registerTool("create_game", {
  description: "Create a new game project under a designer. Requires authentication.",
  inputSchema: schemas.createGameInput,
  annotations: { readOnlyHint: false },
}, withErrorHandling(handleCreateGame(client)));

server.registerTool("add_component_to_game", {
  description:
    "Add a printable component (card deck, board, box, etc.) or stock part to a game. Use a catalog identity (e.g., 'BridgeDeck') for printable components, or a stock part UUID. Requires authentication.",
  inputSchema: schemas.addComponentToGameInput,
  annotations: { readOnlyHint: false },
}, withErrorHandling(handleAddComponentToGame(client)));

server.registerTool("upload_file", {
  description:
    "Upload an image file to a TGC folder for use in a game component. This is a heavyweight operation — avoid calling repeatedly in quick succession. Requires authentication.",
  inputSchema: schemas.uploadFileInput,
  annotations: { readOnlyHint: false },
}, withErrorHandling(handleUploadFile(client)));

server.registerTool("get_component_sizes", {
  description:
    "Get pixel dimensions (width, height, bleed, safe zone) and finished inches for TGC component types. Use this to determine correct image sizes before uploading artwork. No authentication required.",
  inputSchema: schemas.getComponentSizesInput,
  annotations: { readOnlyHint: true },
}, withErrorHandling(handleGetComponentSizes(client)));

server.registerTool("get_pricing_estimate", {
  description:
    "Get per-component cost breakdown and total price for a game at various order quantities. The game must have components added first via add_component_to_game. Requires authentication.",
  inputSchema: schemas.getPricingEstimateInput,
  annotations: { readOnlyHint: true },
}, withErrorHandling(handleGetPricingEstimate(client)));

server.registerTool("update_game", {
  description: "Update a game's name, description, or visibility. Requires authentication.",
  inputSchema: schemas.updateGameInput,
  annotations: { readOnlyHint: false },
}, withErrorHandling(handleUpdateGame(client)));

server.registerTool("get_component_details", {
  description:
    "Get detailed information about a component type by catalog identity (e.g., 'BridgeDeck') or a game part by UUID.",
  inputSchema: schemas.getComponentDetailsInput,
  annotations: { readOnlyHint: true },
}, withErrorHandling(handleGetComponentDetails(client)));

server.registerTool("delete_game", {
  description:
    "Permanently delete a game project. This action cannot be undone.",
  inputSchema: schemas.deleteGameInput,
  annotations: { readOnlyHint: false, destructiveHint: true },
}, withErrorHandling(handleDeleteGame(client)));

// --- Register resources ---

registerCatalogResource(server, client);
registerGameSummaryResource(server, client);
registerComponentSizesResource(server, client);

// --- Register prompts ---

registerNewGameSetupPrompt(server);
registerEstimateGameCostPrompt(server);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TGC MCP Server running on stdio");

  const shutdown = async () => {
    if (client.session.isActive) {
      await client.logout().catch(() => {});
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Server startup error:", error);
  process.exit(1);
});
