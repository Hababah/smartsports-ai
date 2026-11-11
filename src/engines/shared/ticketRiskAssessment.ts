
import type { SelectionCandidate } from "../../types/sports";

export type TicketRiskLevel =
  | "lower"
  | "moderate"
  | "high"
  | "unassessed";

export interface TicketRiskAssessment {
  selectionCount: number;

  /**
   * Product of individual conservative probability bounds.
   * This is an independence-based reference only,
   * NOT a verified probability that the complete ticket wins.
   */
  independenceBaselineProbability: number;

  weakestSelectionProbability: number;

  repeatedFixtureGroups: number;
  repeatedParticipantGroups: number;

  riskLevel: TicketRiskLevel;

  warnings: string[];
}

function countRepeatedGroups(values: string[]): number {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) continue;

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.values()].filter(
    (count) => count > 1,
  ).length;
}

export function assessTicketRisk(
  candidates: SelectionCandidate[],
): TicketRiskAssessment {
  const warnings: string[] = [];

  if (candidates.length === 0) {
    return {
      selectionCount: 0,
      independenceBaselineProbability: 0,
      weakestSelectionProbability: 0,
      repeatedFixtureGroups: 0,
      repeatedParticipantGroups: 0,
      riskLevel: "unassessed",
      warnings: ["No selections available for ticket risk assessment."],
    };
  }

  const probabilities = candidates.map(
    (candidate) =>
      candidate.prediction.lowerProbabilityBound,
  );

  const validProbabilities = probabilities.every(
    (probability) =>
      Number.isFinite(probability) &&
      probability >= 0 &&
      probability <= 1,
  );

  if (!validProbabilities) {
    return {
      selectionCount: candidates.length,
      independenceBaselineProbability: 0,
      weakestSelectionProbability: 0,
      repeatedFixtureGroups: 0,
      repeatedParticipantGroups: 0,
      riskLevel: "unassessed",
      warnings: [
        "Ticket probability cannot be assessed because one or more conservative probability bounds are invalid.",
      ],
    };
  }

  let independenceBaselineProbability = 1;

  for (const probability of probabilities) {
    independenceBaselineProbability *= probability;
  }

  const weakestSelectionProbability = Math.min(
    ...probabilities,
  );

  const repeatedFixtureGroups = countRepeatedGroups(
    candidates.map((candidate) => candidate.fixture.id),
  );

  const participantIds = candidates.flatMap(
    (candidate) => [
      candidate.fixture.home.id,
      candidate.fixture.away.id,
    ],
  );

  const repeatedParticipantGroups =
    countRepeatedGroups(participantIds);

  if (candidates.length >= 12) {
    warnings.push(
      "This ticket contains at least 12 selections. Cumulative exposure is substantial.",
    );
  }

  if (candidates.length >= 20) {
    warnings.push(
      "This ticket contains at least 20 selections. The chance of every selection succeeding can become very small.",
    );
  }

  if (weakestSelectionProbability < 0.50) {
    warnings.push(
      "At least one selection has a conservative probability below 50%.",
    );
  }

  if (repeatedFixtureGroups > 0) {
    warnings.push(
      "Multiple selections involve the same fixture. Their outcomes may be dependent.",
    );
  }

  if (repeatedParticipantGroups > 0) {
    warnings.push(
      "Some participants appear in multiple selections. Shared participant exposure requires attention.",
    );
  }

  warnings.push(
    "The combined probability is an independence-based reference, not a verified ticket-win probability. Correlation may materially change it.",
  );

  return {
    selectionCount: candidates.length,
    independenceBaselineProbability,
    weakestSelectionProbability,
    repeatedFixtureGroups,
    repeatedParticipantGroups,
    riskLevel: "unassessed",
    warnings,
  };
}
