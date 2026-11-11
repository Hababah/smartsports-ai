
import type {
  BettingMarket,
  Fixture,
  Prediction,
  SelectionCandidate,
} from "../types/sports";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  code: string;
  message: string;
  severity: ValidationSeverity;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const addIssue = (
  issues: ValidationIssue[],
  code: string,
  message: string,
  severity: ValidationSeverity = "error",
): void => {
  issues.push({ code, message, severity });
};

const isNonEmpty = (value: string | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const isValidDate = (value: string): boolean =>
  Number.isFinite(Date.parse(value));

const isProbability = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;

const isValidOdds = (value: number): boolean =>
  Number.isFinite(value) && value > 1;

const result = (issues: ValidationIssue[]): ValidationResult => ({
  valid: !issues.some((issue) => issue.severity === "error"),
  issues,
});

export function validateFixture(
  fixture: Fixture,
  now = Date.now(),
  maximumAgeMs = 24 * 60 * 60 * 1000,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isNonEmpty(fixture.id)) {
    addIssue(issues, "FIXTURE_ID_MISSING", "Fixture ID is missing.");
  }

  if (!isNonEmpty(fixture.providerId)) {
    addIssue(issues, "PROVIDER_ID_MISSING", "Provider fixture ID is missing.");
  }

  if (!isNonEmpty(fixture.providerName)) {
    addIssue(issues, "PROVIDER_MISSING", "Data provider is unidentified.");
  }

  if (!isNonEmpty(fixture.home?.id) || !isNonEmpty(fixture.home?.name)) {
    addIssue(issues, "HOME_PARTICIPANT_MISSING", "Home participant is incomplete.");
  }

  if (!isNonEmpty(fixture.away?.id) || !isNonEmpty(fixture.away?.name)) {
    addIssue(issues, "AWAY_PARTICIPANT_MISSING", "Away participant is incomplete.");
  }

  if (
    isNonEmpty(fixture.home?.id) &&
    fixture.home.id === fixture.away?.id
  ) {
    addIssue(issues, "IDENTICAL_PARTICIPANTS", "Both participants have the same ID.");
  }

  if (!isNonEmpty(fixture.competition?.id) ||
      !isNonEmpty(fixture.competition?.name)) {
    addIssue(issues, "COMPETITION_MISSING", "Competition information is incomplete.");
  }

  if (fixture.competition?.sport !== fixture.sport) {
    addIssue(issues, "SPORT_MISMATCH", "Fixture and competition sports do not match.");
  }

  if (!isNonEmpty(fixture.startTime) || !isValidDate(fixture.startTime)) {
    addIssue(issues, "INVALID_START_TIME", "Fixture start time is invalid.");
  }

  if (!isNonEmpty(fixture.timezone)) {
    addIssue(issues, "TIMEZONE_MISSING", "Fixture timezone is missing.");
  }

  if (!isNonEmpty(fixture.lastUpdated) || !isValidDate(fixture.lastUpdated)) {
    addIssue(issues, "INVALID_UPDATE_TIME", "Fixture update timestamp is invalid.");
  } else {
    const age = now - Date.parse(fixture.lastUpdated);

    if (age < 0) {
      addIssue(issues, "FUTURE_UPDATE_TIME", "Fixture update timestamp is in the future.");
    } else if (age > maximumAgeMs) {
      addIssue(issues, "STALE_FIXTURE", "Fixture information is too old.", "warning");
    }
  }

  if (fixture.dataStatus === "rejected" ||
      fixture.dataStatus === "unavailable") {
    addIssue(issues, "UNUSABLE_FIXTURE_DATA", "Fixture data is not usable.");
  }

  return result(issues);
}

