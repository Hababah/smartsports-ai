
import type {
  GeneratedTicket,
  SelectionCandidate,
  TicketSelection,
} from "../types/sports";

import {
  checkCandidateDuplicates,
  createSelectionDuplicateKey,
  isFixtureAlreadyAllocated,
} from "./duplicateChecker";

import {
  assessSelectionRisk,
  DEFAULT_RISK_POLICY,
} from "../engines/shared/riskAssessment";

import {
  assessTicketRisk,
} from "../engines/shared/ticketRiskAssessment";

export type AllocationSessionType = "daytime" | "overnight";

export interface TicketPlan {
  id: string;
  label: string;
  minimumSelections: number;
  maximumSelections: number;
  minimumCombinedOdds: number;
  maximumCombinedOdds: number;
  targetCombinedOdds?: number;
}


export interface TicketSafetySummary {
  ticketId: string;
  rank: number;
  safetyScore: number;

  averageConservativeProbability: number;
  independenceBaselineProbability: number;
  weakestSelectionProbability: number;

  averageConfidence: number;
  averageDataQuality: number;

  highestSelectionRisk: number;

  repeatedFixtureGroups: number;
  repeatedParticipantGroups: number;

  selectionCount: number;
  combinedOdds: number;

  warnings: string[];
}


export interface AllocationOptions {
  sessionId: string;
  sessionType: AllocationSessionType;
  generatedAt?: string;
  overnightTicketCount?: 2 | 3;
  plans?: TicketPlan[];
}

export interface TicketAllocationResult {
  tickets: GeneratedTicket[];
  ranking: TicketSafetySummary[];
  unusedCandidates: SelectionCandidate[];
  rejectedCandidates: SelectionCandidate[];
  allocationWarnings: string[];
}

interface RankedCandidate {
  candidate: SelectionCandidate;
  safetyScore: number;
  riskScore: number;
  warnings: string[];
}

interface BuiltTicket {
  ticket: GeneratedTicket;
  candidates: SelectionCandidate[];
}

const STANDARD_ODDS_TARGET = 2_000;
const MEGA_ODDS_TARGET = 5_000_000;
const MAX_SELECTIONS = 30;

export const DEFAULT_DAYTIME_PLANS: TicketPlan[] = [
  {
    id: "day-standard-1",
    label: "Daytime Standard 1",
    minimumSelections: 1,
    maximumSelections: MAX_SELECTIONS,
    minimumCombinedOdds: STANDARD_ODDS_TARGET,
    maximumCombinedOdds: Number.MAX_SAFE_INTEGER,
  },
  {
    id: "day-standard-2",
    label: "Daytime Standard 2",
    minimumSelections: 1,
    maximumSelections: MAX_SELECTIONS,
    minimumCombinedOdds: STANDARD_ODDS_TARGET,
    maximumCombinedOdds: Number.MAX_SAFE_INTEGER,
  },
  {
    id: "day-standard-3",
    label: "Daytime Standard 3",
    minimumSelections: 1,
    maximumSelections: MAX_SELECTIONS,
    minimumCombinedOdds: STANDARD_ODDS_TARGET,
    maximumCombinedOdds: Number.MAX_SAFE_INTEGER,
  },
  {
    id: "day-mega-1",
    label: "Daytime Mega 1",
    minimumSelections: 1,
    maximumSelections: MAX_SELECTIONS,
    minimumCombinedOdds: STANDARD_ODDS_TARGET,
    maximumCombinedOdds: MEGA_ODDS_TARGET,
    targetCombinedOdds: MEGA_ODDS_TARGET,
  },
  {
    id: "day-mega-2",
    label: "Daytime Mega 2",
    minimumSelections: 1,
    maximumSelections: MAX_SELECTIONS,
    minimumCombinedOdds: STANDARD_ODDS_TARGET,
    maximumCombinedOdds: MEGA_ODDS_TARGET,
    targetCombinedOdds: MEGA_ODDS_TARGET,
  },
];

export function createOvernightPlans(
  ticketCount: 2 | 3 = 2,
): TicketPlan[] {
  return Array.from({ length: ticketCount }, (_, index) => ({
    id: `night-${index + 1}`,
    label: `Overnight Ticket ${index + 1}`,
    minimumSelections: 12,
    maximumSelections: MAX_SELECTIONS,
    minimumCombinedOdds: STANDARD_ODDS_TARGET,
    maximumCombinedOdds: Number.MAX_SAFE_INTEGER,
  }));
}

