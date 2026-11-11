
import type { SelectionCandidate } from "../../types/sports";
import {
  validateSelectionCandidate,
  type ValidationIssue,
} from "../../validation/sportsValidation";
import {
  calculateMarketProbabilities,
} from "./marketProbability";
import {
  assessMarketValue,
  type MarketValueAssessment,
} from "./marketValue";
import {
  assessSelectionRisk,
  DEFAULT_RISK_POLICY,
  type RiskAssessment,
  type RiskPolicy,
} from "./riskAssessment";
import {
  validateMarketQuotePair,
  DEFAULT_MARKET_QUOTE_POLICY,
  type MarketQuote,
  type MarketQuotePairValidation,
  type MarketQuotePolicy,
} from "./marketQuotes";

export type IntelligenceDecision =
  | "approved"
  | "caution"
  | "rejected"
  | "unassessed";

export interface SelectionIntelligencePolicy {
  riskPolicy: RiskPolicy;
  minimumProbabilityEdge: number;
  quotePolicy: MarketQuotePolicy;
}

export interface SelectionIntelligenceResult {
  candidateId: string;
  decision: IntelligenceDecision;
  eligibleForTicket: boolean;

  validation: {
    valid: boolean;
    issues: ValidationIssue[];
  };

  quoteValidation: MarketQuotePairValidation | null;
  risk: RiskAssessment | null;
  value: MarketValueAssessment | null;

  warnings: string[];
  rejectionReasons: string[];

  assessedAt: string;
}

export const DEFAULT_INTELLIGENCE_POLICY:
  SelectionIntelligencePolicy = {
    riskPolicy: DEFAULT_RISK_POLICY,
    minimumProbabilityEdge: 0.02,
    quotePolicy: DEFAULT_MARKET_QUOTE_POLICY,
  };

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function assessSelectionIntelligence(
  candidate: SelectionCandidate,
  referenceQuote: MarketQuote,
  bookmakerQuote: MarketQuote,
  selectedOutcomeKey: string,
  policy: SelectionIntelligencePolicy =
    DEFAULT_INTELLIGENCE_POLICY,
  now = Date.now(),
): SelectionIntelligenceResult {
  const warnings: string[] = [];
  const rejectionReasons: string[] = [];

  const validation = validateSelectionCandidate(
    candidate,
    now,
  );

  let quoteValidation: MarketQuotePairValidation | null = null;

  const result = (
    decision: IntelligenceDecision,
    risk: RiskAssessment | null = null,
    value: MarketValueAssessment | null = null,
  ): SelectionIntelligenceResult => ({
    candidateId: candidate.id,
    decision,
    eligibleForTicket: decision === "approved",
    validation: {
      valid: validation.valid,
      issues: validation.issues,
    },
    quoteValidation,
    risk,
    value,
    warnings: [...new Set(warnings)],
    rejectionReasons: [...new Set(rejectionReasons)],
    assessedAt: new Date(now).toISOString(),
  });

  for (const issue of validation.issues) {
    if (issue.severity === "warning") {
      warnings.push(issue.message);
    } else {
      rejectionReasons.push(issue.message);
    }
  }

  if (!validation.valid) {
    return result("rejected");
  }

  // Validate the independent reference and bookmaker prices.
  quoteValidation = validateMarketQuotePair(
    referenceQuote,
    bookmakerQuote,
    selectedOutcomeKey,
    now,
    policy.quotePolicy,
  );

  if (!quoteValidation.valid) {
    warnings.push(
      ...quoteValidation.issues.map((issue) => issue.message),
    );

    return result("unassessed");
  }

  // Both quotes must describe the candidate's actual fixture and market.
  const quotesMatchCandidate =
    referenceQuote.fixtureId === candidate.fixture.id &&
    bookmakerQuote.fixtureId === candidate.fixture.id &&
    referenceQuote.sport === candidate.fixture.sport &&
    bookmakerQuote.sport === candidate.fixture.sport &&
    referenceQuote.marketType === candidate.market.type &&
    bookmakerQuote.marketType === candidate.market.type &&
    referenceQuote.line === candidate.market.line &&
    bookmakerQuote.line === candidate.market.line;

  if (!quotesMatchCandidate) {
    warnings.push(
      "Reference or bookmaker quote does not match the candidate fixture or market.",
    );

    return result("unassessed");
  }

  // The selected canonical outcome must identify the candidate outcome.
  if (
    normalizeKey(selectedOutcomeKey) !==
    normalizeKey(candidate.outcome.id)
  ) {
    warnings.push(
      "Selected quote outcome does not match the candidate outcome.",
    );

    return result("unassessed");
  }

  const offeredDecimalOdds =
    quoteValidation.offeredDecimalOdds;

  if (offeredDecimalOdds === null) {
    warnings.push(
      "A valid bookmaker price could not be established.",
    );

    return result("unassessed");
  }

  // The candidate and prediction must reflect the actual bookmaker price.
  if (
    candidate.outcome.decimalOdds !== offeredDecimalOdds ||
    candidate.prediction.decimalOdds !== offeredDecimalOdds
  ) {
    rejectionReasons.push(
      "Candidate or prediction odds do not match the validated bookmaker quote.",
    );

    return result("rejected");
  }

  // Reference odds alone establish the consensus probability benchmark.
  const marketProbabilities = calculateMarketProbabilities(
    referenceQuote.outcomes.map((outcome) => ({
      id: outcome.outcomeKey,
      name: outcome.name,
      decimalOdds: outcome.decimalOdds,
    })),
  );

  if (!marketProbabilities.valid) {
    warnings.push(
      marketProbabilities.error ??
      "Reference market probabilities could not be calculated.",
    );

    return result("unassessed");
  }

  // Value uses the model's probability and the separate bookmaker price.
  const value = assessMarketValue({
    market: marketProbabilities,
    outcomeId: selectedOutcomeKey,
    modelProbability:
      candidate.prediction.estimatedProbability,
    lowerProbabilityBound:
      candidate.prediction.lowerProbabilityBound,
    upperProbabilityBound:
      candidate.prediction.upperProbabilityBound,
    offeredDecimalOdds,
    minimumProbabilityEdge:
      policy.minimumProbabilityEdge,
  });

  warnings.push(...value.warnings);

  if (value.status === "unassessed") {
    return result("unassessed", null, value);
  }

  const risk = assessSelectionRisk(
    candidate.prediction,
    offeredDecimalOdds,
    policy.riskPolicy,
  );

  warnings.push(...risk.warnings);
  rejectionReasons.push(...risk.rejectionReasons);

  if (risk.decision === "rejected") {
    return result("rejected", risk, value);
  }

  if (value.status === "no_value") {
    rejectionReasons.push(
      "Selection does not meet the conservative market-value requirements.",
    );

    return result("rejected", risk, value);
  }

  const hasMaterialWarnings =
    validation.issues.some(
      (issue) => issue.severity === "warning",
    ) ||
    risk.warnings.length > 0 ||
    value.warnings.some(
      (warning) =>
        !warning.includes(
          "probabilities have been normalized",
        ),
    );

  if (
    risk.decision === "caution" ||
    hasMaterialWarnings
  ) {
    return result("caution", risk, value);
  }

  return result("approved", risk, value);
}
