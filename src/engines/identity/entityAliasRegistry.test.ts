
import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveEntityAlias,
  type EntityAliasEntry,
} from "./entityAliasRegistry";

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
    aliases: ["English Premier League", "EPL"],
    country: "England",
  },
];

test("resolves a registered team alias", () => {
  const result = resolveEntityAlias(
    {
      sport: "football",
      entityType: "team",
      name: "Man United",
      country: "England",
    },
    registry,
  );

  assert.equal(result.status, "resolved");
  assert.equal(result.canonicalName, "Manchester United");
});

test("resolves canonical names directly", () => {
  const result = resolveEntityAlias(
    {
      sport: "football",
      entityType: "team",
      name: "Manchester United",
    },
    registry,
  );

  assert.equal(result.status, "resolved");
  assert.equal(result.canonicalName, "Manchester United");
});

test("normalizes case and punctuation in aliases", () => {
  const result = resolveEntityAlias(
    {
      sport: "football",
      entityType: "team",
      name: "MANCHESTER-UTD",
    },
    registry,
  );

  assert.equal(result.status, "resolved");
  assert.equal(result.canonicalName, "Manchester United");
});

test("keeps team and competition aliases separate", () => {
  const result = resolveEntityAlias(
    {
      sport: "football",
      entityType: "competition",
      name: "EPL",
    },
    registry,
  );

  assert.equal(result.status, "resolved");
  assert.equal(result.canonicalName, "Premier League");
});

test("does not resolve an alias across different sports", () => {
  const result = resolveEntityAlias(
    {
      sport: "basketball",
      entityType: "team",
      name: "Man United",
    },
    registry,
  );

  assert.equal(result.status, "unknown");
});

test("does not resolve a team alias as a competition", () => {
  const result = resolveEntityAlias(
    {
      sport: "football",
      entityType: "competition",
      name: "Man United",
    },
    registry,
  );

  assert.equal(result.status, "unknown");
});

test("filters conflicting country information", () => {
  const result = resolveEntityAlias(
    {
      sport: "football",
      entityType: "team",
      name: "Arsenal FC",
      country: "Spain",
    },
    registry,
  );

  assert.equal(result.status, "unknown");
});

test("marks aliases shared by different entities as ambiguous", () => {
  const conflictingRegistry: EntityAliasEntry[] = [
    ...registry,
    {
      sport: "football",
      entityType: "team",
      canonicalName: "Different United",
      aliases: ["Man United"],
      country: "England",
    },
  ];

  const result = resolveEntityAlias(
    {
      sport: "football",
      entityType: "team",
      name: "Man United",
    },
    conflictingRegistry,
  );

  assert.equal(result.status, "ambiguous");
  assert.equal(result.canonicalName, null);
  assert.equal(result.matches.length, 2);
});

test("does not invent matches for unknown names", () => {
  const result = resolveEntityAlias(
    {
      sport: "football",
      entityType: "team",
      name: "Completely Unknown Club",
    },
    registry,
  );

  assert.equal(result.status, "unknown");
});

test("rejects empty entity names", () => {
  const result = resolveEntityAlias(
    {
      sport: "football",
      entityType: "team",
      name: "   ",
    },
    registry,
  );

  assert.equal(result.status, "unknown");
  assert.ok(result.issues.includes("Entity name is missing."));
});
