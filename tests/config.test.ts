import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TGC_API_KEY_ID = "test-key";
    process.env.TGC_USERNAME = "testuser";
    process.env.TGC_PASSWORD = "testpass";
    delete process.env.TGC_API_BASE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns config when all env vars present", () => {
    const config = loadConfig();
    expect(config.apiKeyId).toBe("test-key");
    expect(config.username).toBe("testuser");
    expect(config.password).toBe("testpass");
  });

  it("defaults apiBase to TGC production URL", () => {
    const config = loadConfig();
    expect(config.apiBase).toBe("https://www.thegamecrafter.com/api");
  });

  it("uses custom TGC_API_BASE when provided", () => {
    process.env.TGC_API_BASE = "https://custom.api.com";
    const config = loadConfig();
    expect(config.apiBase).toBe("https://custom.api.com");
  });

  it("returns undefined apiKeyId when TGC_API_KEY_ID is missing", () => {
    delete process.env.TGC_API_KEY_ID;
    const config = loadConfig();
    expect(config.apiKeyId).toBeUndefined();
  });

  it("returns undefined username when TGC_USERNAME is missing", () => {
    delete process.env.TGC_USERNAME;
    const config = loadConfig();
    expect(config.username).toBeUndefined();
  });

  it("returns undefined password when TGC_PASSWORD is missing", () => {
    delete process.env.TGC_PASSWORD;
    const config = loadConfig();
    expect(config.password).toBeUndefined();
  });
});