/**
 * Validates the basic integrity and current usability of a candidate.
 * Session-specific kickoff windows are checked by the scheduling module,
 * not by this allocator.
 */
function validateCandidate(
  candidate: SelectionCandidate,
  now: number,
): string[] {
  const reasons: string[] = [];

  if (!candidate.eligible) {
    reasons.push("Candidate is not marked eligible.");
  }

  if (candidate.rejectionReasons.length > 0) {
    reasons.push(...candidate.rejectionReasons);
  }

  if (
    !candidate.fixture ||
    !candidate.market ||
    !candidate.outcome ||
    !candidate.prediction
  ) {
    reasons.push("Candidate is missing required information.");
    return [...new Set(reasons)];
  }

  const fixture = candidate.fixture;
  const market = candidate.market;
  const outcome = candidate.outcome;
  const prediction = candidate.prediction;

  if (fixture.status !== "scheduled") {
    reasons.push("Fixture is not scheduled.");
  }

  const fixtureTime = Date.parse(fixture.startTime);

  if (!Number.isFinite(fixtureTime) || fixtureTime <= now) {
    reasons.push("Fixture has already started or has an invalid start time.");
  }

  if (
    fixture.dataStatus === "stale" ||
    fixture.dataStatus === "unavailable" ||
    fixture.dataStatus === "rejected"
  ) {
    reasons.push("Fixture data is not sufficiently reliable.");
  }

  if (market.status !== "active") {
    reasons.push("Market is not active.");
  }

  if (market.fixtureId !== fixture.id) {
    reasons.push("Market belongs to a different fixture.");
  }

  if (market.sport !== fixture.sport) {
    reasons.push("Market sport does not match fixture sport.");
  }

  if (outcome.status !== "active") {
    reasons.push("Selected outcome is not active.");
  }

  if (
    !market.outcomes.some(
      (item) => item.id === outcome.id,
    )
  ) {
    reasons.push("Selected outcome is missing from the market.");
  }

  if (
    !Number.isFinite(outcome.decimalOdds) ||
    outcome.decimalOdds <= 1
  ) {
    reasons.push("Selected outcome has invalid decimal odds.");
  }

  if (
    prediction.fixtureId !== fixture.id ||
    prediction.marketId !== market.id ||
    prediction.outcomeId !== outcome.id
  ) {
    reasons.push("Prediction does not match the selected fixture, market and outcome.");
  }

  const expiry = Date.parse(prediction.expiresAt);

  if (!Number.isFinite(expiry) || expiry <= now) {
    reasons.push("Prediction has expired or has an invalid expiry time.");
  }

  if (prediction.quality.status === "stale") {
    reasons.push("Prediction quality is stale.");
  }

  if (
    prediction.quality.status === "unavailable" ||
    prediction.quality.status === "rejected"
  ) {
    reasons.push("Prediction quality is not usable.");
  }

  return [...new Set(reasons)];
}

/**
 * Produces a transparent selection safety score.
 * This is a ranking heuristic, NOT a probability of winning.
 */
function calculateCandidateSafety(
  candidate: SelectionCandidate,
): RankedCandidate {
  const assessment = assessSelectionRisk(
    candidate.prediction,
    candidate.outcome.decimalOdds,
    DEFAULT_RISK_POLICY,
  );

  const lowerProbability = Math.max(
    0,
    Math.min(1, candidate.prediction.lowerProbabilityBound),
  );

  const confidence = Math.max(
    0,
    Math.min(1, candidate.prediction.confidence),
  );

  const quality = Math.max(
    0,
    Math.min(100, candidate.prediction.quality.score),
  );

  const sourceBonus =
    Math.min(candidate.prediction.quality.sourceCount, 5) * 2;

  const baseScore =
    lowerProbability * 45 +
    confidence * 20 +
    (quality / 100) * 25 +
    sourceBonus;

  const riskPenalty = assessment.riskScore * 0.15;

  const safetyScore = Math.max(
    0,
    Math.min(100, baseScore - riskPenalty),
  );

  return {
    candidate,
    safetyScore,
    riskScore: assessment.riskScore,
    warnings: [
      ...assessment.warnings,
      ...assessment.rejectionReasons,
    ],
  };
}

