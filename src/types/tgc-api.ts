export interface TgcSession {
  id: string;
  user_id: string;
  [key: string]: unknown;
}

export interface TgcUser {
  id: string;
  username: string;
  display_name: string;
  [key: string]: unknown;
}

export interface TgcDesigner {
  id: string;
  name: string;
  user_id: string;
  [key: string]: unknown;
}

export interface TgcProduct {
  identity: string;
  name: string;
  categories?: string[];
  size?: {
    pixels?: [number, number];
    finished_inches?: [string, string, number | string];
  };
  sides?: Array<{
    label: string;
    field: string;
    mask?: string;
    overlay?: string;
    [key: string]: unknown;
  }>;
  create_api?: string;
  relationship?: string;
  [key: string]: unknown;
}

export interface TgcGame {
  id: string;
  name: string;
  designer_id: string;
  description?: string;
  status?: string;
  parts?: TgcGamePart[];
  [key: string]: unknown;
}

export interface TgcGamePart {
  id: string;
  game_id: string;
  part_id: string;
  quantity: number;
  name?: string;
  [key: string]: unknown;
}

export interface TgcFile {
  id: string;
  filename: string;
  folder_id: string;
  uri?: string;
  [key: string]: unknown;
}

export interface TgcGameLedgerEntry {
  id: string;
  game_id: string;
  name: string;
  amount: number;
  category?: string;
  [key: string]: unknown;
}

export interface TgcPaginatedResponse<T> {
  items: T[];
  paging: {
    total_items: number;
    page_number: number;
    items_per_page: number;
    total_pages: number;
  };
}

export interface TgcApiErrorResponse {
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}
