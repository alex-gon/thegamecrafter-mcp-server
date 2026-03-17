import { RateLimiter } from "../../src/client/rate-limiter.js";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("acquire() resolves immediately when tokens available", async () => {
    const limiter = new RateLimiter({ maxTokens: 5, refillRatePerSecond: 4 });
    await limiter.acquire();
    // Should not throw or hang
  });

  it("multiple acquires decrement tokens", async () => {
    const limiter = new RateLimiter({ maxTokens: 3, refillRatePerSecond: 4 });
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    // All three should resolve immediately since we have 3 tokens
  });

  it("acquire() waits when tokens exhausted", async () => {
    const limiter = new RateLimiter({ maxTokens: 1, refillRatePerSecond: 4 });
    await limiter.acquire(); // consumes the 1 token

    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // Should not be resolved yet
    expect(resolved).toBe(false);

    // Advance past the wait time (1/4 second = 250ms)
    await vi.advanceTimersByTimeAsync(300);

    await promise;
    expect(resolved).toBe(true);
  });

  it("drain() zeros tokens", () => {
    const limiter = new RateLimiter({ maxTokens: 100, refillRatePerSecond: 4 });
    limiter.drain(10);
    // After drain, tokens should be 0 — next acquire will wait
  });

  it("acquire() after drain() waits until pause expires", async () => {
    const limiter = new RateLimiter({ maxTokens: 100, refillRatePerSecond: 4 });
    limiter.drain(5); // pause for 5 seconds

    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // After 2 seconds, still paused
    await vi.advanceTimersByTimeAsync(2000);
    expect(resolved).toBe(false);

    // After 5+ seconds total, should resume
    await vi.advanceTimersByTimeAsync(4000);
    await promise;
    expect(resolved).toBe(true);
  });

  it("acquire() after pause expires resumes normally", async () => {
    const limiter = new RateLimiter({ maxTokens: 10, refillRatePerSecond: 4 });
    limiter.drain(1); // pause for 1 second

    await vi.advanceTimersByTimeAsync(1500); // advance past pause

    // Now acquire should work — tokens have been refilling
    await limiter.acquire();
  });

  it("refill adds correct tokens based on elapsed time", async () => {
    const limiter = new RateLimiter({ maxTokens: 10, refillRatePerSecond: 4 });

    // Exhaust all tokens
    for (let i = 0; i < 10; i++) {
      await limiter.acquire();
    }

    // Advance 1 second — should refill 4 tokens
    await vi.advanceTimersByTimeAsync(1000);

    // Should be able to acquire 4 tokens without waiting
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
  });

  it("tokens never exceed maxTokens", async () => {
    const limiter = new RateLimiter({ maxTokens: 5, refillRatePerSecond: 100 });

    // Advance 10 seconds — would add 1000 tokens but should cap at 5
    await vi.advanceTimersByTimeAsync(10000);

    // Should be able to acquire exactly 5 immediately
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    // 6th should wait
    let resolved = false;
    limiter.acquire().then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
  });

  it("drain() caps pause duration at 300 seconds", async () => {
    const limiter = new RateLimiter({ maxTokens: 100, refillRatePerSecond: 4 });
    const before = Date.now();
    limiter.drain(999999); // would be 11+ days uncapped

    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // After 299 seconds, still paused
    await vi.advanceTimersByTimeAsync(299_000);
    expect(resolved).toBe(false);

    // After 301 seconds total, should have resumed (capped at 300)
    await vi.advanceTimersByTimeAsync(2_000);
    await promise;
    expect(resolved).toBe(true);
  });

  it("wait duration is 1/refillRate seconds when exhausted", async () => {
    const limiter = new RateLimiter({ maxTokens: 1, refillRatePerSecond: 2 });
    await limiter.acquire(); // exhaust

    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // 1/2 second = 500ms wait
    await vi.advanceTimersByTimeAsync(400);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(200);
    await promise;
    expect(resolved).toBe(true);
  });
});
