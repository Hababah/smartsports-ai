
import type { Sport } from "../../types/sports";
import { normalizeEntityName } from "./fixtureNormalization";

export type EntityType = "team" | "competition";

export interface EntityAliasEntry {
  sport: Sport;
  entityType: EntityType;
  canonicalName: string;
  aliases: string[];
  country?: string;
}

export interface EntityAliasQuery {
  sport: Sport;
  entityType: EntityType;
  name: string;
  country?: string;
}

export type EntityAliasStatus =
  | "resolved"
  | "unknown"
  | "ambiguous";

export interface EntityAliasResult {
  status: EntityAliasStatus;
  canonicalName: string | null;
  matches: string[];
  issues: string[];
}

function normalize(value: string | undefined): string {
  return normalizeEntityName(value ?? "").normalized;
}

export function resolveEntityAlias(
  query: EntityAliasQuery,
  registry: EntityAliasEntry[],
): EntityAliasResult {
  if (!query || !Array.isArray(registry)) {
    return {
      status: "unknown",
      canonicalName: null,
      matches: [],
      issues: ["Invalid alias query or registry."],
    };
  }

  const queryName = normalize(query.name);

  if (!queryName) {
    return {
      status: "unknown",
      canonicalName: null,
      matches: [],
      issues: ["Entity name is missing."],
    };
  }

  const queryCountry = normalize(query.country);

  const matches = registry.filter((entry) => {
    if (
      entry.sport !== query.sport ||
      entry.entityType !== query.entityType
    ) {
      return false;
    }

    const entryCountry = normalize(entry.country);

    if (
      queryCountry &&
      entryCountry &&
      queryCountry !== entryCountry
    ) {
      return false;
    }

    const names = [
      entry.canonicalName,
      ...entry.aliases,
    ];

    return names.some(
      (name) => normalize(name) === queryName,
    );
  });

  const canonicalNames = new Map<string, string>();

  for (const entry of matches) {
    const key = normalize(entry.canonicalName);

    if (key) {
      canonicalNames.set(key, entry.canonicalName);
    }
  }

  const resolvedNames = [...canonicalNames.values()];

  if (resolvedNames.length === 0) {
    return {
      status: "unknown",
      canonicalName: null,
      matches: [],
      issues: ["No registered alias matches this entity."],
    };
  }

  if (resolvedNames.length > 1) {
    return {
      status: "ambiguous",
      canonicalName: null,
      matches: resolvedNames,
      issues: ["Alias maps to multiple canonical entities."],
    };
  }

  return {
    status: "resolved",
    canonicalName: resolvedNames[0],
    matches: resolvedNames,
    issues: [],
  };
}
