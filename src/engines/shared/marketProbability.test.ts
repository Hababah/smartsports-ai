
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  calculateMarketProbabilities,
} from "./marketProbability";

describe("market probability calculation", () => {
  it("normalizes a three-outcome market to 100%", () => {
    const result = calculateMarketProbabilities([
      { id: "home", name: "Home", decimalOdds: 2.0 },
      { id: "draw", name: "Draw", decimalOdds: 3.5 },
      { id: "away", name: "Away", decimalOdds: 4.0 },
    ]);

    assert.equal(result.valid, true);

    const total = result.outcomes.reduce(
      (sum, outcome) =>
        sum + outcome.normalizedProbability,
      0,
    );

    assert.ok(Math.abs(total - 1) < 1e-10);
  });

  it("calculates bookmaker overround correctly", () => {
    const result = calculateMarketProbabilities([
      { id: "home", name: "Home", decimalOdds: 2.0 },
      { id: "draw", name: "Draw", decimalOdds: 3.5 },
      { id: "away", name: "Away", decimalOdds: 4.0 },
    ]);

    assert.ok(
      Math.abs(result.overround - 0.0357142857142858) < 1e-10,
    );
  });

  it("returns the correct normalized probability", () => {
    const result = calculateMarketProbabilities([
      { id: "yes", name: "Yes", decimalOdds: 2.0 },
      { id: "no", name: "No", decimalOdds: 2.0 },
    ]);

    assert.equal(
      result.outcomes[0].normalizedProbability,
      0.5,
    );

    assert.equal(
      result.outcomes[1].normalizedProbability,
      0.5,
    );
  });

  it("rejects markets with fewer than two outcomes", () => {
    const result = calculateMarketProbabilities([
      { id: "home", name: "Home", decimalOdds: 2.0 },
    ]);

    assert.equal(result.valid, false);
  });

  it("rejects invalid decimal odds", () => {
    const result = calculateMarketProbabilities([
      { id: "home", name: "Home", decimalOdds: 1 },
      { id: "away", name: "Away", decimalOdds: 2.0 },
    ]);

    assert.equal(result.valid, false);
  });

  it("rejects duplicate outcome IDs", () => {
    const result = calculateMarketProbabilities([
      { id: "same", name: "Home", decimalOdds: 2.0 },
      { id: "same", name: "Away", decimalOdds: 3.0 },
    ]);

    assert.equal(result.valid, false);
  });

  it("does not incorrectly reject an underround market", () => {
    const result = calculateMarketProbabilities([
      { id: "home", name: "Home", decimalOdds: 2.2 },
      { id: "away", name: "Away", decimalOdds: 2.2 },
    ]);

    assert.equal(result.valid, true);
    assert.ok(result.overround < 0);
  });
});
