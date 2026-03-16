import { z } from "zod/v4";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerNewGameSetupPrompt(server: McpServer): void {
  server.registerPrompt(
    "new_game_setup",
    {
      description:
        "Guided workflow for creating a complete TGC game project with components and artwork.",
      argsSchema: {
        game_name: z
          .string()
          .optional()
          .describe("Desired name for the game project."),
        game_type: z
          .string()
          .optional()
          .describe(
            "Type of game (e.g., card game, board game, party game).",
          ),
      },
    },
    async (args): Promise<GetPromptResult> => {
      const nameInstruction = args.game_name
        ? `The user wants to create a game called "${args.game_name}".`
        : "Ask the user what they want to name their game.";
      const typeInstruction = args.game_type
        ? `This is a ${args.game_type}.`
        : "Ask the user what type of game they are creating (card game, board game, party game, etc.).";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Help me set up a new game on The Game Crafter.

${nameInstruction}
${typeInstruction}

Please guide me through these steps in order:

1. **Authenticate** — Call the \`authenticate\` tool to create a session.
2. **Get designer** — Call \`get_my_designers\` to find my designer profile. If I have multiple, ask which one to use.
3. **Browse components** — Call \`get_game_catalog\` to show me available component types for my game type. Help me pick the right components (card sizes, board sizes, box type, etc.).
4. **Create the game** — Call \`create_game\` with the chosen name and designer ID.
5. **Add components** — For each component the user wants, call \`add_component_to_game\`. Ask about quantities.
6. **Review** — Call \`get_game_details\` to show the complete game setup.
7. **Pricing** — Call \`get_pricing_estimate\` to show the cost breakdown.

At each step, explain what you are doing and wait for confirmation before proceeding.`,
            },
          },
        ],
      };
    },
  );
}

export function registerEstimateGameCostPrompt(server: McpServer): void {
  server.registerPrompt(
    "estimate_game_cost",
    {
      description:
        "Get a cost estimate for a TGC game by reviewing its components and pricing.",
      argsSchema: {
        game_id: z
          .string()
          .optional()
          .describe(
            "Existing game ID to estimate cost for. If not provided, you will be helped to find it.",
          ),
      },
    },
    async (args): Promise<GetPromptResult> => {
      const gameInstruction = args.game_id
        ? `The user wants a cost estimate for game ID: ${args.game_id}.`
        : "The user wants a cost estimate. Ask them to provide a game ID, or help them find it using get_my_designers and get_my_games.";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I need a cost estimate for a game on The Game Crafter.

${gameInstruction}

Please follow these steps:

1. **Authenticate** if not already authenticated — call \`authenticate\`.
2. **Get game details** — call \`get_game_details\` with the game ID to see what components are in the game.
3. **Get pricing** — call \`get_pricing_estimate\` to get the per-component cost breakdown.
4. **Get component sizes** — for each component, call \`get_component_details\` to get sizing info.
5. **Present a summary** — show a formatted table with:
   - Component name and type
   - Quantity
   - Per-unit cost
   - Subtotal
   - Grand total for the game
   - Note about minimum order quantities if applicable

If the game has no components yet, offer to help add components first using the catalog.`,
            },
          },
        ],
      };
    },
  );
}
