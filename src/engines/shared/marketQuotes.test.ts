
import test from "node:test";
import assert from "node:assert/strict";

import {
  validateMarketQuotePair,
  type MarketQuote,
} from "./marketQuotes";

const NOW = Date.parse("2026-11-11T09:00:00.000Z");

function createQuote(
  role: "reference" | "bookmaker",
  overrides: Partial<MarketQuote> = {},
): MarketQuote {
  return {
    sourceId: role === "reference" ? "reference-1" : "bookmaker-1",
    sourceName: role === "reference" ? "Reference Source" : "Bookmaker",
    sourceRole: role,
    fixtureId: "fixture-001",
    sport: "football",
    marketType: "match_winner",
    capturedAt: new Date(NOW - 60_000).toISOString(),
    status: "active",
    outcomes: [
      {
        outcomeKey: "home",
        name: "Home Win",
        decimalOdds: role === "reference" ? 1.80 : 1.90,
        status: "active",
      },
      {
        outcomeKey: "away",
        name: "Away Win",
        decimalOdds: role === "reference" ? 2.10 : 2.20,
        status: "active",
      },
    ],
    ...overrides,
  };
}

function validate(
  referenceOverrides: Partial<MarketQuote> = {},
  bookmakerOverrides: Partial<MarketQuote> = {},
  selectedOutcome = "home",
) {
  return validateMarketQuotePair(
    createQuote("reference", referenceOverrides),
    createQuote("bookmaker", bookmakerOverrides),
    selectedOutcome,
    NOW,
  );
}

test("accepts a valid independent reference and bookmaker quote pair", () => {
  const result = validate();

  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.offeredDecimalOdds, 1.90);
});

test("uses bookmaker odds as the offered price", () => {
  const result = validate(
    {},
    {
      outcomes: [
        {
          outcomeKey: "home",
          name: "Home Win",
          decimalOdds: 2.35,
          status: "active",
        },
        {
          outcomeKey: "away",
          name: "Away Win",
          decimalOdds: 2.20,
          status: "active",
        },
      ],
    },
  );

  assert.equal(result.valid, true);
  assert.equal(result.offeredDecimalOdds, 2.35);
});

test("rejects different fixture IDs", () => {
  const result = validate({}, { fixtureId: "fixture-999" });

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "QUOTE_FIXTURE_MISMATCH",
    ),
  );
});

test("rejects different sports", () => {
  const result = validate({}, { sport: "tennis" });

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "QUOTE_SPORT_MISMATCH",
    ),
  );
});

test("rejects different market types", () => {
  const result = validate(
    {},
    { marketType: "double_chance" },
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "QUOTE_MARKET_TYPE_MISMATCH",
    ),
  );
});

test("rejects different market lines", () => {
  const result = validate(
    { marketType: "over_under", line: 2.5 },
    { marketType: "over_under", line: 3.5 },
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "QUOTE_LINE_MISMATCH",
    ),
  );
});

test("rejects different market periods", () => {
  const result = validate(
    { period: "full time" },
    { period: "first half" },
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "QUOTE_PERIOD_MISMATCH",
    ),
  );
});

test("matches canonical outcome keys without case or whitespace sensitivity", () => {
  const result = validate(
    {
      outcomes: [
        {
          outcomeKey: " HOME ",
          name: "Home Win",
          decimalOdds: 1.80,
          status: "active",
        },
        {
          outcomeKey: "AWAY",
          name: "Away Win",
          decimalOdds: 2.10,
          status: "active",
        },
      ],
    },
    {
      outcomes: [
        {
          outcomeKey: "home",
          name: "Home Win",
          decimalOdds: 1.90,
          status: "active",
        },
        {
          outcomeKey: "away",
          name: "Away Win",
          decimalOdds: 2.20,
          status: "active",
        },
      ],
    },
    "home",
  );

  assert.equal(result.valid, true);
  assert.equal(result.offeredDecimalOdds, 1.90);
});

test("rejects a selected outcome missing from the reference quote", () => {
  const result = validate(
    {
      outcomes: [
        {
          outcomeKey: "away",
          name: "Away Win",
          decimalOdds: 2.10,
          status: "active",
        },
        {
          outcomeKey: "draw",
          name: "Draw",
          decimalOdds: 3.00,
          status: "active",
        },
      ],
    },
  );

  assert.equal(result.valid, false);
  assert.equal(result.offeredDecimalOdds, null);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "REFERENCE_OUTCOME_MISSING",
    ),
  );
});

