
import type { Fixture } from "../../types/sports";
import { normalizeEntityName } from "./fixtureNormalization";

export interface CanonicalFixtureIdentity {
  key: string;
  sport: Fixture["sport"];
  competition: string;
  competitionCountry: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTimestamp: number;
  kickoffDateUtc: string;
}

export interface CanonicalIdentityResult {
  valid: boolean;
  identity: CanonicalFixtureIdentity | null;
  issues: string[];
}

export function createCanonicalFixtureIdentity(
  fixture: Fixture,
): CanonicalIdentityResult {
  const issues: string[] = [];

  if (!fixture || typeof fixture !== "object") {
    return {
      valid: false,
      identity: null,
      issues: ["Fixture is missing or invalid."],
    };
  }

  const homeTeam = normalizeEntityName(fixture.home?.name ?? "").normalized;
  const awayTeam = normalizeEntityName(fixture.away?.name ?? "").normalized;
  const competition = normalizeEntityName(
    fixture.competition?.name ?? "",
  ).normalized;
  const competitionCountry = normalizeEntityName(
    fixture.competition?.country ?? "",
  ).normalized;
  const season = normalizeEntityName(
    fixture.competition?.season ?? "",
  ).normalized;

  const kickoffTimestamp = Date.parse(fixture.startTime ?? "");

  if (!fixture.sport) {
    issues.push("Fixture sport is missing.");
  }

  if (!homeTeam) {
    issues.push("Home team name is missing.");
  }

  if (!awayTeam) {
    issues.push("Away team name is missing.");
  }

  if (homeTeam && homeTeam === awayTeam) {
    issues.push("Home and away teams cannot be identical.");
  }

  if (!competition) {
    issues.push("Competition name is missing.");
  }

  if (!Number.isFinite(kickoffTimestamp)) {
    issues.push("Fixture kickoff time is invalid.");
  }

  if (issues.length > 0) {
    return {
      valid: false,
      identity: null,
      issues,
    };
  }

  const kickoffDateUtc = new Date(kickoffTimestamp)
    .toISOString()
    .slice(0, 10);

  // Sort participant names so reversed provider ordering
  // produces the same fixture identity.
  const participants = [homeTeam, awayTeam].sort();

  const key = [
    fixture.sport,
    competitionCountry,
    competition,
    season,
    kickoffDateUtc,
    participants[0],
    participants[1],
  ].join("|");

  return {
    valid: true,
    identity: {
      key,
      sport: fixture.sport,
      competition,
      competitionCountry,
      season,
      homeTeam,
      awayTeam,
      kickoffTimestamp,
      kickoffDateUtc,
    },
    issues: [],
  };
}
