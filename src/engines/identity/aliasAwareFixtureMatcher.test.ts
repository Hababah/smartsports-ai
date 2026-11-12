
import test from "node:test";
import assert from "node:assert/strict";

import { createCandidate } from "../../tickets/testFixtures";
import {
  matchFixturesWithAliases,
} from "./aliasAwareFixtureMatcher";
import type { EntityAliasEntry } from "./entityAliasRegistry";

const registry: EntityAliasEntry[] = [
  {
    sport: "football",
    entityType: "team",
    canonicalName: "Manchester United",
    aliases: ["Man United", "Manchester Utd"],
    country: "England",
  },
  {
    sport: "football",
    entityType: "team",
    canonicalName: "Arsenal",
    aliases: ["Arsenal FC"],
    country: "England",
  },
  {
    sport: "football",
    entityType: "competition",
    canonicalName: "Premier League",
    aliases: ["EPL", "English Premier League"],
    country: "England",
  },
  {
    sport: "football",
    entityType: "competition",
    canonicalName: "Test League",
    aliases: ["Test League"],
    country: "Nigeria",
  },
];


test("matches fixtures using registered team aliases", () => {
  const base = createCandidate(1).fixture;

  const first = {
    ...base,
    home: {
      ...base.home,
      name: "Manchester United",
    },
    away: {
      ...base.away,
      name: "Arsenal",
    },
  };

  const second = {
    ...first,
    home: {
      ...first.home,
      name: "Man United",
    },
    away: {
      ...first.away,
      name: "Arsenal FC",
    },
  };

  const result = matchFixturesWithAliases(
    first,
    second,
    registry,
  );

  assert.equal(result.status, "confirmed");
});


test("matches fixtures using registered competition aliases", () => {
  const first = createCandidate(1).fixture;

  const second = {
    ...first,
    competition: {
      ...first.competition,
      name: "Test League",
    },
  };

  const result = matchFixturesWithAliases(
    first,
    second,
    registry,
  );

  assert.equal(result.status, "confirmed");
});

test("preserves exact-name matching for unknown aliases", () => {
  const first = createCandidate(1).fixture;
  const second = {
    ...first,
    providerId: "another-provider",
  };

  const result = matchFixturesWithAliases(
    first,
    second,
    [],
  );

  assert.equal(result.status, "confirmed");
});


test("does not confirm ambiguous aliases", () => {
  const first = createCandidate(1).fixture;

  const conflictingRegistry: EntityAliasEntry[] = [
    ...registry,
    {
      sport: "football",
      entityType: "team",
      canonicalName: "Different Club",
      aliases: [first.home.name],
      country: "Nigeria",
    },
    {
      sport: "football",
      entityType: "team",
      canonicalName: "Another Different Club",
      aliases: [first.home.name],
      country: "Nigeria",
    },
  ];

  const result = matchFixturesWithAliases(
    first,
    first,
    conflictingRegistry,
  );

  assert.equal(result.status, "possible");
  assert.ok(result.confidence <= 0.5);
  assert.ok(
    result.issues.some((issue) => issue.includes("ambiguous")),
  );
});


test("does not match fixtures across different sports", () => {
  const first = createCandidate(1).fixture;

  const second = {
    ...first,
    sport: "basketball" as const,
  };

  const result = matchFixturesWithAliases(
    first,
    second,
    registry,
  );

  assert.equal(result.status, "rejected");
});

test("does not mutate original provider fixture records", () => {
  const first = createCandidate(1).fixture;

  const second = {
    ...first,
    home: {
      ...first.home,
      name: "Man United",
    },
  };

  const originalName = second.home.name;

  matchFixturesWithAliases(first, second, registry);

  assert.equal(second.home.name, originalName);
});

test("rejects an invalid alias registry", () => {
  const fixture = createCandidate(1).fixture;

  const result = matchFixturesWithAliases(
    fixture,
    fixture,
    null as unknown as EntityAliasEntry[],
  );

  assert.equal(result.status, "rejected");
  assert.ok(result.issues.includes("Alias registry is invalid."));
});


test("rejects missing fixture records without throwing", () => {
  const result = matchFixturesWithAliases(
    null as unknown as ReturnType<typeof createCandidate>["fixture"],
    createCandidate(1).fixture,
    registry,
  );

  assert.equal(result.status, "rejected");
  assert.ok(result.issues.includes("Both fixture records are required."));
});

test("rejects fixtures missing required identity fields", () => {
  const fixture = createCandidate(1).fixture;

  const invalid = {
    ...fixture,
    home: undefined,
  } as unknown as typeof fixture;

  const result = matchFixturesWithAliases(
    invalid,
    fixture,
    registry,
  );

  assert.equal(result.status, "rejected");
  assert.ok(
    result.issues.includes(
      "Fixture is missing required identity fields.",
    ),
  );
});
