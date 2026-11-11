
import test from "node:test";
import assert from "node:assert/strict";

import type {
  SelectionCandidate,
} from "../../types/sports";

import {
  assessSelectionIntelligence,
} from "./selectionIntelligence";

function createCandidate(
  options: {
    selectedOdds?: number;
    opposingOdds?: number;
    probability?: number;
    lowerBound?: number;
    confidence?: number;
    sourceCount?: number;
  } = {},
): SelectionCandidate {
  const now = Date.now();

  const selectedOdds = options.selectedOdds ?? 2.0;
  const opposingOdds = options.opposingOdds ?? 1.9;
  const probability = options.probability ?? 0.65;
  const lowerBound = options.lowerBound ?? 0.60;

  const fixture = {
    id: "fixture-1",
    providerId: "provider-fixture-1",
    providerName: "Test Provider",
    sport: "football" as const,
    competition: {
      id: "competition-1",
      name: "Test League",
      sport: "football" as const,
      country: "Test Country",
    },
    home: {
      id: "team-1",
      name: "Home Team",
    },
    away: {
      id: "team-2",
      name: "Away Team",
    },
    startTime: new Date(now + 3_600_000).toISOString(),
    timezone: "Africa/Lagos",
    status: "scheduled" as const,
    dataStatus: "verified" as const,
    lastUpdated: new Date(now - 60_000).toISOString(),
  };

  const market = {
    id: "market-1",
    providerMarketId: "provider-market-1",
    fixtureId: fixture.id,
    sport: fixture.sport,
    type: "match_winner" as const,
    name: "Match Winner",
    outcomes: [
      {
        id: "home-win",
        name: "Home Win",
        decimalOdds: selectedOdds,
        status: "active" as const,
        lastUpdated: new Date(now - 30_000).toISOString(),
      },
      {
        id: "away-win",
        name: "Away Win",
        decimalOdds: opposingOdds,
        status: "active" as const,
        lastUpdated: new Date(now - 30_000).toISOString(),
      },
    ],
    status: "active" as const,
    lastUpdated: new Date(now - 30_000).toISOString(),
  };

  const outcome = market.outcomes[0];

  const prediction = {
    id: "prediction-1",
    fixtureId: fixture.id,
    marketId: market.id,
    outcomeId: outcome.id,
    estimatedProbability: probability,
    lowerProbabilityBound: lowerBound,
    upperProbabilityBound: Math.min(
      1,
      Math.max(probability, 0.80),
    ),
    decimalOdds: selectedOdds,
    estimatedExpectedValue:
      probability * selectedOdds - 1,
    confidence: options.confidence ?? 0.90,
    quality: {
      status: "verified" as const,
      score: 90,
      missingFields: [],
      warnings: [],
      sourceCount: options.sourceCount ?? 3,
      lastVerifiedAt: new Date(now - 30_000).toISOString(),
    },
    explanation: ["Test prediction."],
    modelVersion: "test-model-1.0",
    generatedAt: new Date(now - 10_000).toISOString(),
    expiresAt: new Date(now + 300_000).toISOString(),
  };

  return {
    id: "candidate-1",
    fixture,
    market,
    outcome,
    prediction,
    eligible: true,
    rejectionReasons: [],
    duplicateKey: "fixture-1-home-win",
  };
}

test("approves a valid selection with conservative market value", () => {
  const candidate = createCandidate();

  const result = assessSelectionIntelligence(
    candidate,
  );

  assert.equal(result.decision, "approved");
  assert.equal(result.eligibleForTicket, true);
  assert.equal(result.validation.valid, true);
  assert.equal(result.value?.status, "value_candidate");
  assert.equal(result.risk?.decision, "approved");
  assert.equal(result.rejectionReasons.length, 0);
});

test("returns caution when meaningful risk warnings exist", () => {
  const candidate = createCandidate({
    selectedOdds: 3,
    opposingOdds: 1.5,
    probability: 0.55,
    lowerBound: 0.40,
    confidence: 0.50,
    sourceCount: 1,
  });

  const result = assessSelectionIntelligence(
    candidate,
  );

  assert.equal(result.decision, "caution");
  assert.equal(result.eligibleForTicket, false);
  assert.equal(result.value?.status, "value_candidate");
  assert.equal(result.risk?.decision, "caution");
  assert.ok(result.warnings.length > 0);
});

test("rejects a selection without sufficient conservative value", () => {
  const candidate = createCandidate({
    selectedOdds: 2,
    opposingOdds: 2,
    probability: 0.55,
    lowerBound: 0.48,
  });

  const result = assessSelectionIntelligence(
    candidate,
  );

  assert.equal(result.decision, "rejected");
  assert.equal(result.eligibleForTicket, false);
  assert.equal(result.value?.status, "no_value");
  assert.ok(result.rejectionReasons.length > 0);
});

test("rejects an invalid candidate", () => {
  const candidate = createCandidate();

  candidate.eligible = false;
  candidate.rejectionReasons = [
    "Candidate failed an upstream eligibility check.",
  ];

  const result = assessSelectionIntelligence(
    candidate,
  );

  assert.equal(result.decision, "rejected");
  assert.equal(result.eligibleForTicket, false);
  assert.equal(result.validation.valid, false);
  assert.ok(result.rejectionReasons.length > 0);
});

test("returns unassessed for invalid value policy settings", () => {
  const candidate = createCandidate();

  const result = assessSelectionIntelligence(
    candidate,
    {
      riskPolicy: {
        favouriteOddsCeiling: 1.70,
        minimumQualityScore: 70,
        minimumConfidence: 0.65,
        minimumLowerProbability: 0.40,
        maximumNegativeMarketGap: 0.05,
      },
      minimumProbabilityEdge: 1,
    },
  );

  assert.equal(result.decision, "unassessed");
  assert.equal(result.eligibleForTicket, false);
  assert.equal(result.value?.status, "unassessed");
});
