
import test from "node:test";
import assert from "node:assert/strict";

import type {
  SelectionCandidate,
} from "../../types/sports";

import type {
  MarketQuote,
} from "./marketQuotes";

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

function createQuotePair(
  candidate: SelectionCandidate,
  options: {
    referenceSelectedOdds?: number;
    referenceOpposingOdds?: number;
    bookmakerSelectedOdds?: number;
    referenceAgeMs?: number;
    bookmakerAgeMs?: number;
  } = {},
): {
  reference: MarketQuote;
  bookmaker: MarketQuote;
} {
  const now = Date.now();

  const reference: MarketQuote = {
    sourceId: "reference-source",
    sourceName: "Independent Reference",
    sourceRole: "reference",
    fixtureId: candidate.fixture.id,
    sport: candidate.fixture.sport,
    marketType: candidate.market.type,
    line: candidate.market.line,
    capturedAt: new Date(
      now - (options.referenceAgeMs ?? 30_000),
    ).toISOString(),
    status: "active",
    outcomes: [
      {
        outcomeKey: "home-win",
        name: "Home Win",
        decimalOdds: options.referenceSelectedOdds ?? 2.5,
        status: "active",
      },
      {
        outcomeKey: "away-win",
        name: "Away Win",
        decimalOdds: options.referenceOpposingOdds ?? 1.5,
        status: "active",
      },
    ],
  };

  const bookmaker: MarketQuote = {
    sourceId: "bookmaker-source",
    sourceName: "Test Bookmaker",
    sourceRole: "bookmaker",
    fixtureId: candidate.fixture.id,
    sport: candidate.fixture.sport,
    marketType: candidate.market.type,
    line: candidate.market.line,
    capturedAt: new Date(
      now - (options.bookmakerAgeMs ?? 30_000),
    ).toISOString(),
    status: "active",
    outcomes: [
      {
        outcomeKey: "home-win",
        name: "Home Win",
        decimalOdds:
          options.bookmakerSelectedOdds ??
          candidate.outcome.decimalOdds,
        status: "active",
      },
      {
        outcomeKey: "away-win",
        name: "Away Win",
        decimalOdds: candidate.market.outcomes[1].decimalOdds,
        status: "active",
      },
    ],
  };

  return { reference, bookmaker };
}

function assess(
  candidate: SelectionCandidate,
  options: {
    referenceSelectedOdds?: number;
    referenceOpposingOdds?: number;
    bookmakerSelectedOdds?: number;
    referenceAgeMs?: number;
    bookmakerAgeMs?: number;
  } = {},
  policy?: Parameters<typeof assessSelectionIntelligence>[4],
) {
  const quotes = createQuotePair(candidate, options);

  return assessSelectionIntelligence(
    candidate,
    quotes.reference,
    quotes.bookmaker,
    "home-win",
    policy,
  );
}

test("approves a valid selection using independent reference and bookmaker quotes", () => {
  const candidate = createCandidate();

  const result = assess(candidate);

  assert.equal(result.decision, "approved");
  assert.equal(result.eligibleForTicket, true);
  assert.equal(result.validation.valid, true);
  assert.equal(result.quoteValidation?.valid, true);
  assert.equal(result.value?.status, "value_candidate");
  assert.equal(result.risk?.decision, "approved");
  assert.equal(result.value?.marketProbability, 0.375);
  assert.ok(
  Math.abs((result.value?.expectedValue ?? 0) - 0.30) < 1e-10,
);
  assert.equal(result.rejectionReasons.length, 0);
});

test("uses bookmaker odds for expected value, not reference odds", () => {
  const candidate = createCandidate({
    selectedOdds: 2.4,
  });

  const result = assess(candidate);

  assert.equal(result.decision, "approved");
  assert.equal(result.value?.expectedValue, 0.56);
  assert.ok(
  Math.abs(
    (result.value?.conservativeExpectedValue ?? 0) - 0.44,
  ) < 1e-10,
);
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

  const result = assess(candidate);

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

  const result = assess(candidate);

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

  const result = assess(candidate);

  assert.equal(result.decision, "rejected");
  assert.equal(result.eligibleForTicket, false);
  assert.equal(result.validation.valid, false);
  assert.ok(result.rejectionReasons.length > 0);
});

test("returns unassessed when the reference quote is stale", () => {
  const candidate = createCandidate();

  const result = assess(candidate, {
    referenceAgeMs: 6 * 60 * 1000,
  });

  assert.equal(result.decision, "unassessed");
  assert.equal(result.eligibleForTicket, false);
  assert.equal(result.quoteValidation?.valid, false);
  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("stale"),
    ),
  );
});

test("returns unassessed when reference and bookmaker fixtures differ", () => {
  const candidate = createCandidate();
  const quotes = createQuotePair(candidate);

  quotes.bookmaker.fixtureId = "another-fixture";

  const result = assessSelectionIntelligence(
    candidate,
    quotes.reference,
    quotes.bookmaker,
    "home-win",
  );

  assert.equal(result.decision, "unassessed");
  assert.equal(result.eligibleForTicket, false);
  assert.equal(result.quoteValidation?.valid, false);
});

test("returns unassessed when quote market does not match candidate market", () => {
  const candidate = createCandidate();
  const quotes = createQuotePair(candidate);

  quotes.reference.marketType = "over_under";

  const result = assessSelectionIntelligence(
    candidate,
    quotes.reference,
    quotes.bookmaker,
    "home-win",
  );

  assert.equal(result.decision, "unassessed");
  assert.equal(result.eligibleForTicket, false);
});

test("rejects when bookmaker odds differ from candidate odds", () => {
  const candidate = createCandidate();

  const result = assess(candidate, {
    bookmakerSelectedOdds: 2.2,
  });

  assert.equal(result.decision, "rejected");
  assert.equal(result.eligibleForTicket, false);
  assert.ok(
    result.rejectionReasons.some((reason) =>
      reason.includes("bookmaker quote"),
    ),
  );
});

test("returns unassessed when selected outcome is not the candidate outcome", () => {
  const candidate = createCandidate();

  const quotes = createQuotePair(candidate);

  const result = assessSelectionIntelligence(
    candidate,
    quotes.reference,
    quotes.bookmaker,
    "away-win",
  );

  assert.equal(result.decision, "unassessed");
  assert.equal(result.eligibleForTicket, false);
});

test("returns unassessed for invalid value policy settings", () => {
  const candidate = createCandidate();

  const result = assess(candidate, {}, {
    riskPolicy: {
      favouriteOddsCeiling: 1.70,
      minimumQualityScore: 70,
      minimumConfidence: 0.65,
      minimumLowerProbability: 0.40,
      maximumNegativeMarketGap: 0.05,
    },
    minimumProbabilityEdge: 1,
    quotePolicy: {
      maximumAgeMs: 5 * 60 * 1000,
    },
  });

  assert.equal(result.decision, "unassessed");
  assert.equal(result.eligibleForTicket, false);
  assert.equal(result.value?.status, "unassessed");
});
