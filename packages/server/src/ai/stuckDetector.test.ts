import { describe, expect, it } from "vitest";
import { calculateStuckScore } from "./stuckDetector";

describe("calculateStuckScore", () => {
  it("keeps active students below the stuck threshold", () => {
    expect(calculateStuckScore(4_000, 180, 0, false)).toBeLessThan(65);
  });

  it("flags long idle sparse work", () => {
    expect(calculateStuckScore(120_000, 12, 0, false)).toBeGreaterThanOrEqual(65);
  });

  it("prioritizes explicit help requests", () => {
    expect(calculateStuckScore(0, 500, 0, true)).toBe(100);
  });
});
