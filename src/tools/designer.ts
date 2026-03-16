import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TgcClient } from "../client/tgc-client.js";

export function handleGetMyDesigners(client: TgcClient) {
  return async (): Promise<CallToolResult> => {
    const designers = await client.getDesigners();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(designers, null, 2),
        },
      ],
    };
  };
}
