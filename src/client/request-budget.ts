import { TgcError } from "../types/errors.js";

export interface RequestBudgetConfig {
  maxReadRequests: number;
  maxWriteRequests: number;
}

const DEFAULT_CONFIG: RequestBudgetConfig = {
  maxReadRequests: 500,
  maxWriteRequests: 200,
};

export class RequestBudget {
  private readCount = 0;
  private writeCount = 0;
  private readonly config: RequestBudgetConfig;

  constructor(config?: Partial<RequestBudgetConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  check(method: string): void {
    const isWrite = method !== "GET";
    if (isWrite) {
      if (this.writeCount >= this.config.maxWriteRequests) {
        throw new TgcError(
          `Session write request budget exceeded (${this.config.maxWriteRequests} writes). ` +
            `Call \`authenticate\` to start a new session and reset the budget.`,
          "rate_limit",
        );
      }
      this.writeCount++;
    } else {
      if (this.readCount >= this.config.maxReadRequests) {
        throw new TgcError(
          `Session read request budget exceeded (${this.config.maxReadRequests} reads). ` +
            `Call \`authenticate\` to start a new session and reset the budget.`,
          "rate_limit",
        );
      }
      this.readCount++;
    }
  }

  reset(): void {
    this.readCount = 0;
    this.writeCount = 0;
  }

  get counts(): { reads: number; writes: number } {
    return { reads: this.readCount, writes: this.writeCount };
  }
}
