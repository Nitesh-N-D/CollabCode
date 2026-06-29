import { describe, expect, it } from "vitest";
import { calculateStuckScore, computeRiskTrend } from "./stuckDetector";

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

  it("forecasts rising risk before the stuck threshold", () => {
    expect(computeRiskTrend([12, 18, 25, 33, 42])).toBe("rising");
    expect(computeRiskTrend([70, 62, 52, 40, 30])).toBe("falling");
    expect(computeRiskTrend([12, 13, 12, 14, 13])).toBe("stable");
  });
});
