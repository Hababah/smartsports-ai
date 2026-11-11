
import type { Prediction } from "../../types/sports";

export type RiskDecision = "approved" | "caution" | "rejected";

export interface RiskPolicy {
  favouriteOddsCeiling: number;
  minimumQualityScore: number;
  minimumConfidence: number;
  minimumLowerProbability: number;
  maximumNegativeMarketGap: number;
}

export interface RiskAssessment {
  decision: RiskDecision;
  riskScore: number;
  marketImpliedProbability: number;
  modelProbability: number;
  probabilityGap: number;
  warnings: string[];
  rejectionReasons: string[];
}

export const DEFAULT_RISK_POLICY: RiskPolicy = {
  favouriteOddsCeiling: 1.70,
  minimumQualityScore: 70,
  minimumConfidence: 0.65,
  minimumLowerProbability: 0.40,
  maximumNegativeMarketGap: 0.05,
};

export function assessSelectionRisk(
  prediction: Prediction,
  decimalOdds: number,
  policy: RiskPolicy = DEFAULT_RISK_POLICY,
): RiskAssessment {
  const warnings: string[] = [];
  const rejectionReasons: string[] = [];

  let riskScore = 0;

  const validOdds =
    Number.isFinite(decimalOdds) && decimalOdds > 1;

  const validProbability =
    Number.isFinite(prediction.estimatedProbability) &&
    prediction.estimatedProbability >= 0 &&
    prediction.estimatedProbability <= 1;

  const marketImpliedProbability = validOdds
    ? 1 / decimalOdds
    : 0;

  const modelProbability = validProbability
    ? prediction.estimatedProbability
    : 0;

  const probabilityGap =
    modelProbability - marketImpliedProbability;

  if (!validOdds) {
    rejectionReasons.push("Invalid decimal odds.");
  }

  if (!validProbability) {
    rejectionReasons.push("Invalid model probability.");
  }

  if (
    !Number.isFinite(prediction.lowerProbabilityBound) ||
    prediction.lowerProbabilityBound < 0 ||
    prediction.lowerProbabilityBound > 1
  ) {
    rejectionReasons.push("Invalid lower probability bound.");
  }

  if (
    !Number.isFinite(prediction.confidence) ||
    prediction.confidence < 0 ||
    prediction.confidence > 1
  ) {
    rejectionReasons.push("Invalid model confidence.");
  }

  if (
    !Number.isFinite(prediction.quality.score) ||
    prediction.quality.score < 0 ||
    prediction.quality.score > 100
  ) {
    rejectionReasons.push("Invalid data quality score.");
  }

  if (prediction.quality.status === "stale") {
    rejectionReasons.push("Prediction relies on stale data.");
  }

  if (
    prediction.quality.status === "rejected" ||
    prediction.quality.status === "unavailable"
  ) {
    rejectionReasons.push("Prediction data is not usable.");
  }

  if (prediction.quality.score < policy.minimumQualityScore) {
    rejectionReasons.push("Data quality is below the required threshold.");
  }

  if (prediction.confidence < policy.minimumConfidence) {
    riskScore += 20;
    warnings.push("Model confidence is below the preferred threshold.");
  }

  if (
    prediction.lowerProbabilityBound <
    policy.minimumLowerProbability
  ) {
    riskScore += 20;
    warnings.push("The conservative probability estimate is too low.");
  }

  if (
    prediction.quality.sourceCount < 2
  ) {
    riskScore += 10;
    warnings.push("Prediction has fewer than two supporting data sources.");
  }

  const isFavourite =
    validOdds && decimalOdds <= policy.favouriteOddsCeiling;

  if (
    isFavourite &&
    validProbability &&
    probabilityGap < -policy.maximumNegativeMarketGap
  ) {
    riskScore += 35;
    warnings.push(
      "Potential favourite trap: model probability is materially below market-implied probability.",
    );
  }

  if (
    isFavourite &&
    validProbability &&
    probabilityGap < 0
  ) {
    riskScore += 10;
    warnings.push(
      "The model is less optimistic than the bookmaker's implied probability.",
    );
  }

  if (
    isFavourite &&
    prediction.lowerProbabilityBound <
    marketImpliedProbability
  ) {
    riskScore += 15;
    warnings.push(
      "The conservative probability estimate falls below the market-implied probability.",
    );
  }

  if (riskScore > 100) {
    riskScore = 100;
  }

  const decision: RiskDecision =
    rejectionReasons.length > 0 || riskScore >= 60
      ? "rejected"
      : riskScore >= 30
        ? "caution"
        : "approved";

  return {
    decision,
    riskScore,
    marketImpliedProbability,
    modelProbability,
    probabilityGap,
    warnings,
    rejectionReasons,
  };
}
