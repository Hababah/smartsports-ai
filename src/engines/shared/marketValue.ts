
import type { MarketProbabilityResult } from "./marketProbability";

export type MarketValueStatus =
  | "value_candidate"
  | "no_value"
  | "unassessed";

export interface MarketValueInput {
  market: MarketProbabilityResult;
  outcomeId: string;
  modelProbability: number;
  lowerProbabilityBound: number;
  upperProbabilityBound: number;
  offeredDecimalOdds: number;
  minimumProbabilityEdge?: number;
}

export interface MarketValueAssessment {
  status: MarketValueStatus;
  marketProbability: number;
  rawImpliedProbability: number;
  probabilityEdge: number;
  conservativeProbabilityEdge: number;
  expectedValue: number;
  conservativeExpectedValue: number;
  overroundPercentage: number;
  warnings: string[];
}

function unassessed(warning: string): MarketValueAssessment {
  return {
    status: "unassessed",
    marketProbability: 0,
    rawImpliedProbability: 0,
    probabilityEdge: 0,
    conservativeProbabilityEdge: 0,
    expectedValue: 0,
    conservativeExpectedValue: 0,
    overroundPercentage: 0,
    warnings: [warning],
  };
}

export function assessMarketValue(
  input: MarketValueInput,
): MarketValueAssessment {
  const {
    market,
    outcomeId,
    modelProbability,
    lowerProbabilityBound,
    upperProbabilityBound,
    offeredDecimalOdds,
    minimumProbabilityEdge = 0.02,
  } = input;

  if (!market.valid) {
    return unassessed("Market probability calculation is invalid.");
  }

  if (
    !Number.isFinite(modelProbability) ||
    !Number.isFinite(lowerProbabilityBound) ||
    !Number.isFinite(upperProbabilityBound) ||
    lowerProbabilityBound < 0 ||
    upperProbabilityBound > 1 ||
    lowerProbabilityBound > modelProbability ||
    modelProbability > upperProbabilityBound
  ) {
    return unassessed("Model probability bounds are invalid.");
  }

  if (
    !Number.isFinite(offeredDecimalOdds) ||
    offeredDecimalOdds <= 1
  ) {
    return unassessed("Offered decimal odds are invalid.");
  }

  if (
    !Number.isFinite(minimumProbabilityEdge) ||
    minimumProbabilityEdge < 0 ||
    minimumProbabilityEdge >= 1
  ) {
    return unassessed("Minimum probability edge setting is invalid.");
  }

  const outcome = market.outcomes.find(
    (item) => item.outcomeId === outcomeId,
  );

  if (!outcome) {
    return unassessed("Selected outcome was not found in the market.");
  }

  if (
    Math.abs(outcome.decimalOdds - offeredDecimalOdds) > 0.000001
  ) {
    return unassessed(
      "Offered odds do not match the odds used in the market calculation.",
    );
  }

  const marketProbability = outcome.normalizedProbability;
  const rawImpliedProbability = outcome.rawImpliedProbability;

  if (
    !Number.isFinite(marketProbability) ||
    marketProbability < 0 ||
    marketProbability > 1 ||
    !Number.isFinite(rawImpliedProbability) ||
    rawImpliedProbability <= 0
  ) {
    return unassessed("Market probability values are invalid.");
  }

  const probabilityEdge =
    modelProbability - marketProbability;

  const conservativeProbabilityEdge =
    lowerProbabilityBound - marketProbability;

  const expectedValue =
    modelProbability * offeredDecimalOdds - 1;

  const conservativeExpectedValue =
    lowerProbabilityBound * offeredDecimalOdds - 1;

  const warnings: string[] = [];

  if (market.overround > 0) {
    warnings.push(
      "Market probabilities have been normalized to account for bookmaker overround.",
    );
  } else if (market.overround < 0) {
    warnings.push(
      "This market has an underround. Verify the source and market completeness.",
    );
  }

  if (conservativeExpectedValue <= 0) {
    warnings.push(
      "The conservative probability estimate does not produce positive expected value at the offered odds.",
    );
  }

  if (conservativeProbabilityEdge < minimumProbabilityEdge) {
    warnings.push(
      "The conservative probability edge does not meet the configured minimum.",
    );
  }

  const status: MarketValueStatus =
    conservativeExpectedValue > 0 &&
    conservativeProbabilityEdge >= minimumProbabilityEdge
      ? "value_candidate"
      : "no_value";

  return {
    status,
    marketProbability,
    rawImpliedProbability,
    probabilityEdge,
    conservativeProbabilityEdge,
    expectedValue,
    conservativeExpectedValue,
    overroundPercentage: market.overroundPercentage,
    warnings,
  };
}