/**
 * Prioritizes stronger candidates while using odds as a secondary
 * consideration rather than treating high odds as safety.
 */
function rankCandidates(
  candidates: SelectionCandidate[],
): RankedCandidate[] {
  return candidates
    .map(calculateCandidateSafety)
    .filter((item) => item.riskScore < 60)
    .sort((a, b) => {
      if (b.safetyScore !== a.safetyScore) {
        return b.safetyScore - a.safetyScore;
      }

      if (
        b.candidate.prediction.lowerProbabilityBound !==
        a.candidate.prediction.lowerProbabilityBound
      ) {
        return (
          b.candidate.prediction.lowerProbabilityBound -
          a.candidate.prediction.lowerProbabilityBound
        );
      }

      return (
        a.candidate.outcome.decimalOdds -
        b.candidate.outcome.decimalOdds
      );
    });
}

function toTicketSelection(
  candidate: SelectionCandidate,
): TicketSelection {
  return {
    selectionId: candidate.id,
    fixtureId: candidate.fixture.id,
    marketId: candidate.market.id,
    outcomeId: candidate.outcome.id,
    decimalOdds: candidate.outcome.decimalOdds,
    estimatedProbability:
      candidate.prediction.estimatedProbability,
  };
}


/**
 * Creates one ticket using the strongest available candidates.
 * Exact selections cannot repeat across accepted tickets.
 * Different markets on the same fixture remain allowed.
 */
function buildTicket(
  plan: TicketPlan,
  rankedCandidates: RankedCandidate[],
  globallyAllocated: SelectionCandidate[],
  sessionId: string,
  sessionType: AllocationSessionType,
  generatedAt: string,
): BuiltTicket {
  const localCandidates: SelectionCandidate[] = [];
  const localKeys = new Set<string>();
  const warnings: string[] = [];

  let combinedOdds = 1;

  for (const ranked of rankedCandidates) {
    if (localCandidates.length >= plan.maximumSelections) {
      break;
    }

    const candidate = ranked.candidate;

    const duplicateKey =
      createSelectionDuplicateKey(candidate);

    if (!duplicateKey || localKeys.has(duplicateKey)) {
      continue;
    }

    const alreadyAllocated = globallyAllocated.some(
      (allocated) =>
        createSelectionDuplicateKey(allocated) === duplicateKey,
    );

    if (alreadyAllocated) {
      continue;
    }

    const proposedOdds =
      combinedOdds * candidate.outcome.decimalOdds;

    if (
      !Number.isFinite(proposedOdds) ||
      proposedOdds > plan.maximumCombinedOdds
    ) {
      continue;
    }

    /*
     * Fixture reuse is permitted, but we prefer a new fixture
     * when another similarly strong candidate is available.
     */
    const fixtureAlreadyUsed = isFixtureAlreadyAllocated(
  candidate.fixture,
  [...globallyAllocated, ...localCandidates].map(
    (item) => item.fixture,
  ),
);

    if (fixtureAlreadyUsed) {
      const alternativeExists = rankedCandidates.some(
        (alternative) => {
          const other = alternative.candidate;
          const otherKey = createSelectionDuplicateKey(other);

          if (!otherKey || localKeys.has(otherKey)) {
            return false;
          }

          if (
            globallyAllocated.some(
              (allocated) =>
                createSelectionDuplicateKey(allocated) === otherKey,
            )
          ) {
            return false;
          }

          return (
            !isFixtureAlreadyAllocated(
  other.fixture,
  [...globallyAllocated, ...localCandidates].map(
    (item) => item.fixture,
  ),
) &&
            alternative.safetyScore >= ranked.safetyScore - 8
          );
        },
      );

      if (alternativeExists) {
        continue;
      }

      warnings.push(
        "A fixture is reused with a different market because a comparable alternative was unavailable.",
      );
    }

    localCandidates.push(candidate);
    localKeys.add(duplicateKey);
    combinedOdds = proposedOdds;

        if (
      localCandidates.length >= plan.minimumSelections &&
      combinedOdds >= plan.minimumCombinedOdds &&
      (
        !plan.targetCombinedOdds ||
        combinedOdds >= plan.targetCombinedOdds
      )
    ) {
        break;
    }
  }

  const meetsSelectionRequirement =
    localCandidates.length >= plan.minimumSelections;

  const meetsOddsRequirement =
    combinedOdds >= plan.minimumCombinedOdds;

  const withinOddsLimit =
    combinedOdds <= plan.maximumCombinedOdds;

  const qualified =
    meetsSelectionRequirement &&
    meetsOddsRequirement &&
    withinOddsLimit;

  if (!meetsSelectionRequirement) {
    warnings.push(
      `Insufficient qualifying selections: ${localCandidates.length}/${plan.minimumSelections} minimum.`,
    );
  }

  if (!meetsOddsRequirement) {
    warnings.push(
      `Combined odds ${combinedOdds.toFixed(2)} are below the required ${plan.minimumCombinedOdds}.`,
    );
  }

  if (!withinOddsLimit) {
    warnings.push("Combined odds exceed the permitted maximum.");
  }

  if (
    qualified &&
    plan.targetCombinedOdds &&
    combinedOdds < plan.targetCombinedOdds
  ) {
    warnings.push(
      "The minimum ticket requirements were met, but the preferred mega-ticket target was not reached.",
    );
  }

  for (const candidate of localCandidates) {
    const assessment = assessSelectionRisk(
      candidate.prediction,
      candidate.outcome.decimalOdds,
    );

    if (assessment.decision === "caution") {
      warnings.push(
        `${candidate.fixture.home.name} vs ${candidate.fixture.away.name}: selection requires caution.`,
      );
    }
  }

  const ticket: GeneratedTicket = {
    id: `${sessionId}-${plan.id}`,
    sessionId,
    sessionType,
    selections: localCandidates.map(toTicketSelection),
    combinedOdds,
    selectionCount: localCandidates.length,
    status: qualified ? "qualified" : "rejected",
    warnings: [...new Set(warnings)],
    generatedAt,
  };

  return {
    ticket,
    candidates: localCandidates,
  };
}

