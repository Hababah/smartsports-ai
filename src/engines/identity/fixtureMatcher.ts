
import type { Fixture } from "../../types/sports";
import { normalizeEntityName } from "./fixtureNormalization";

export type FixtureMatchStatus = "confirmed" | "possible" | "rejected";

export interface FixtureMatchPolicy {
  confirmedTimeToleranceMinutes: number;
  possibleTimeToleranceMinutes: number;
}

export const DEFAULT_FIXTURE_MATCH_POLICY: FixtureMatchPolicy = {
  confirmedTimeToleranceMinutes: 15,
  possibleTimeToleranceMinutes: 180,
};

export interface FixtureMatchResult {
  status: FixtureMatchStatus;
  confidence: number;
  timeDifferenceMinutes: number | null;
  reversedParticipants: boolean;
  issues: string[];
}

function normalized(value: string | undefined): string {
  return normalizeEntityName(value ?? "").normalized;
}

export function matchFixtures(
  first: Fixture,
  second: Fixture,
  policy: FixtureMatchPolicy = DEFAULT_FIXTURE_MATCH_POLICY,
): FixtureMatchResult {
  const reject = (issue: string): FixtureMatchResult => ({
    status: "rejected",
    confidence: 0,
    timeDifferenceMinutes: null,
    reversedParticipants: false,
    issues: [issue],
  });

  if (!first || !second) {
    return reject("Both fixture records are required.");
  }

  if (
    !Number.isFinite(policy.confirmedTimeToleranceMinutes) ||
    !Number.isFinite(policy.possibleTimeToleranceMinutes) ||
    policy.confirmedTimeToleranceMinutes < 0 ||
    policy.possibleTimeToleranceMinutes <
      policy.confirmedTimeToleranceMinutes
  ) {
    return reject("Fixture matching time policy is invalid.");
  }

  if (first.sport !== second.sport) {
    return reject("The fixtures belong to different sports.");
  }

  const firstHome = normalized(first.home?.name);
  const firstAway = normalized(first.away?.name);
  const secondHome = normalized(second.home?.name);
  const secondAway = normalized(second.away?.name);

  if (!firstHome || !firstAway || !secondHome || !secondAway) {
    return reject("One or more participant names are missing.");
  }

  if (!normalized(first.competition?.name) ||
      !normalized(second.competition?.name)) {
    return reject("One or more competition names are missing.");
  }

  if (
    normalized(first.competition.name) !==
    normalized(second.competition.name)
  ) {
    return reject("Competition names do not match.");
  }

  const firstCountry = normalized(first.competition.country);
  const secondCountry = normalized(second.competition.country);

  if (firstCountry && secondCountry && firstCountry !== secondCountry) {
    return reject("Competition countries conflict.");
  }

  const firstSeason = normalized(first.competition.season);
  const secondSeason = normalized(second.competition.season);

  if (firstSeason && secondSeason && firstSeason !== secondSeason) {
    return reject("Competition seasons conflict.");
  }

  const sameOrientation =
    firstHome === secondHome && firstAway === secondAway;

  const reversedOrientation =
    firstHome === secondAway && firstAway === secondHome;

  if (!sameOrientation && !reversedOrientation) {
    return reject("Participant names do not match.");
  }

  const firstKickoff = Date.parse(first.startTime);
  const secondKickoff = Date.parse(second.startTime);

  if (
    !Number.isFinite(firstKickoff) ||
    !Number.isFinite(secondKickoff)
  ) {
    return reject("One or both kickoff timestamps are invalid.");
  }

  const timeDifferenceMinutes =
    Math.abs(firstKickoff - secondKickoff) / 60_000;

  const issues: string[] = [];

  if (reversedOrientation) {
    issues.push("Home and away participants are reversed.");
  }

  if (
    timeDifferenceMinutes >
    policy.possibleTimeToleranceMinutes
  ) {
    return {
      status: "rejected",
      confidence: 0,
      timeDifferenceMinutes,
      reversedParticipants: reversedOrientation,
      issues: ["Kickoff times are outside the matching tolerance."],
    };
  }

  if (
    timeDifferenceMinutes <=
      policy.confirmedTimeToleranceMinutes &&
    sameOrientation
  ) {
    return {
      status: "confirmed",
      confidence: 1,
      timeDifferenceMinutes,
      reversedParticipants: false,
      issues: [],
    };
  }

  if (timeDifferenceMinutes >
    policy.confirmedTimeToleranceMinutes) {
    issues.push("Kickoff times differ beyond the confirmed tolerance.");
  }

  return {
    status: "possible",
    confidence: reversedOrientation ? 0.85 : 0.9,
    timeDifferenceMinutes,
    reversedParticipants: reversedOrientation,
    issues,
  };
}