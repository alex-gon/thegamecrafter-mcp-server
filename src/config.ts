export interface TgcConfig {
  apiKeyId: string;
  username: string;
  password: string;
  apiBase: string;
}

export function loadConfig(): TgcConfig {
  const apiKeyId = process.env.TGC_API_KEY_ID;
  const username = process.env.TGC_USERNAME;
  const password = process.env.TGC_PASSWORD;
  const apiBase =
    process.env.TGC_API_BASE ?? "https://www.thegamecrafter.com/api";

  if (!apiKeyId || !username || !password) {
    throw new Error(
      "Missing required environment variables: TGC_API_KEY_ID, TGC_USERNAME, TGC_PASSWORD",
    );
  }

  return { apiKeyId, username, password, apiBase };
}