export function validateMarket(
  market: BettingMarket,
  now = Date.now(),
  maximumOddsAgeMs = 5 * 60 * 1000,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isNonEmpty(market.id)) {
    addIssue(issues, "MARKET_ID_MISSING", "Market ID is missing.");
  }

  if (!isNonEmpty(market.providerMarketId)) {
    addIssue(issues, "PROVIDER_MARKET_ID_MISSING", "Provider market ID is missing.");
  }

  if (!isNonEmpty(market.fixtureId)) {
    addIssue(issues, "MARKET_FIXTURE_MISSING", "Market fixture ID is missing.");
  }

  if (!isNonEmpty(market.name)) {
    addIssue(issues, "MARKET_NAME_MISSING", "Market name is missing.");
  }

  if (market.status !== "active") {
    addIssue(issues, "MARKET_NOT_ACTIVE", "Market is not currently active.");
  }

  if (!Array.isArray(market.outcomes) || market.outcomes.length < 2) {
    addIssue(issues, "INSUFFICIENT_OUTCOMES", "Market must contain at least two outcomes.");
  } else {
    const outcomeIds = new Set<string>();

    for (const outcome of market.outcomes) {
      if (!isNonEmpty(outcome.id) || !isNonEmpty(outcome.name)) {
        addIssue(issues, "INVALID_OUTCOME", "An outcome is missing its ID or name.");
      }

      if (outcomeIds.has(outcome.id)) {
        addIssue(issues, "DUPLICATE_OUTCOME", "Duplicate outcome ID detected.");
      }

      outcomeIds.add(outcome.id);

      if (!isValidOdds(outcome.decimalOdds)) {
        addIssue(issues, "INVALID_ODDS", `Invalid decimal odds for outcome ${outcome.name}.`);
      }

      if (outcome.status !== "active") {
        addIssue(issues, "OUTCOME_NOT_ACTIVE", `${outcome.name} is not active.`);
      }

      if (!isNonEmpty(outcome.lastUpdated) || !isValidDate(outcome.lastUpdated)) {
        addIssue(issues, "INVALID_ODDS_TIMESTAMP", `${outcome.name} has an invalid update time.`);
      } else {
        const age = now - Date.parse(outcome.lastUpdated);

        if (age < 0) {
          addIssue(issues, "FUTURE_ODDS_TIMESTAMP", `${outcome.name} has a future update time.`);
        } else if (age > maximumOddsAgeMs) {
          addIssue(issues, "STALE_ODDS", `${outcome.name} odds are stale.`);
        }
      }
    }
  }

  if (!isNonEmpty(market.lastUpdated) || !isValidDate(market.lastUpdated)) {
    addIssue(issues, "INVALID_MARKET_TIMESTAMP", "Market update timestamp is invalid.");
  }

  return result(issues);
}

export function validatePrediction(
  prediction: Prediction,
  now = Date.now(),
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isNonEmpty(prediction.fixtureId) ||
      !isNonEmpty(prediction.marketId) ||
      !isNonEmpty(prediction.outcomeId)) {
    addIssue(issues, "PREDICTION_LINK_MISSING", "Prediction is missing a fixture, market or outcome ID.");
  }

  if (!isProbability(prediction.estimatedProbability)) {
    addIssue(issues, "INVALID_PROBABILITY", "Estimated probability must be between 0 and 1.");
  }

  if (
    !isProbability(prediction.lowerProbabilityBound) ||
    !isProbability(prediction.upperProbabilityBound) ||
    prediction.lowerProbabilityBound > prediction.estimatedProbability ||
    prediction.estimatedProbability > prediction.upperProbabilityBound
  ) {
    addIssue(issues, "INVALID_UNCERTAINTY_BOUNDS", "Prediction uncertainty bounds are inconsistent.");
  }

  if (!isValidOdds(prediction.decimalOdds)) {
    addIssue(issues, "INVALID_PREDICTION_ODDS", "Prediction odds must be greater than 1.");
  }

  if (!Number.isFinite(prediction.estimatedExpectedValue)) {
    addIssue(issues, "INVALID_EXPECTED_VALUE", "Expected value is not a valid number.");
  } else if (
    isProbability(prediction.estimatedProbability) &&
    isValidOdds(prediction.decimalOdds)
  ) {
    const expectedValue =
      prediction.estimatedProbability * prediction.decimalOdds - 1;

    if (Math.abs(expectedValue - prediction.estimatedExpectedValue) > 0.0001) {
      addIssue(issues, "EXPECTED_VALUE_MISMATCH", "Expected value does not match probability and odds.");
    }
  }

  if (!Number.isFinite(prediction.confidence) ||
      prediction.confidence < 0 ||
      prediction.confidence > 1) {
    addIssue(issues, "INVALID_CONFIDENCE", "Confidence must be between 0 and 1.");
  }

  if (!Number.isFinite(prediction.quality.score) ||
      prediction.quality.score < 0 ||
      prediction.quality.score > 100) {
    addIssue(issues, "INVALID_QUALITY_SCORE", "Data quality score must be between 0 and 100.");
  }

  if (!Number.isInteger(prediction.quality.sourceCount) ||
      prediction.quality.sourceCount < 1) {
    addIssue(issues, "NO_VERIFIED_SOURCE", "Prediction must identify at least one data source.");
  }

  if (!isNonEmpty(prediction.modelVersion)) {
    addIssue(issues, "MODEL_VERSION_MISSING", "Prediction model version is missing.");
  }

  if (!isNonEmpty(prediction.generatedAt) ||
      !isValidDate(prediction.generatedAt) ||
      !isNonEmpty(prediction.expiresAt) ||
      !isValidDate(prediction.expiresAt)) {
    addIssue(issues, "INVALID_PREDICTION_TIME", "Prediction timestamps are invalid.");
  } else {
    const generated = Date.parse(prediction.generatedAt);
    const expires = Date.parse(prediction.expiresAt);

    if (generated > now) {
      addIssue(issues, "FUTURE_PREDICTION", "Prediction generation time is in the future.");
    }

    if (expires <= generated) {
      addIssue(issues, "INVALID_EXPIRY", "Prediction expiry must follow generation time.");
    }

    if (expires <= now) {
      addIssue(issues, "EXPIRED_PREDICTION", "Prediction has expired.");
    }
  }

  return result(issues);
}

