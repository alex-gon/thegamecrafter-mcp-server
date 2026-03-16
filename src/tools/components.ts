import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TgcClient } from "../client/tgc-client.js";

export function handleAddComponentToGame(client: TgcClient) {
  return async (args: {
    game_id: string;
    part_id: string;
    quantity: number;
    name?: string;
  }): Promise<CallToolResult> => {
    // Check if part_id is a catalog product identity (printable component)
    const products = await client.getProducts();
    const catalogProduct = products.find((p) => p.identity === args.part_id);

    if (catalogProduct && catalogProduct.create_api) {
      // Strip leading /api prefix — the client's base URL already includes it
      const apiPath = catalogProduct.create_api.replace(/^\/api/, "");
      const component = await client.createPrintableComponent(
        apiPath,
        catalogProduct.identity,
        args.game_id,
        args.name,
        args.quantity,
      );
      return {
        content: [
          {
            type: "text",
            text: `Printable component "${catalogProduct.name}" added to game successfully.\n\n${JSON.stringify(component, null, 2)}`,
          },
        ],
      };
    }

    // Fall back to stock part via /gamepart
    const part = await client.addGamePart(
      args.game_id,
      args.part_id,
      args.quantity,
      args.name,
    );
    return {
      content: [
        {
          type: "text",
          text: `Component added to game successfully.\n\n${JSON.stringify(part, null, 2)}`,
        },
      ],
    };
  };
}

export function handleGetComponentDetails(client: TgcClient) {
  return async (args: { part_id: string }): Promise<CallToolResult> => {
    // Try catalog lookup first (by identity)
    const products = await client.getProducts();
    const product = products.find((p) => p.identity === args.part_id);
    if (product) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(product, null, 2),
          },
        ],
      };
    }

    // Fall back to /part/{id} for game part instances (UUIDs)
    const part = await client.getPart(args.part_id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(part, null, 2),
        },
      ],
    };
  };
}
