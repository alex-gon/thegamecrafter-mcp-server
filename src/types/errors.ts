import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type TgcErrorCategory =
  | "auth"
  | "rate_limit"
  | "validation"
  | "tgc_api"
  | "network";

export class TgcError extends Error {
  constructor(
    message: string,
    public readonly category: TgcErrorCategory,
    public readonly statusCode?: number,
    public readonly retryAfterSeconds?: number,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "TgcError";
  }
}

export function formatToolError(error: TgcError): CallToolResult {
  let text: string;

  switch (error.category) {
    case "auth":
      text = `${error.message}\n\nCall the \`authenticate\` tool first with your TGC credentials.`;
      break;
    case "rate_limit":
      text = `${error.message}\n\nRetry after ${error.retryAfterSeconds ?? 15} seconds.`;
      break;
    case "validation":
      if (error.fieldErrors) {
        const details = Object.entries(error.fieldErrors)
          .map(([field, msg]) => `  - ${field}: ${msg}`)
          .join("\n");
        text = `Validation error:\n${details}`;
      } else {
        text = error.message;
      }
      break;
    case "tgc_api":
      text = `TGC API error (${error.statusCode ?? "unknown"}): ${error.message}`;
      break;
    case "network":
      text = error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND")
        ? `Cannot reach TGC API. Check your TGC_API_BASE configuration and network connection.`
        : `Network error communicating with TGC: ${error.message}`;
      break;
  }

  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}
