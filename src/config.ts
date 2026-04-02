export interface TgcConfig {
  apiKeyId?: string;
  username?: string;
  password?: string;
  apiBase: string;
}

export function loadConfig(): TgcConfig {
  return {
    apiKeyId: process.env.TGC_API_KEY_ID || undefined,
    username: process.env.TGC_USERNAME || undefined,
    password: process.env.TGC_PASSWORD || undefined,
    apiBase:
      process.env.TGC_API_BASE ?? "https://www.thegamecrafter.com/api",
  };
}
