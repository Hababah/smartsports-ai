
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assessTicketRisk,
} from "./ticketRiskAssessment";

import type {
  SelectionCandidate,
} from "../../types/sports";

function makeCandidate(
  probability: number,
  fixtureId: string,
  homeId: string,
  awayId: string,
): SelectionCandidate {
  return {
    fixture: {
      id: fixtureId,
      home: { id: homeId },
      away: { id: awayId },
    },
    prediction: {
      lowerProbabilityBound: probability,
    },
  } as unknown as SelectionCandidate;
}

describe("ticket risk assessment", () => {
  it("marks an empty ticket as unassessed", () => {
    const result = assessTicketRisk([]);

    assert.equal(result.selectionCount, 0);
    assert.equal(result.riskLevel, "unassessed");
    assert.equal(
      result.independenceBaselineProbability,
      0,
    );
  });

  it("calculates the independence-based probability reference", () => {
    const candidates = [
      makeCandidate(0.8, "fixture-1", "team-a", "team-b"),
      makeCandidate(0.7, "fixture-2", "team-c", "team-d"),
      makeCandidate(0.6, "fixture-3", "team-e", "team-f"),
    ];

    const result = assessTicketRisk(candidates);

    assert.ok(
      Math.abs(
        result.independenceBaselineProbability - 0.336,
      ) < 1e-10,
    );
  });

  it("identifies the weakest selection probability", () => {
    const candidates = [
      makeCandidate(0.85, "fixture-1", "team-a", "team-b"),
      makeCandidate(0.42, "fixture-2", "team-c", "team-d"),
      makeCandidate(0.73, "fixture-3", "team-e", "team-f"),
    ];

    const result = assessTicketRisk(candidates);

    assert.equal(
      result.weakestSelectionProbability,
      0.42,
    );

    assert.ok(
      result.warnings.some((warning) =>
        warning.includes("below 50%"),
      ),
    );
  });

  it("detects repeated fixture groups", () => {
    const candidates = [
      makeCandidate(0.8, "fixture-1", "team-a", "team-b"),
      makeCandidate(0.7, "fixture-1", "team-a", "team-b"),
      makeCandidate(0.75, "fixture-2", "team-c", "team-d"),
    ];

    const result = assessTicketRisk(candidates);

    assert.equal(result.repeatedFixtureGroups, 1);
    assert.ok(
      result.warnings.some((warning) =>
        warning.includes("same fixture"),
      ),
    );
  });

  it("detects participants appearing in multiple selections", () => {
    const candidates = [
      makeCandidate(0.8, "fixture-1", "team-a", "team-b"),
      makeCandidate(0.7, "fixture-2", "team-a", "team-c"),
    ];

    const result = assessTicketRisk(candidates);

    assert.equal(result.repeatedParticipantGroups, 1);
    assert.ok(
      result.warnings.some((warning) =>
        warning.includes("participants appear"),
      ),
    );
  });

  it("rejects invalid probability bounds from assessment", () => {
    const candidates = [
      makeCandidate(0.8, "fixture-1", "team-a", "team-b"),
      makeCandidate(1.2, "fixture-2", "team-c", "team-d"),
    ];

    const result = assessTicketRisk(candidates);

    assert.equal(result.riskLevel, "unassessed");
    assert.equal(
      result.independenceBaselineProbability,
      0,
    );
    assert.ok(
      result.warnings.some((warning) =>
        warning.includes("invalid"),
      ),
    );
  });

  it("warns when a ticket contains at least 12 selections", () => {
    const candidates = Array.from(
      { length: 12 },
      (_, index) =>
        makeCandidate(
          0.8,
          `fixture-${index}`,
          `home-${index}`,
          `away-${index}`,
        ),
    );

    const result = assessTicketRisk(candidates);

    assert.ok(
      result.warnings.some((warning) =>
        warning.includes("at least 12 selections"),
      ),
    );
  });

  it("warns when a ticket contains at least 20 selections", () => {
    const candidates = Array.from(
      { length: 20 },
      (_, index) =>
        makeCandidate(
          0.8,
          `fixture-${index}`,
          `home-${index}`,
          `away-${index}`,
        ),
    );

    const result = assessTicketRisk(candidates);

    assert.ok(
      result.warnings.some((warning) =>
        warning.includes("at least 20 selections"),
      ),
    );
  });

  it("does not claim a calibrated risk level yet", () => {
    const candidates = [
      makeCandidate(0.95, "fixture-1", "team-a", "team-b"),
    ];

    const result = assessTicketRisk(candidates);

    assert.equal(result.riskLevel, "unassessed");
  });
});
