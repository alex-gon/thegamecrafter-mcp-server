export interface RateLimiterConfig {
  maxTokens: number;
  refillRatePerSecond: number;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private pauseUntil: number = 0;

  constructor(private config: RateLimiterConfig) {
    this.tokens = config.maxTokens;
    this.lastRefill = Date.now();
  }

  drain(pauseSeconds: number): void {
    this.tokens = 0;
    this.pauseUntil = Date.now() + pauseSeconds * 1000;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    if (now < this.pauseUntil) {
      const waitMs = this.pauseUntil - now;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }
    const waitMs = (1 / this.config.refillRatePerSecond) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.config.refillRatePerSecond;
    this.tokens = Math.min(this.config.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }
}
