import { TgcError, formatToolError } from "../../src/types/errors.js";

describe("TgcError", () => {
  it("stores all fields correctly", () => {
    const err = new TgcError("msg", "auth", 401, 15, { name: "required" });
    expect(err.message).toBe("msg");
    expect(err.category).toBe("auth");
    expect(err.statusCode).toBe(401);
    expect(err.retryAfterSeconds).toBe(15);
    expect(err.fieldErrors).toEqual({ name: "required" });
  });

  it("has name TgcError", () => {
    const err = new TgcError("msg", "network");
    expect(err.name).toBe("TgcError");
  });
});

describe("formatToolError", () => {
  it("auth error includes authenticate suggestion", () => {
    const result = formatToolError(new TgcError("Unauthorized", "auth", 401));
    expect(result.isError).toBe(true);
    expect(result.content[0]).toHaveProperty("text");
    expect((result.content[0] as { text: string }).text).toContain("authenticate");
  });

  it("rate_limit error includes retry-after seconds", () => {
    const result = formatToolError(new TgcError("Rate limited", "rate_limit", 429, 30));
    expect((result.content[0] as { text: string }).text).toContain("30 seconds");
  });

  it("rate_limit error defaults to 15 seconds", () => {
    const result = formatToolError(new TgcError("Rate limited", "rate_limit", 429));
    expect((result.content[0] as { text: string }).text).toContain("15 seconds");
  });

  it("validation error with fieldErrors shows details", () => {
    const err = new TgcError("Bad input", "validation", 400, undefined, {
      name: "is required",
      email: "invalid format",
    });
    const result = formatToolError(err);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Validation error:");
    expect(text).toContain("name: is required");
    expect(text).toContain("email: invalid format");
  });

  it("validation error without fieldErrors shows message", () => {
    const result = formatToolError(new TgcError("Invalid game ID", "validation", 400));
    expect((result.content[0] as { text: string }).text).toBe("Invalid game ID");
  });

  it("tgc_api error includes status code", () => {
    const result = formatToolError(new TgcError("Not found", "tgc_api", 404));
    expect((result.content[0] as { text: string }).text).toContain("TGC API error (404)");
  });

  it("network ECONNREFUSED suggests config check", () => {
    const result = formatToolError(new TgcError("ECONNREFUSED", "network"));
    expect((result.content[0] as { text: string }).text).toContain("Check your TGC_API_BASE");
  });

  it("network other error shows generic message", () => {
    const result = formatToolError(new TgcError("timeout", "network"));
    expect((result.content[0] as { text: string }).text).toContain("Network error communicating");
  });
});
