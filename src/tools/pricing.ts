import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TgcClient } from "../client/tgc-client.js";

export function handleGetPricingEstimate(client: TgcClient) {
  return async (args: { game_id: string }): Promise<CallToolResult> => {
    const [entries, game] = await Promise.all([
      client.getGameLedgerEntries(args.game_id),
      client.getGame(args.game_id),
    ]);

    if (entries.length > 0) {
      return {
        content: [
          {
            type: "text",
            text: `Ledger entries:\n${JSON.stringify(entries, null, 2)}`,
          },
        ],
      };
    }

    // Fallback: extract pricing from the game object itself
    const pricing = {
      game_id: game.id,
      name: game.name,
      cost: game.cost,
      price_1: game.price1 ?? game.price,
      price_10: game.price10,
      price_100: game.price100,
      price_500: game.price500,
      price_1000: game.price1000,
      retail_price_each: game.retail_price_each,
      msrp: game.msrp,
      designer_profit: game.designer_profit,
      component_list: game.component_list,
    };

    return {
      content: [
        {
          type: "text",
          text: `No ledger entries available. Pricing summary from game details:\n\n${JSON.stringify(pricing, null, 2)}`,
        },
      ],
    };
  };
}
