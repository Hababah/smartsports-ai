
import test from "node:test";
import assert from "node:assert/strict";

import { createCandidate } from "../../tickets/testFixtures";
import { matchFixtures } from "./fixtureMatcher";

test("confirms matching fixtures with the same participants and kickoff", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    id: "provider-two-id",
    providerId: "provider-two-fixture",
    providerName: "Provider Two",
  };

  const result = matchFixtures(first, second);

  assert.equal(result.status, "confirmed");
  assert.equal(result.confidence, 1);
  assert.equal(result.timeDifferenceMinutes, 0);
});

test("confirms matching fixtures within the confirmed time tolerance", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    startTime: "2026-11-12T15:10:00.000Z",
  };

  const result = matchFixtures(first, second);

  assert.equal(result.status, "confirmed");
  assert.equal(result.timeDifferenceMinutes, 10);
});

test("marks a small kickoff difference beyond confirmation as possible", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    startTime: "2026-11-12T15:30:00.000Z",
  };

  const result = matchFixtures(first, second);

  assert.equal(result.status, "possible");
  assert.equal(result.timeDifferenceMinutes, 30);
});

test("rejects fixtures outside the possible time tolerance", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    startTime: "2026-11-12T19:00:00.000Z",
  };

  const result = matchFixtures(first, second);

  assert.equal(result.status, "rejected");
});

test("marks reversed participant ordering as possible", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    home: first.away,
    away: first.home,
  };

  const result = matchFixtures(first, second);

  assert.equal(result.status, "possible");
  assert.equal(result.reversedParticipants, true);
});

test("rejects different sports", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    sport: "basketball" as const,
  };

  assert.equal(matchFixtures(first, second).status, "rejected");
});

test("rejects different competitions", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    competition: {
      ...first.competition,
      name: "Different League",
    },
  };

  assert.equal(matchFixtures(first, second).status, "rejected");
});

test("rejects conflicting competition countries", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    competition: {
      ...first.competition,
      country: "England",
    },
  };

  assert.equal(matchFixtures(first, second).status, "rejected");
});


test("rejects conflicting competition seasons", () => {
  const first = createCandidate(1).fixture;

  const firstWithSeason = {
    ...first,
    competition: {
      ...first.competition,
      season: "2025/2026",
    },
  };

  const second = {
    ...firstWithSeason,
    competition: {
      ...firstWithSeason.competition,
      season: "2026/2027",
    },
  };

  const result = matchFixtures(firstWithSeason, second);

  assert.equal(result.status, "rejected");
  assert.ok(
    result.issues.includes("Competition seasons conflict."),
  );
});


test("rejects different participants", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    home: { ...first.home, name: "Another Team" },
  };

  assert.equal(matchFixtures(first, second).status, "rejected");
});

test("rejects invalid kickoff timestamps", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    startTime: "invalid-time",
  };

  assert.equal(matchFixtures(first, second).status, "rejected");
});

test("rejects an invalid matching policy", () => {
  const fixture = createCandidate(1).fixture;

  const result = matchFixtures(fixture, fixture, {
    confirmedTimeToleranceMinutes: 30,
    possibleTimeToleranceMinutes: 15,
  });

  assert.equal(result.status, "rejected");
  assert.ok(result.issues.includes("Fixture matching time policy is invalid."));
});