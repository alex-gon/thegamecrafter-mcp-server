import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TgcClient } from "../client/tgc-client.js";

export function handleGetGameCatalog(client: TgcClient) {
  return async (args: { category?: string }): Promise<CallToolResult> => {
    const products = await client.getProducts(args.category);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(products, null, 2),
        },
      ],
    };
  };
}

export function handleGetComponentSizes(client: TgcClient) {
  return async (args: { part_id?: string }): Promise<CallToolResult> => {
    if (args.part_id) {
      const products = await client.getProducts();
      const product = products.find((p) => p.identity === args.part_id);
      if (!product) {
        return {
          content: [
            {
              type: "text",
              text: `No component found with ID "${args.part_id}".`,
            },
          ],
          isError: true,
        };
      }
      const sizes = [{
        identity: product.identity,
        name: product.name,
        width_px: product.size?.pixels?.[0] ?? null,
        height_px: product.size?.pixels?.[1] ?? null,
        finished_inches: product.size?.finished_inches ?? null,
      }];
      return {
        content: [{ type: "text", text: JSON.stringify(sizes, null, 2) }],
      };
    }

    const products = await client.getProducts();
    const sizes = products.map((p) => ({
      identity: p.identity,
      name: p.name,
      width_px: p.size?.pixels?.[0] ?? null,
      height_px: p.size?.pixels?.[1] ?? null,
      finished_inches: p.size?.finished_inches ?? null,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(sizes, null, 2) }],
    };
  };
}