/**
 * Ranks completed tickets from safest to riskiest.
 * The safety score is a heuristic and must not be interpreted
 * as the probability that the complete ticket will win.
 */

function createSafetyRanking(
  builtTickets: BuiltTicket[],
): TicketSafetySummary[] {
  const summaries = builtTickets
    .filter((item) => item.ticket.status === "qualified")
    .map((item) => {
      const candidates = item.candidates;

      const average = (values: number[]) =>
        values.length > 0
          ? values.reduce((sum, value) => sum + value, 0) /
            values.length
          : 0;

      const conservativeProbability = average(
        candidates.map(
          (candidate) =>
            candidate.prediction.lowerProbabilityBound,
        ),
      );

      const averageConfidence = average(
        candidates.map(
          (candidate) => candidate.prediction.confidence,
        ),
      );

      const averageQuality = average(
        candidates.map(
          (candidate) => candidate.prediction.quality.score,
        ),
      );

      const riskAssessments = candidates.map((candidate) =>
        assessSelectionRisk(
          candidate.prediction,
          candidate.outcome.decimalOdds,
        ),
      );

      const highestRisk = Math.max(
        0,
        ...riskAssessments.map((assessment) => assessment.riskScore),
      );

      const ticketRisk = assessTicketRisk(candidates);

      const averageSafetyScore =
        conservativeProbability * 45 +
        averageConfidence * 20 +
        (averageQuality / 100) * 25 -
        highestRisk * 0.15;

      const cumulativeRiskPenalty =
        Math.min(candidates.length, 30) * 0.75;

      const correlationPenalty =
        ticketRisk.repeatedFixtureGroups * 5 +
        ticketRisk.repeatedParticipantGroups * 2;

      const safetyScore = Math.max(
        0,
        Math.min(
          100,
          averageSafetyScore -
            cumulativeRiskPenalty -
            correlationPenalty,
        ),
      );

      return {
        ticketId: item.ticket.id,
        rank: 0,
        safetyScore,
        averageConservativeProbability:
          conservativeProbability,
        independenceBaselineProbability:
          ticketRisk.independenceBaselineProbability,
        weakestSelectionProbability:
          ticketRisk.weakestSelectionProbability,
        averageConfidence,
        averageDataQuality: averageQuality,
        highestSelectionRisk: highestRisk,
        repeatedFixtureGroups:
          ticketRisk.repeatedFixtureGroups,
        repeatedParticipantGroups:
          ticketRisk.repeatedParticipantGroups,
        selectionCount: candidates.length,
        combinedOdds: item.ticket.combinedOdds,
        warnings: [
          ...item.ticket.warnings,
          ...ticketRisk.warnings,
        ],
      };
    })
    .sort((a, b) => {
      if (b.safetyScore !== a.safetyScore) {
        return b.safetyScore - a.safetyScore;
      }

      return (
        b.weakestSelectionProbability -
        a.weakestSelectionProbability
      );
    });

  return summaries.map((summary, index) => ({
    ...summary,
    rank: index + 1,
  }));
}
 

