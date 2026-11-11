
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

export type IntelligenceDecision =
  | "approved"
  | "caution"
  | "rejected"
  | "unassessed";

export interface SelectionIntelligencePolicy {
  riskPolicy: RiskPolicy;
  minimumProbabilityEdge: number;
}

export interface SelectionIntelligenceResult {
  candidateId: string;
  decision: IntelligenceDecision;
  eligibleForTicket: boolean;

  validation: {
    valid: boolean;
    issues: ValidationIssue[];
  };

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
  };

export function assessSelectionIntelligence(
  candidate: SelectionCandidate,
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

  if (
    candidate.prediction.decimalOdds !==
    candidate.outcome.decimalOdds
  ) {
    rejectionReasons.push(
      "Prediction odds do not match the selected outcome odds.",
    );

    return result("rejected");
  }

  const marketProbabilities = calculateMarketProbabilities(
    candidate.market.outcomes.map((outcome) => ({
      id: outcome.id,
      name: outcome.name,
      decimalOdds: outcome.decimalOdds,
    })),
  );

  if (!marketProbabilities.valid) {
    warnings.push(
      marketProbabilities.error ??
      "Market probabilities could not be calculated.",
    );

    return result("unassessed");
  }

  const value = assessMarketValue({
    market: marketProbabilities,
    outcomeId: candidate.outcome.id,
    modelProbability:
      candidate.prediction.estimatedProbability,
    lowerProbabilityBound:
      candidate.prediction.lowerProbabilityBound,
    upperProbabilityBound:
      candidate.prediction.upperProbabilityBound,
    offeredDecimalOdds: candidate.outcome.decimalOdds,
    minimumProbabilityEdge:
      policy.minimumProbabilityEdge,
  });

  warnings.push(...value.warnings);

  if (value.status === "unassessed") {
    return result("unassessed", null, value);
  }

  const risk = assessSelectionRisk(
    candidate.prediction,
    candidate.outcome.decimalOdds,
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
