
import test from "node:test";
import assert from "node:assert/strict";

import {
  checkCandidateDuplicates,
  createSelectionDuplicateKey,
  findCrossTicketDuplicates,
} from "./duplicateChecker";

import { createCandidate } from "./testFixtures";

test("detects an exact duplicate selection in a candidate pool", () => {
  const first = createCandidate(1);
  const repeated = {
    ...first,
    id: "candidate-duplicate",
  };

  const result = checkCandidateDuplicates([
    first,
    repeated,
  ]);

  assert.equal(result.hasDuplicates, true);
  assert.equal(result.uniqueCandidates.length, 1);
  assert.equal(result.rejectedCandidates.length, 1);
});

test("allows different markets on the same fixture", () => {
  const first = createCandidate(2, {
    marketType: "match_winner",
  });

  const second = createCandidate(3, {
    fixtureId: first.fixture.id,
    marketType: "over_under",
  });

  assert.notEqual(
    createSelectionDuplicateKey(first),
    createSelectionDuplicateKey(second),
  );

  const result = checkCandidateDuplicates([
    first,
    second,
  ]);

  assert.equal(result.hasDuplicates, false);
  assert.equal(result.uniqueCandidates.length, 2);
});

test("detects the same exact selection across two tickets", () => {
  const first = createCandidate(4);
  const repeated = {
    ...first,
    id: "candidate-repeated",
  };

  const duplicates = findCrossTicketDuplicates([
    {
      ticketId: "ticket-1",
      candidates: [first],
    },
    {
      ticketId: "ticket-2",
      candidates: [repeated],
    },
  ]);

  assert.equal(duplicates.length, 1);
});

test("does not report different markets on one fixture as cross-ticket duplicates", () => {
  const first = createCandidate(5, {
    marketType: "match_winner",
  });

  const second = createCandidate(6, {
    fixtureId: first.fixture.id,
    marketType: "over_under",
  });

  const duplicates = findCrossTicketDuplicates([
    {
      ticketId: "ticket-1",
      candidates: [first],
    },
    {
      ticketId: "ticket-2",
      candidates: [second],
    },
  ]);

  assert.equal(duplicates.length, 0);
});
