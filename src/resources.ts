import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TgcClient } from "./client/tgc-client.js";

interface CacheEntry {
  data: string;
  fetchedAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function isCacheValid(cache: CacheEntry | null): cache is CacheEntry {
  return cache !== null && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

export function registerCatalogResource(
  server: McpServer,
  client: TgcClient,
): void {
  let cached: CacheEntry | null = null;

  server.registerResource("catalog", "tgc://catalog", {
    description:
      "Full catalog of TGC printable component types (cards, boards, boxes, etc.).",
    mimeType: "application/json",
  }, async (): Promise<ReadResourceResult> => {
    if (!isCacheValid(cached)) {
      const products = await client.getProducts();
      cached = { data: JSON.stringify(products, null, 2), fetchedAt: Date.now() };
    }
    return {
      contents: [
        {
          uri: "tgc://catalog",
          mimeType: "application/json",
          text: cached.data,
        },
      ],
    };
  });
}

export function registerGameSummaryResource(
  server: McpServer,
  client: TgcClient,
): void {
  const template = new ResourceTemplate("tgc://game/{id}/summary", {
    list: undefined,
  });

  server.registerResource("game_summary", template, {
    description:
      "Complete summary of a TGC game project including components, status, and metadata.",
    mimeType: "application/json",
  }, async (_uri, variables): Promise<ReadResourceResult> => {
    const gameId = variables.id as string;
    const game = await client.getGame(gameId);
    const text = JSON.stringify(game, null, 2);
    return {
      contents: [
        {
          uri: `tgc://game/${gameId}/summary`,
          mimeType: "application/json",
          text,
        },
      ],
    };
  });
}

export function registerComponentSizesResource(
  server: McpServer,
  client: TgcClient,
): void {
  let cached: CacheEntry | null = null;

  server.registerResource(
    "component_sizes",
    "tgc://component-sizes",
    {
      description:
        "Reference sheet of all TGC component pixel dimensions (width, height, bleed, safe zone).",
      mimeType: "application/json",
    },
    async (): Promise<ReadResourceResult> => {
      if (!isCacheValid(cached)) {
        const products = await client.getProducts();
        const sizes = products.map((p) => ({
          identity: p.identity,
          name: p.name,
          width_px: p.size?.pixels?.[0] ?? null,
          height_px: p.size?.pixels?.[1] ?? null,
          finished_inches: p.size?.finished_inches ?? null,
        }));
        cached = { data: JSON.stringify(sizes, null, 2), fetchedAt: Date.now() };
      }
      return {
        contents: [
          {
            uri: "tgc://component-sizes",
            mimeType: "application/json",
            text: cached.data,
          },
        ],
      };
    },
  );
}
