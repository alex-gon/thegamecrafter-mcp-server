import { z } from "zod/v4";

// Reusable ID validator — prevents path traversal via ID fields
const safeId = z
  .string()
  .refine((val) => !val.includes("/") && !val.includes("\\") && !val.includes(".."), {
    message: "ID must not contain path separators or traversal sequences",
  });

// Tool 1: get_game_catalog — browse printable component types (no auth)
export const getGameCatalogInput = {
  category: z
    .string()
    .max(100)
    .optional()
    .describe(
      'Optional category to filter products (e.g., "cards", "boards", "boxes"). Omit to list all.',
    ),
};

// Tool 2: authenticate — no LLM-supplied input (creds from env)
// Tool 3: logout — no input (session managed internally)
// Tool 4: get_my_designers — no input (uses current session)

// Tool 5: get_my_games — list games for a designer
export const getMyGamesInput = {
  designer_id: safeId.describe(
    "The designer ID to list games for. Get this from the get_my_designers tool.",
  ),
  page_number: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Page number for pagination (default: 1)."),
};

// Tool 6: get_game_details — full game info with components
export const getGameDetailsInput = {
  game_id: safeId.describe(
    "The game ID to get details for. Get this from the get_my_games tool.",
  ),
};

// Tool 7: create_game — create a new game project
export const createGameInput = {
  name: z.string().trim().min(1).max(255).describe("Name for the new game project (max 255 chars)."),
  designer_id: safeId.describe(
    "The designer ID to create the game under. Get this from the get_my_designers tool.",
  ),
  description: z
    .string()
    .max(5000)
    .optional()
    .describe("Optional description for the game (max 5000 chars)."),
};

// Tool 8: add_component_to_game — add a printable or stock part
export const addComponentToGameInput = {
  game_id: safeId.describe("The game ID to add the component to."),
  part_id: safeId.describe(
    "The component identity from the catalog (e.g., 'BridgeDeck', 'SmallTuckBox') or a stock part UUID.",
  ),
  quantity: z
    .number()
    .int()
    .positive()
    .describe(
      "Number of this component to include (e.g., 52 for a deck of cards).",
    ),
  name: z
    .string()
    .trim()
    .max(255)
    .optional()
    .describe("Optional display name for this component within the game (max 255 chars)."),
};

// Tool 9: upload_file — upload an image from local path or URL
export const uploadFileInput = {
  folder_id: safeId.describe(
    "The folder ID to upload the file into. Components have associated folder IDs.",
  ),
  file_path: z
    .string()
    .optional()
    .describe(
      "Absolute path to the image file on disk. Provide either file_path or url, not both.",
    ),
  url: z
    .string()
    .optional()
    .describe(
      "Public URL of the image to download and upload to TGC. Provide either url or file_path, not both.",
    ),
  filename: z
    .string()
    .max(255)
    .optional()
    .describe(
      "Optional filename to use in TGC (max 255 chars). Required when uploading from URL. Defaults to the original filename when uploading from disk.",
    ),
};

// Tool 10: get_component_sizes — pixel dimensions for component types
export const getComponentSizesInput = {
  part_id: safeId
    .optional()
    .describe(
      "Optional component identity from the catalog (e.g., 'BridgeDeck'). Omit to list all component types.",
    ),
};

// Tool 11: get_pricing_estimate — per-component cost breakdown
export const getPricingEstimateInput = {
  game_id: safeId.describe(
    "The game ID to get pricing for. The game must have components added.",
  ),
};

// Tool 12: update_game — update a game's metadata
export const updateGameInput = {
  game_id: safeId.describe("The game ID to update."),
  name: z.string().trim().max(255).optional().describe("New name for the game (max 255 chars)."),
  description: z
    .string()
    .max(5000)
    .optional()
    .describe("New description for the game (max 5000 chars)."),
  is_public: z
    .boolean()
    .optional()
    .describe("Whether the game should be publicly visible in the TGC shop."),
};

// Tool 13: get_component_details — detailed info about a component type
export const getComponentDetailsInput = {
  part_id: safeId.describe(
    "The component identity from the catalog (e.g., 'BridgeDeck') or a game part UUID.",
  ),
};

// Tool 14: delete_game — permanently delete a game project
export const deleteGameInput = {
  game_id: safeId.describe("The game ID to delete. This action is permanent and cannot be undone."),
};
