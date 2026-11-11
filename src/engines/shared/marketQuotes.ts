
import type { MarketStatus, MarketType, Sport } from "../../types/sports";

export type MarketSourceRole = "reference" | "bookmaker";

export interface MarketQuoteOutcome {
  outcomeKey: string;
  name: string;
  decimalOdds: number;
  status: MarketStatus;
}

export interface MarketQuote {
  sourceId: string;
  sourceName: string;
  sourceRole: MarketSourceRole;

  fixtureId: string;
  sport: Sport;

  marketType: MarketType;
  line?: number;
  period?: string;

  capturedAt: string;
  status: MarketStatus;

  outcomes: MarketQuoteOutcome[];
}

export interface MarketQuotePolicy {
  maximumAgeMs: number;
}

export interface MarketQuoteValidationIssue {
  code: string;
  message: string;
}

export interface MarketQuotePairValidation {
  valid: boolean;
  issues: MarketQuoteValidationIssue[];
  referenceQuote: MarketQuote;
  bookmakerQuote: MarketQuote;
  selectedOutcomeKey: string;
  offeredDecimalOdds: number | null;
}

export const DEFAULT_MARKET_QUOTE_POLICY: MarketQuotePolicy = {
  maximumAgeMs: 5 * 60 * 1000,
};

const normalizeKey = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

function validateSingleQuote(
  quote: MarketQuote,
  expectedRole: MarketSourceRole,
  now: number,
  policy: MarketQuotePolicy,
  issues: MarketQuoteValidationIssue[],
): void {
  if (!quote.sourceId.trim() || !quote.sourceName.trim()) {
    issues.push({
      code: "SOURCE_IDENTITY_MISSING",
      message: `${expectedRole} source identity is missing.`,
    });
  }

  if (quote.sourceRole !== expectedRole) {
    issues.push({
      code: "SOURCE_ROLE_MISMATCH",
      message: `Expected a ${expectedRole} quote.`,
    });
  }

  if (!quote.fixtureId.trim()) {
    issues.push({
      code: "QUOTE_FIXTURE_MISSING",
      message: "Quote fixture ID is missing.",
    });
  }

  if (quote.status !== "active") {
    issues.push({
      code: "QUOTE_NOT_ACTIVE",
      message: `${expectedRole} market is not active.`,
    });
  }


  if (
    quote.line !== undefined &&
    !Number.isFinite(quote.line)
  ) {
    issues.push({
      code: "INVALID_MARKET_LINE",
      message: `${expectedRole} market line is invalid.`,
    });
  }

  const timestamp = Date.parse(quote.capturedAt);

  if (!Number.isFinite(timestamp)) {
    issues.push({
      code: "INVALID_QUOTE_TIMESTAMP",
      message: `${expectedRole} quote timestamp is invalid.`,
    });
  
    } else if (
      !policy ||
      !Number.isFinite(policy.maximumAgeMs) ||
      policy.maximumAgeMs < 0
    ) {
      // Invalid policy is reported by the pair validator.
      // Skip age comparison rather than crashing.
    } else {
      const age = now - timestamp;

      if (age < 0) {
        issues.push({
          code: "FUTURE_QUOTE_TIMESTAMP",
          message: `${expectedRole} quote timestamp is in the future.`,
        });
      } else if (age > policy.maximumAgeMs) {
        issues.push({
          code: "STALE_QUOTE",
          message: `${expectedRole} quote is stale.`,
        });
      }
    }


  if (!Array.isArray(quote.outcomes) || quote.outcomes.length < 2) {
    issues.push({
      code: "INSUFFICIENT_QUOTE_OUTCOMES",
      message: `${expectedRole} quote must contain at least two outcomes.`,
    });

    return;
  }

  const seen = new Set<string>();

  for (const outcome of quote.outcomes) {
    const key = normalizeKey(outcome.outcomeKey);

    if (!key || !outcome.name.trim()) {
      issues.push({
        code: "INVALID_QUOTE_OUTCOME",
        message: `${expectedRole} quote contains an incomplete outcome.`,
      });
      continue;
    }

    if (seen.has(key)) {
      issues.push({
        code: "DUPLICATE_CANONICAL_OUTCOME",
        message: `${expectedRole} quote contains duplicate outcome keys.`,
      });
    }

    seen.add(key);

    if (
      !Number.isFinite(outcome.decimalOdds) ||
      outcome.decimalOdds <= 1
    ) {
      issues.push({
        code: "INVALID_QUOTE_ODDS",
        message: `${expectedRole} quote contains invalid odds.`,
      });
    }

    if (outcome.status !== "active") {
      issues.push({
        code: "QUOTE_OUTCOME_NOT_ACTIVE",
        message: `${expectedRole} quote contains an inactive outcome.`,
      });
    }
  }
}

