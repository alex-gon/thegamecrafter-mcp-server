import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TgcClient } from "../client/tgc-client.js";

export function handleAuthenticate(client: TgcClient) {
  return async (args: {
    api_key_id?: string;
    username?: string;
    password?: string;
  }): Promise<CallToolResult> => {
    const session = await client.authenticate({
      apiKeyId: args.api_key_id,
      username: args.username,
      password: args.password,
    });
    return {
      content: [
        {
          type: "text",
          text: `Authenticated successfully as user ${session.user_id}. You can now use tools that require authentication.`,
        },
      ],
    };
  };
}

export function handleLogout(client: TgcClient) {
  return async (): Promise<CallToolResult> => {
    await client.logout();
    return {
      content: [
        { type: "text", text: "Logged out successfully. Session destroyed." },
      ],
    };
  };
}
