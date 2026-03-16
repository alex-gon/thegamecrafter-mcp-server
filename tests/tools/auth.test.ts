import { handleAuthenticate, handleLogout } from "../../src/tools/auth.js";
import { createMockClient, mockSession } from "../helpers/mocks.js";

describe("handleAuthenticate", () => {
  it("calls client.authenticate and returns user_id", async () => {
    const client = createMockClient();
    (client.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSession({ user_id: "user-xyz" }),
    );
    const handler = handleAuthenticate(client);
    const result = await handler();
    expect(client.authenticate).toHaveBeenCalled();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("user-xyz");
    expect(result.isError).toBeUndefined();
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