export function validateMarketQuotePair(
  referenceQuote: MarketQuote,
  bookmakerQuote: MarketQuote,
  selectedOutcomeKey: string,
  now = Date.now(),
  policy: MarketQuotePolicy = DEFAULT_MARKET_QUOTE_POLICY,
): MarketQuotePairValidation {
  const issues: MarketQuoteValidationIssue[] = [];

  if (
    !Number.isFinite(policy.maximumAgeMs) ||
    policy.maximumAgeMs < 0
  ) {
    issues.push({
      code: "INVALID_QUOTE_POLICY",
      message: "Maximum quote age must be a non-negative finite number.",
    });
  }

  if (!selectedOutcomeKey.trim()) {
    issues.push({
      code: "SELECTED_OUTCOME_KEY_MISSING",
      message: "Selected canonical outcome key is missing.",
    });
  }

  validateSingleQuote(
    referenceQuote,
    "reference",
    now,
    policy,
    issues,
  );

  validateSingleQuote(
    bookmakerQuote,
    "bookmaker",
    now,
    policy,
    issues,
  );

  if (referenceQuote.fixtureId !== bookmakerQuote.fixtureId) {
    issues.push({
      code: "QUOTE_FIXTURE_MISMATCH",
      message: "Reference and bookmaker quotes belong to different fixtures.",
    });
  }

  if (referenceQuote.sport !== bookmakerQuote.sport) {
    issues.push({
      code: "QUOTE_SPORT_MISMATCH",
      message: "Reference and bookmaker sports do not match.",
    });
  }

  if (referenceQuote.marketType !== bookmakerQuote.marketType) {
    issues.push({
      code: "QUOTE_MARKET_TYPE_MISMATCH",
      message: "Reference and bookmaker market types do not match.",
    });
  }

  if (referenceQuote.line !== bookmakerQuote.line) {
    issues.push({
      code: "QUOTE_LINE_MISMATCH",
      message: "Reference and bookmaker market lines do not match.",
    });
  }

  if (
    normalizeKey(referenceQuote.period ?? "") !==
    normalizeKey(bookmakerQuote.period ?? "")
  ) {
    issues.push({
      code: "QUOTE_PERIOD_MISMATCH",
      message: "Reference and bookmaker market periods do not match.",
    });
  }

  const key = normalizeKey(selectedOutcomeKey);

  const referenceOutcome = referenceQuote.outcomes.find(
    (outcome) => normalizeKey(outcome.outcomeKey) === key,
  );

  const bookmakerOutcome = bookmakerQuote.outcomes.find(
    (outcome) => normalizeKey(outcome.outcomeKey) === key,
  );

  if (!referenceOutcome) {
    issues.push({
      code: "REFERENCE_OUTCOME_MISSING",
      message: "Selected outcome does not exist in the reference quote.",
    });
  }

  if (!bookmakerOutcome) {
    issues.push({
      code: "BOOKMAKER_OUTCOME_MISSING",
      message: "Selected outcome does not exist in the bookmaker quote.",
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    referenceQuote,
    bookmakerQuote,
    selectedOutcomeKey,
    offeredDecimalOdds:
      issues.length === 0 && bookmakerOutcome
        ? bookmakerOutcome.decimalOdds
        : null,
  };
}
