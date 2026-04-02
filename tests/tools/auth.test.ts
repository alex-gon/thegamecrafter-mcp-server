import { handleAuthenticate, handleLogout } from "../../src/tools/auth.js";
import { createMockClient, mockSession } from "../helpers/mocks.js";

describe("handleAuthenticate", () => {
  it("calls client.authenticate with no overrides when args empty", async () => {
    const client = createMockClient();
    (client.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSession({ user_id: "user-xyz" }),
    );
    const handler = handleAuthenticate(client);
    const result = await handler({});
    expect(client.authenticate).toHaveBeenCalledWith({
      apiKeyId: undefined,
      username: undefined,
      password: undefined,
    });
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("user-xyz");
    expect(result.isError).toBeUndefined();
  });

  it("forwards credentials when all three provided", async () => {
    const client = createMockClient();
    (client.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSession({ user_id: "remote-user" }),
    );
    const handler = handleAuthenticate(client);
    const result = await handler({
      api_key_id: "remote-key",
      username: "remote-user",
      password: "remote-pass",
    });
    expect(client.authenticate).toHaveBeenCalledWith({
      apiKeyId: "remote-key",
      username: "remote-user",
      password: "remote-pass",
    });
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("remote-user");
  });
});

describe("handleLogout", () => {
  it("calls client.logout and returns success", async () => {
    const client = createMockClient();
    (client.logout as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const handler = handleLogout(client);
    const result = await handler();
    expect(client.logout).toHaveBeenCalled();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Logged out");
  });
});
