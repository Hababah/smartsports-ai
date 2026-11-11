
import type {
  SelectionCandidate,
} from "../types/sports";

export const TEST_GENERATION_TIME = "2026-11-11T05:00:00.000Z";

export function createCandidate(
  index: number,
  options: {
    odds?: number;
    marketType?: "match_winner" | "over_under";
    outcomeName?: string;
    confidence?: number;
    lowerProbability?: number;
    quality?: number;
    fixtureId?: string;
  } = {},
): SelectionCandidate {
  const fixtureId = options.fixtureId ?? `fixture-${index}`;
  const marketId = `market-${index}`;
  const outcomeId = `outcome-${index}`;

  const odds = options.odds ?? 2;
  const marketType = options.marketType ?? "match_winner";

  const fixture = {
    id: fixtureId,
    providerId: `provider-${index}`,
    providerName: "Test Provider",
    sport: "football" as const,
    competition: {
      id: "competition-1",
      name: "Test League",
      country: "Nigeria",
      sport: "football" as const,
    },
    home: {
      id: `home-${index}`,
      name: `Home Team ${index}`,
    },
    away: {
      id: `away-${index}`,
      name: `Away Team ${index}`,
    },
    startTime: "2026-11-12T15:00:00.000Z",
    timezone: "UTC",
    status: "scheduled" as const,
    dataStatus: "verified" as const,
    lastUpdated: TEST_GENERATION_TIME,
  };

  const outcome = {
    id: outcomeId,
    name: options.outcomeName ?? "Home",
    decimalOdds: odds,
    status: "active" as const,
    lastUpdated: TEST_GENERATION_TIME,
  };

  const market = {
    id: marketId,
    providerMarketId: `provider-market-${index}`,
    fixtureId,
    sport: "football" as const,
    type: marketType,
    name: marketType === "over_under" ? "Over/Under" : "Match Winner",
    ...(marketType === "over_under" ? { line: 2.5 } : {}),
    outcomes: [outcome],
    status: "active" as const,
    lastUpdated: TEST_GENERATION_TIME,
  };

  const prediction = {
    id: `prediction-${index}`,
    fixtureId,
    marketId,
    outcomeId,
    estimatedProbability: 0.80,
    lowerProbabilityBound: options.lowerProbability ?? 0.70,
    upperProbabilityBound: 0.90,
    decimalOdds: odds,
    estimatedExpectedValue: 0.60,
    confidence: options.confidence ?? 0.90,
    quality: {
      status: "verified" as const,
      score: options.quality ?? 90,
      missingFields: [],
      warnings: [],
      sourceCount: 3,
      lastVerifiedAt: TEST_GENERATION_TIME,
    },
    explanation: ["Test prediction with verified sample data."],
    modelVersion: "test-model-1",
    generatedAt: TEST_GENERATION_TIME,
    expiresAt: "2026-11-12T14:00:00.000Z",
  };

  return {
    id: `candidate-${index}`,
    fixture,
    market,
    outcome,
    prediction,
    eligible: true,
    rejectionReasons: [],
    duplicateKey: `${fixtureId}|${marketType}|${outcomeId}`,
  };
}
