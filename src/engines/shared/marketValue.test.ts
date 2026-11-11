
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateMarketProbabilities } from "./marketProbability";
import { assessMarketValue } from "./marketValue";

const market = calculateMarketProbabilities([
  { id: "home", name: "Home", decimalOdds: 2 },
  { id: "away", name: "Away", decimalOdds: 2 },
]);

describe("market value assessment", () => {
  it("identifies a selection with positive conservative value", () => {
    const result = assessMarketValue({
      market,
      outcomeId: "home",
      modelProbability: 0.65,
      lowerProbabilityBound: 0.60,
      upperProbabilityBound: 0.70,
      offeredDecimalOdds: 2,
    });

    assert.equal(result.status, "value_candidate");
    assert.ok(result.conservativeExpectedValue > 0);
    assert.ok(result.conservativeProbabilityEdge >= 0.02);
  });

  it("uses bookmaker offered odds independently of reference market odds", () => {
    const result = assessMarketValue({
      market,
      outcomeId: "home",
      modelProbability: 0.65,
      lowerProbabilityBound: 0.60,
      upperProbabilityBound: 0.70,
      offeredDecimalOdds: 2.2,
    });

    assert.equal(result.status, "value_candidate");
    assert.equal(result.marketProbability, 0.5);
    assert.ok(
  Math.abs(result.expectedValue - 0.43) < 0.000001,
);
    assert.ok(
      Math.abs(result.conservativeExpectedValue - 0.32) < 0.000001,
    );
  });

  it("rejects a high-probability selection with negative conservative value", () => {
    const favouriteMarket = calculateMarketProbabilities([
      { id: "home", name: "Home", decimalOdds: 1.5 },
      { id: "away", name: "Away", decimalOdds: 3 },
    ]);

    const result = assessMarketValue({
      market: favouriteMarket,
      outcomeId: "home",
      modelProbability: 0.75,
      lowerProbabilityBound: 0.65,
      upperProbabilityBound: 0.80,
      offeredDecimalOdds: 1.5,
    });

    assert.equal(result.status, "no_value");
    assert.ok(result.conservativeExpectedValue < 0);
  });

  it("rejects a selection that misses the minimum probability edge", () => {
    const result = assessMarketValue({
      market,
      outcomeId: "home",
      modelProbability: 0.53,
      lowerProbabilityBound: 0.51,
      upperProbabilityBound: 0.60,
      offeredDecimalOdds: 2,
      minimumProbabilityEdge: 0.02,
    });

    assert.equal(result.status, "no_value");
  });

  it("rejects invalid offered bookmaker odds", () => {
    const result = assessMarketValue({
      market,
      outcomeId: "home",
      modelProbability: 0.65,
      lowerProbabilityBound: 0.60,
      upperProbabilityBound: 0.70,
      offeredDecimalOdds: 1,
    });

    assert.equal(result.status, "unassessed");
  });

  it("rejects an outcome that does not exist", () => {
    const result = assessMarketValue({
      market,
      outcomeId: "missing",
      modelProbability: 0.65,
      lowerProbabilityBound: 0.60,
      upperProbabilityBound: 0.70,
      offeredDecimalOdds: 2,
    });

    assert.equal(result.status, "unassessed");
  });

  it("rejects invalid probability bounds", () => {
    const result = assessMarketValue({
      market,
      outcomeId: "home",
      modelProbability: 0.55,
      lowerProbabilityBound: 0.60,
      upperProbabilityBound: 0.70,
      offeredDecimalOdds: 2,
    });

    assert.equal(result.status, "unassessed");
  });

  it("rejects invalid market calculations", () => {
    const invalidMarket = calculateMarketProbabilities([]);

    const result = assessMarketValue({
      market: invalidMarket,
      outcomeId: "home",
      modelProbability: 0.65,
      lowerProbabilityBound: 0.60,
      upperProbabilityBound: 0.70,
      offeredDecimalOdds: 2,
    });

    assert.equal(result.status, "unassessed");
  });

  it("rejects invalid minimum edge settings", () => {
    const result = assessMarketValue({
      market,
      outcomeId: "home",
      modelProbability: 0.65,
      lowerProbabilityBound: 0.60,
      upperProbabilityBound: 0.70,
      offeredDecimalOdds: 2,
      minimumProbabilityEdge: 1,
    });

    assert.equal(result.status, "unassessed");
  });

  it("reports bookmaker overround", () => {
    const result = assessMarketValue({
      market,
      outcomeId: "home",
      modelProbability: 0.65,
      lowerProbabilityBound: 0.60,
      upperProbabilityBound: 0.70,
      offeredDecimalOdds: 2,
    });

    assert.equal(result.overroundPercentage, 0);
  });
});
