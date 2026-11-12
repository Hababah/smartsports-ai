
import test from "node:test";
import assert from "node:assert/strict";

import { createCandidate } from "../../tickets/testFixtures";
import { createCanonicalFixtureIdentity } from "./canonicalFixtureIdentity";

test("creates a valid canonical fixture identity", () => {
  const result = createCanonicalFixtureIdentity(
    createCandidate(1).fixture,
  );

  assert.equal(result.valid, true);
  assert.ok(result.identity);
  assert.equal(result.issues.length, 0);
});

test("ignores provider-specific fixture IDs", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    id: "another-internal-id",
    providerId: "another-provider-id",
    providerName: "Another Provider",
  };

  const firstResult = createCanonicalFixtureIdentity(first);
  const secondResult = createCanonicalFixtureIdentity(second);

  assert.equal(
    firstResult.identity?.key,
    secondResult.identity?.key,
  );
});

test("recognises reversed participant ordering", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    home: first.away,
    away: first.home,
  };

  const firstResult = createCanonicalFixtureIdentity(first);
  const secondResult = createCanonicalFixtureIdentity(second);

  assert.equal(
    firstResult.identity?.key,
    secondResult.identity?.key,
  );

  assert.notEqual(
    firstResult.identity?.homeTeam,
    secondResult.identity?.homeTeam,
  );
});

test("distinguishes different sports", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    sport: "basketball" as const,
  };

  const firstResult = createCanonicalFixtureIdentity(first);
  const secondResult = createCanonicalFixtureIdentity(second);

  assert.notEqual(
    firstResult.identity?.key,
    secondResult.identity?.key,
  );
});

test("distinguishes different competitions", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    competition: {
      ...first.competition,
      name: "Different League",
    },
  };

  const firstResult = createCanonicalFixtureIdentity(first);
  const secondResult = createCanonicalFixtureIdentity(second);

  assert.notEqual(
    firstResult.identity?.key,
    secondResult.identity?.key,
  );
});

test("distinguishes different kickoff dates", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    startTime: "2026-11-13T15:00:00.000Z",
  };

  const firstResult = createCanonicalFixtureIdentity(first);
  const secondResult = createCanonicalFixtureIdentity(second);

  assert.notEqual(
    firstResult.identity?.key,
    secondResult.identity?.key,
  );
});

test("preserves precise kickoff timestamps", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    startTime: "2026-11-12T15:15:00.000Z",
  };

  const firstResult = createCanonicalFixtureIdentity(first);
  const secondResult = createCanonicalFixtureIdentity(second);

  assert.equal(
    firstResult.identity?.key,
    secondResult.identity?.key,
  );

  assert.notEqual(
    firstResult.identity?.kickoffTimestamp,
    secondResult.identity?.kickoffTimestamp,
  );
});

test("rejects a missing home team", () => {
  const fixture = createCandidate(1).fixture;
  const invalid = {
    ...fixture,
    home: { ...fixture.home, name: "" },
  };

  const result = createCanonicalFixtureIdentity(invalid);

  assert.equal(result.valid, false);
  assert.equal(result.identity, null);
  assert.ok(result.issues.includes("Home team name is missing."));
});

test("rejects identical home and away teams", () => {
  const fixture = createCandidate(1).fixture;
  const invalid = {
    ...fixture,
    away: fixture.home,
  };

  const result = createCanonicalFixtureIdentity(invalid);

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.includes(
      "Home and away teams cannot be identical.",
    ),
  );
});

test("rejects invalid kickoff timestamps", () => {
  const fixture = createCandidate(1).fixture;
  const invalid = {
    ...fixture,
    startTime: "not-a-valid-date",
  };

  const result = createCanonicalFixtureIdentity(invalid);

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.includes("Fixture kickoff time is invalid."),
  );
});