export function validateSelectionCandidate(
  candidate: SelectionCandidate,
  now = Date.now(),
): ValidationResult {
  const issues: ValidationIssue[] = [];

  const fixtureResult = validateFixture(candidate.fixture, now);
  const marketResult = validateMarket(candidate.market, now);
  const predictionResult = validatePrediction(candidate.prediction, now);

  issues.push(...fixtureResult.issues);
  issues.push(...marketResult.issues);
  issues.push(...predictionResult.issues);

  if (candidate.market.fixtureId !== candidate.fixture.id) {
    addIssue(issues, "FIXTURE_MARKET_MISMATCH", "Market belongs to a different fixture.");
  }

  if (candidate.prediction.fixtureId !== candidate.fixture.id ||
      candidate.prediction.marketId !== candidate.market.id) {
    addIssue(issues, "PREDICTION_LINK_MISMATCH", "Prediction does not match the selected fixture and market.");
  }

  if (candidate.prediction.outcomeId !== candidate.outcome.id) {
    addIssue(issues, "PREDICTION_OUTCOME_MISMATCH", "Prediction belongs to a different outcome.");
  }

  const matchingOutcome = candidate.market.outcomes.find(
    (outcome) => outcome.id === candidate.outcome.id,
  );

  if (!matchingOutcome) {
    addIssue(issues, "OUTCOME_NOT_IN_MARKET", "Selected outcome does not belong to this market.");
  } else if (matchingOutcome.decimalOdds !== candidate.outcome.decimalOdds) {
    addIssue(issues, "OUTCOME_ODDS_MISMATCH", "Selected outcome odds do not match market odds.");
  }

  if (candidate.fixture.status !== "scheduled") {
    addIssue(issues, "FIXTURE_NOT_SCHEDULED", "Fixture is not scheduled.");
  } else if (
    isValidDate(candidate.fixture.startTime) &&
    Date.parse(candidate.fixture.startTime) <= now
  ) {
    addIssue(issues, "FIXTURE_ALREADY_STARTED", "Fixture has already started.");
  }

  if (!candidate.eligible) {
    addIssue(issues, "CANDIDATE_INELIGIBLE", "Candidate has already been marked ineligible.");
  }

  for (const reason of candidate.rejectionReasons) {
    addIssue(issues, "CANDIDATE_REJECTION_REASON", reason);
  }

  if (!isNonEmpty(candidate.duplicateKey)) {
    addIssue(issues, "DUPLICATE_KEY_MISSING", "Candidate has no duplicate-detection key.");
  }

  return result(issues);
}