test("rejects a selected outcome missing from the bookmaker quote", () => {
  const result = validate(
    {},
    {
      outcomes: [
        {
          outcomeKey: "away",
          name: "Away Win",
          decimalOdds: 2.20,
          status: "active",
        },
        {
          outcomeKey: "draw",
          name: "Draw",
          decimalOdds: 3.10,
          status: "active",
        },
      ],
    },
  );

  assert.equal(result.valid, false);
  assert.equal(result.offeredDecimalOdds, null);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "BOOKMAKER_OUTCOME_MISSING",
    ),
  );
});

test("rejects stale reference quotes", () => {
  const result = validate({
    capturedAt: new Date(NOW - 6 * 60_000).toISOString(),
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "STALE_QUOTE",
    ),
  );
});

test("rejects stale bookmaker quotes", () => {
  const result = validate(
    {},
    { capturedAt: new Date(NOW - 6 * 60_000).toISOString() },
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "STALE_QUOTE",
    ),
  );
});

test("rejects future quote timestamps", () => {
  const result = validate(
    {},
    { capturedAt: new Date(NOW + 60_000).toISOString() },
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "FUTURE_QUOTE_TIMESTAMP",
    ),
  );
});

test("rejects suspended markets", () => {
  const result = validate({}, { status: "suspended" });

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "QUOTE_NOT_ACTIVE",
    ),
  );
});

test("rejects inactive outcomes", () => {
  const result = validate(
    {},
    {
      outcomes: [
        {
          outcomeKey: "home",
          name: "Home Win",
          decimalOdds: 1.90,
          status: "suspended",
        },
        {
          outcomeKey: "away",
          name: "Away Win",
          decimalOdds: 2.20,
          status: "active",
        },
      ],
    },
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "QUOTE_OUTCOME_NOT_ACTIVE",
    ),
  );
});

test("rejects invalid decimal odds", () => {
  const result = validate(
    {},
    {
      outcomes: [
        {
          outcomeKey: "home",
          name: "Home Win",
          decimalOdds: 1,
          status: "active",
        },
        {
          outcomeKey: "away",
          name: "Away Win",
          decimalOdds: 2.20,
          status: "active",
        },
      ],
    },
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "INVALID_QUOTE_ODDS",
    ),
  );
});

test("rejects duplicate canonical outcome keys", () => {
  const result = validate(
    {},
    {
      outcomes: [
        {
          outcomeKey: "home",
          name: "Home Win",
          decimalOdds: 1.90,
          status: "active",
        },
        {
          outcomeKey: " HOME ",
          name: "Home Alternative",
          decimalOdds: 2.20,
          status: "active",
        },
      ],
    },
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "DUPLICATE_CANONICAL_OUTCOME",
    ),
  );
});

test("rejects incorrect source roles", () => {
  const result = validate(
    {},
    { sourceRole: "reference" },
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "SOURCE_ROLE_MISMATCH",
    ),
  );
});

test("rejects missing source identity", () => {
  const result = validate(
    {},
    { sourceId: "", sourceName: "" },
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "SOURCE_IDENTITY_MISSING",
    ),
  );
});


test("rejects invalid market lines", () => {
  const result = validate(
    { marketType: "over_under", line: Number.NaN },
    { marketType: "over_under", line: 2.5 },
  );

  assert.equal(result.valid, false);

  assert.ok(
    result.issues.some(
      (issue) => issue.code === "INVALID_MARKET_LINE",
    ),
  );
});


test("rejects an empty selected outcome key", () => {
  const result = validate({}, {}, " ");

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "SELECTED_OUTCOME_KEY_MISSING",
    ),
  );
});

test("rejects an invalid quote age policy without crashing", () => {
  const result = validateMarketQuotePair(
    createQuote("reference"),
    createQuote("bookmaker"),
    "home",
    NOW,
    { maximumAgeMs: Number.NaN },
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "INVALID_QUOTE_POLICY",
    ),
  );
});
