
import type { Fixture } from "../../types/sports";
import {
  resolveEntityAlias,
  type EntityAliasEntry,
  type EntityAliasQuery,
} from "./entityAliasRegistry";
import {
  matchFixtures,
  DEFAULT_FIXTURE_MATCH_POLICY,
  type FixtureMatchPolicy,
  type FixtureMatchResult,
} from "./fixtureMatcher";

function resolveName(
  query: EntityAliasQuery,
  registry: EntityAliasEntry[],
) {
  return resolveEntityAlias(query, registry);
}

export function matchFixturesWithAliases(
  first: Fixture,
  second: Fixture,
  registry: EntityAliasEntry[],
  policy: FixtureMatchPolicy = DEFAULT_FIXTURE_MATCH_POLICY,
): FixtureMatchResult {
  if (
    !first ||
    typeof first !== "object" ||
    !second ||
    typeof second !== "object"
  ) {
    return {
      status: "rejected",
      confidence: 0,
      timeDifferenceMinutes: null,
      reversedParticipants: false,
      issues: ["Both fixture records are required."],
    };
  }

  if (
    !first.home ||
    !first.away ||
    !first.competition ||
    !second.home ||
    !second.away ||
    !second.competition ||
    !first.sport ||
    !second.sport
  ) {
    return {
      status: "rejected",
      confidence: 0,
      timeDifferenceMinutes: null,
      reversedParticipants: false,
      issues: ["Fixture is missing required identity fields."],
    };
  }

  if (!Array.isArray(registry)) {
    return {
      status: "rejected",
      confidence: 0,
      timeDifferenceMinutes: null,
      reversedParticipants: false,
      issues: ["Alias registry is invalid."],
    };
  }

  const resolveFixture = (fixture: Fixture) => {
    const home = resolveName(
      {
        sport: fixture.sport,
        entityType: "team",
        name: fixture.home.name,
        country: fixture.home.country,
      },
      registry,
    );

    const away = resolveName(
      {
        sport: fixture.sport,
        entityType: "team",
        name: fixture.away.name,
        country: fixture.away.country,
      },
      registry,
    );

    const competition = resolveName(
      {
        sport: fixture.sport,
        entityType: "competition",
        name: fixture.competition.name,
        country: fixture.competition.country,
      },
      registry,
    );

    return {
      fixture: {
        ...fixture,
        home: {
          ...fixture.home,
          name:
            home.status === "resolved"
              ? home.canonicalName!
              : fixture.home.name,
        },
        away: {
          ...fixture.away,
          name:
            away.status === "resolved"
              ? away.canonicalName!
              : fixture.away.name,
        },
        competition: {
          ...fixture.competition,
          name:
            competition.status === "resolved"
              ? competition.canonicalName!
              : fixture.competition.name,
        },
      },
      ambiguous: [home, away, competition].filter(
        (result) => result.status === "ambiguous",
      ),
    };
  };

  const firstResolved = resolveFixture(first);
  const secondResolved = resolveFixture(second);

  const result = matchFixtures(
    firstResolved.fixture,
    secondResolved.fixture,
    policy,
  );

  const ambiguousCount =
    firstResolved.ambiguous.length +
    secondResolved.ambiguous.length;

  if (ambiguousCount === 0) {
    return result;
  }

  // Preserve rejections caused by conflicts unrelated to alias ambiguity.
  const ambiguityCouldExplainRejection =
    result.issues.some(
      (issue) =>
        issue === "Participant names do not match." ||
        issue === "Competition names do not match.",
    );

  if (
    result.status === "rejected" &&
    !ambiguityCouldExplainRejection
  ) {
    return result;
  }

  return {
    ...result,
    status: "possible",
    confidence: Math.min(result.confidence, 0.5),
    issues: [
      ...result.issues,
      "One or more entity aliases are ambiguous and require review.",
    ],
  };
}