/**
 * Main public allocation function.
 *
 * Supply candidates that have already passed fixture scheduling
 * and session-specific time-window checks.
 */
export function allocateTickets(
  candidates: SelectionCandidate[],
  options: AllocationOptions,
): TicketAllocationResult {
  const now = Date.parse(
    options.generatedAt ?? new Date().toISOString(),
  );

  const generatedAt = new Date(now).toISOString();

  const allocationWarnings: string[] = [];

  const rejectedCandidates: SelectionCandidate[] = [];

  if (!options.sessionId.trim()) {
    throw new Error("A valid session ID is required.");
  }

  if (!Number.isFinite(now)) {
    throw new Error("Invalid ticket generation timestamp.");
  }

  const validCandidates: SelectionCandidate[] = [];

  for (const candidate of candidates) {
    const reasons = validateCandidate(candidate, now);

    if (reasons.length > 0) {
      rejectedCandidates.push({
        ...candidate,
        eligible: false,
        rejectionReasons: [
          ...new Set([
            ...candidate.rejectionReasons,
            ...reasons,
          ]),
        ],
      });
    } else {
      validCandidates.push(candidate);
    }
  }

  const duplicateCheck =
    checkCandidateDuplicates(validCandidates);

  rejectedCandidates.push(
    ...duplicateCheck.rejectedCandidates,
  );

  const rankedCandidates = rankCandidates(
    duplicateCheck.uniqueCandidates,
  );

  const riskRejected = duplicateCheck.uniqueCandidates.filter(
    (candidate) => {
      const assessment = assessSelectionRisk(
        candidate.prediction,
        candidate.outcome.decimalOdds,
      );

      return assessment.decision === "rejected";
    },
  );

  rejectedCandidates.push(...riskRejected);

  const safeCandidates = rankedCandidates
    .map((item) => item.candidate)
    .filter(
      (candidate) =>
        !riskRejected.some(
          (rejected) => rejected.id === candidate.id,
        ),
    );

  const plans =
    options.plans ??
    (
      options.sessionType === "daytime"
        ? DEFAULT_DAYTIME_PLANS
        : createOvernightPlans(
            options.overnightTicketCount ?? 2,
          )
    );

  const globallyAllocated: SelectionCandidate[] = [];
  const builtTickets: BuiltTicket[] = [];

  for (const plan of plans) {
    const built = buildTicket(
      plan,
      rankedCandidates.filter(
        (item) =>
          !riskRejected.some(
            (rejected) =>
              rejected.id === item.candidate.id,
          ),
      ),
      globallyAllocated,
      options.sessionId,
      options.sessionType,
      generatedAt,
    );

    builtTickets.push(built);

    if (built.ticket.status === "qualified") {
      globallyAllocated.push(...built.candidates);
    } else {
      allocationWarnings.push(
        `${plan.label} could not meet all qualification requirements. No weak selections were forced into it.`,
      );
    }
  }

  const qualifiedTickets = builtTickets
    .filter((item) => item.ticket.status === "qualified");

  if (qualifiedTickets.length < plans.length) {
    allocationWarnings.push(
      `Only ${qualifiedTickets.length} of ${plans.length} requested tickets qualified.`,
    );
  }

  if (rankedCandidates.length === 0) {
    allocationWarnings.push(
      "No candidates passed the initial safety assessment.",
    );
  }

  const unusedCandidates = safeCandidates.filter(
    (candidate) =>
      !globallyAllocated.some(
        (allocated) =>
          createSelectionDuplicateKey(allocated) ===
          createSelectionDuplicateKey(candidate),
      ),
  );

  return {
    tickets: builtTickets.map((item) => item.ticket),
    ranking: createSafetyRanking(builtTickets),
    unusedCandidates,
    rejectedCandidates,
    allocationWarnings,
  };
}
