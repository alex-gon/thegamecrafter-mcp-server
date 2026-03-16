import { RequestBudget } from "../../src/client/request-budget.js";
import { TgcError } from "../../src/types/errors.js";

describe("RequestBudget", () => {
  it("allows reads within budget", () => {
    const budget = new RequestBudget({ maxReadRequests: 3, maxWriteRequests: 3 });
    budget.check("GET");
    budget.check("GET");
    budget.check("GET");
    expect(budget.counts.reads).toBe(3);
  });

  it("allows writes within budget", () => {
    const budget = new RequestBudget({ maxReadRequests: 3, maxWriteRequests: 3 });
    budget.check("POST");
    budget.check("PUT");
    budget.check("DELETE");
    expect(budget.counts.writes).toBe(3);
  });

  it("throws when read budget exceeded", () => {
    const budget = new RequestBudget({ maxReadRequests: 2, maxWriteRequests: 10 });
    budget.check("GET");
    budget.check("GET");
    expect(() => budget.check("GET")).toThrow(TgcError);
    try {
      budget.check("GET");
    } catch (e) {
      expect((e as TgcError).category).toBe("rate_limit");
      expect((e as TgcError).message).toContain("read request budget exceeded");
    }
  });

  it("throws when write budget exceeded", () => {
    const budget = new RequestBudget({ maxReadRequests: 10, maxWriteRequests: 2 });
    budget.check("POST");
    budget.check("PUT");
    expect(() => budget.check("POST")).toThrow(TgcError);
    try {
      budget.check("DELETE");
    } catch (e) {
      expect((e as TgcError).message).toContain("write request budget exceeded");
    }
  });

  it("tracks reads and writes independently", () => {
    const budget = new RequestBudget({ maxReadRequests: 2, maxWriteRequests: 2 });
    budget.check("GET");
    budget.check("GET");
    // Reads exhausted, but writes should still work
    budget.check("POST");
    budget.check("PUT");
    expect(budget.counts).toEqual({ reads: 2, writes: 2 });
  });

  it("reset() clears all counts", () => {
    const budget = new RequestBudget({ maxReadRequests: 5, maxWriteRequests: 5 });
    budget.check("GET");
    budget.check("POST");
    budget.reset();
    expect(budget.counts).toEqual({ reads: 0, writes: 0 });
  });

  it("allows requests again after reset", () => {
    const budget = new RequestBudget({ maxReadRequests: 1, maxWriteRequests: 1 });
    budget.check("GET");
    expect(() => budget.check("GET")).toThrow(TgcError);
    budget.reset();
    budget.check("GET"); // should not throw
    expect(budget.counts.reads).toBe(1);
  });

  it("uses default limits when no config provided", () => {
    const budget = new RequestBudget();
    // Should allow up to 500 reads and 200 writes by default
    for (let i = 0; i < 500; i++) budget.check("GET");
    expect(() => budget.check("GET")).toThrow(TgcError);
    for (let i = 0; i < 200; i++) budget.check("POST");
    expect(() => budget.check("POST")).toThrow(TgcError);
  });

  it("error message suggests re-authenticating", () => {
    const budget = new RequestBudget({ maxReadRequests: 0, maxWriteRequests: 1 });
    try {
      budget.check("GET");
    } catch (e) {
      expect((e as TgcError).message).toContain("authenticate");
    }
  });
});
