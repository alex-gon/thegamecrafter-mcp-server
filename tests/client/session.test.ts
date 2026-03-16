import { SessionManager } from "../../src/client/session.js";
import { TgcError } from "../../src/types/errors.js";

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it("get() returns null initially", () => {
    expect(manager.get()).toBeNull();
  });

  it("isActive is false initially", () => {
    expect(manager.isActive).toBe(false);
  });

  it("sessionId is null initially", () => {
    expect(manager.sessionId).toBeNull();
  });

  it("store() and get() round-trip", () => {
    const session = { id: "sess-1", user_id: "user-1" };
    manager.store(session);
    expect(manager.get()).toEqual(session);
  });

  it("store() sets isActive to true", () => {
    manager.store({ id: "sess-1", user_id: "user-1" });
    expect(manager.isActive).toBe(true);
  });

  it("store() sets sessionId", () => {
    manager.store({ id: "sess-1", user_id: "user-1" });
    expect(manager.sessionId).toBe("sess-1");
  });

  it("getOrThrow() throws TgcError when no session", () => {
    expect(() => manager.getOrThrow()).toThrow(TgcError);
    try {
      manager.getOrThrow();
    } catch (e) {
      expect((e as TgcError).category).toBe("auth");
    }
  });

  it("getOrThrow() returns session when active", () => {
    const session = { id: "sess-1", user_id: "user-1" };
    manager.store(session);
    expect(manager.getOrThrow()).toEqual(session);
  });

  it("clear() removes session", () => {
    manager.store({ id: "sess-1", user_id: "user-1" });
    manager.clear();
    expect(manager.get()).toBeNull();
    expect(manager.isActive).toBe(false);
    expect(manager.sessionId).toBeNull();
  });
});
