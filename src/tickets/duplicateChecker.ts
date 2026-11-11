
import type {
  Fixture,
  SelectionCandidate,
} from "../types/sports";

export interface DuplicateMatch {
  duplicateKey: string;
  fixtureIds: string[];
  fixtureNames: string[];
  candidateIds: string[];
  reason: string;
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  duplicates: DuplicateMatch[];
  uniqueCandidates: SelectionCandidate[];
  rejectedCandidates: SelectionCandidate[];
}

export interface TicketFixtureGroup {
  ticketId: string;
  candidates: SelectionCandidate[];
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function createFixtureDuplicateKey(
  fixture: Fixture,
): string {
  const home = normalize(fixture.home.name);
  const away = normalize(fixture.away.name);
  const competition = normalize(fixture.competition.name);

  const date = new Date(fixture.startTime);

  if (!home || !away || !competition ||
      !Number.isFinite(date.getTime())) {
    return "";
  }

  const participants = [home, away].sort();

  return [
    fixture.sport,
    normalize(fixture.competition.country ?? ""),
    competition,
    date.toISOString().slice(0, 10),
    participants[0],
    participants[1],
  ].join("|");
}

/**
 * Identifies an exact selection rather than just its fixture.
 */
export function createSelectionDuplicateKey(
  candidate: SelectionCandidate,
): string {
  const fixtureKey = createFixtureDuplicateKey(candidate.fixture);

  if (
    !fixtureKey ||
    !candidate.market.id ||
    !candidate.outcome.id
  ) {
    return "";
  }

  return [
    fixtureKey,
    normalize(candidate.market.type),
    normalize(candidate.market.line?.toString() ?? ""),
    normalize(candidate.outcome.id),
    normalize(candidate.outcome.name),
  ].join("|");
}

/**
 * Finds repeated exact selections within a candidate pool.
 */
export function checkCandidateDuplicates(
  candidates: SelectionCandidate[],
): DuplicateCheckResult {
  const seen = new Map<string, SelectionCandidate>();
  const duplicateGroups = new Map<string, SelectionCandidate[]>();

  const uniqueCandidates: SelectionCandidate[] = [];
  const rejectedCandidates: SelectionCandidate[] = [];

  for (const candidate of candidates) {
    const key = createSelectionDuplicateKey(candidate);

    if (!key) {
      rejectedCandidates.push(candidate);
      continue;
    }

    const previous = seen.get(key);

    if (!previous) {
      seen.set(key, candidate);
      uniqueCandidates.push(candidate);
      continue;
    }

    const group = duplicateGroups.get(key) ?? [previous];
    group.push(candidate);
    duplicateGroups.set(key, group);
    rejectedCandidates.push(candidate);
  }

  const duplicates: DuplicateMatch[] = [];

  for (const [key, group] of duplicateGroups) {
    duplicates.push({
      duplicateKey: key,
      fixtureIds: [...new Set(
        group.map((item) => item.fixture.id),
      )],
      fixtureNames: [...new Set(
        group.map(
          (item) =>
            `${item.fixture.home.name} vs ${item.fixture.away.name}`,
        ),
      )],
      candidateIds: group.map((item) => item.id),
      reason: "The exact same selection appears more than once.",
    });
  }

  return {
    hasDuplicates: duplicates.length > 0,
    duplicates,
    uniqueCandidates,
    rejectedCandidates,
  };
}

/**
 * Detects repeated exact selections across generated tickets.
 * Different markets on the same fixture are allowed.
 */
export function findCrossTicketDuplicates(
  tickets: TicketFixtureGroup[],
): DuplicateMatch[] {
  const seen = new Map<string, string[]>();
  const details = new Map<string, SelectionCandidate[]>();

  for (const ticket of tickets) {
    for (const candidate of ticket.candidates) {
      const key = createSelectionDuplicateKey(candidate);

      if (!key) continue;

      const ticketIds = seen.get(key) ?? [];
      ticketIds.push(ticket.ticketId);
      seen.set(key, ticketIds);

      const group = details.get(key) ?? [];
      group.push(candidate);
      details.set(key, group);
    }
  }

  const duplicates: DuplicateMatch[] = [];

  for (const [key, ticketIds] of seen) {
    const uniqueTicketIds = [...new Set(ticketIds)];

    if (uniqueTicketIds.length < 2) continue;

    const group = details.get(key) ?? [];

    duplicates.push({
      duplicateKey: key,
      fixtureIds: [...new Set(
        group.map((item) => item.fixture.id),
      )],
      fixtureNames: [...new Set(
        group.map(
          (item) =>
            `${item.fixture.home.name} vs ${item.fixture.away.name}`,
        ),
      )],
      candidateIds: group.map((item) => item.id),
      reason: `Exact selection repeated across tickets: ${uniqueTicketIds.join(", ")}.`,
    });
  }

  return duplicates;
}

/**
 * Checks whether the exact same selection is already allocated.
 */
export function isSelectionAlreadyAllocated(
  candidate: SelectionCandidate,
  allocatedCandidates: SelectionCandidate[],
): boolean {
  const key = createSelectionDuplicateKey(candidate);

  if (!key) return true;

  return allocatedCandidates.some(
    (allocated) => createSelectionDuplicateKey(allocated) === key,
  );
}

/**
 * Fixture reuse is allowed by default.
 * This function only identifies whether the fixture has appeared before.
 */
export function isFixtureAlreadyAllocated(
  fixture: Fixture,
  allocatedFixtures: Fixture[],
): boolean {
  const key = createFixtureDuplicateKey(fixture);

  if (!key) return true;

  return allocatedFixtures.some(
    (allocated) => createFixtureDuplicateKey(allocated) === key,
  );
}
