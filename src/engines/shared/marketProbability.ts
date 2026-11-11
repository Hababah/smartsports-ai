
export interface MarketOutcomeInput {
  id: string;
  name: string;
  decimalOdds: number;
}

export interface MarketImpliedOutcome {
  outcomeId: string;
  outcomeName: string;
  decimalOdds: number;
  rawImpliedProbability: number;
  normalizedProbability: number;
}

export interface MarketProbabilityResult {
  valid: boolean;
  overround: number;
  overroundPercentage: number;
  outcomes: MarketImpliedOutcome[];
  error?: string;
}

/**
 * Calculates bookmaker-implied probabilities and removes
 * the proportional bookmaker margin (overround).
 *
 * This is a market benchmark, NOT an independent prediction.
 */
export function calculateMarketProbabilities(
  outcomes: MarketOutcomeInput[],
): MarketProbabilityResult {
  const invalidResult = (error: string): MarketProbabilityResult => ({
    valid: false,
    overround: 0,
    overroundPercentage: 0,
    outcomes: [],
    error,
  });

  if (!Array.isArray(outcomes) || outcomes.length < 2) {
    return invalidResult(
      "At least two market outcomes are required.",
    );
  }

  const outcomeIds = new Set<string>();

  for (const outcome of outcomes) {
    if (
      !outcome.id?.trim() ||
      !outcome.name?.trim() ||
      !Number.isFinite(outcome.decimalOdds) ||
      outcome.decimalOdds <= 1
    ) {
      return invalidResult(
        "Every outcome must have an ID, name and valid decimal odds greater than 1.",
      );
    }

    if (outcomeIds.has(outcome.id)) {
      return invalidResult("Duplicate outcome IDs detected.");
    }

    outcomeIds.add(outcome.id);
  }

  const rawProbabilities = outcomes.map(
    (outcome) => 1 / outcome.decimalOdds,
  );

  const totalRawProbability = rawProbabilities.reduce(
    (sum, probability) => sum + probability,
    0,
  );

  if (
    !Number.isFinite(totalRawProbability) ||
    totalRawProbability <= 0
  ) {
    return invalidResult(
      "Unable to calculate the market probability distribution.",
    );
  }

  const overround = totalRawProbability - 1;

  const calculatedOutcomes = outcomes.map(
    (outcome, index): MarketImpliedOutcome => ({
      outcomeId: outcome.id,
      outcomeName: outcome.name,
      decimalOdds: outcome.decimalOdds,
      rawImpliedProbability: rawProbabilities[index],
      normalizedProbability:
        rawProbabilities[index] / totalRawProbability,
    }),
  );

  return {
    valid: true,
    overround,
    overroundPercentage: overround * 100,
    outcomes: calculatedOutcomes,
  };
}
