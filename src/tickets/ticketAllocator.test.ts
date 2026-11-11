
import test from "node:test";
import assert from "node:assert/strict";

import {
  allocateTickets,
  createOvernightPlans,
} from "./ticketAllocator";

import {
  createCandidate,
  TEST_GENERATION_TIME,
} from "./testFixtures";

test("creates two overnight ticket plans by default", () => {
  const plans = createOvernightPlans();

  assert.equal(plans.length, 2);
  assert.equal(plans[0].minimumSelections, 12);
  assert.equal(plans[0].maximumSelections, 30);
});

test("supports three overnight ticket plans", () => {
  const plans = createOvernightPlans(3);

  assert.equal(plans.length, 3);
});

test("qualifies an overnight ticket with 12 valid selections", () => {
  const candidates = Array.from(
    { length: 12 },
    (_, index) => createCandidate(index + 1),
  );

  const result = allocateTickets(candidates, {
    sessionId: "test-overnight",
    sessionType: "overnight",
    generatedAt: TEST_GENERATION_TIME,
  });

  assert.equal(result.tickets.length, 2);
  assert.equal(result.tickets[0].selectionCount, 12);
  assert.equal(result.tickets[0].status, "qualified");
  assert.equal(result.tickets[0].combinedOdds, 4096);
});

test("does not qualify an overnight ticket with only 11 selections", () => {
  const candidates = Array.from(
    { length: 11 },
    (_, index) => createCandidate(index + 1),
  );

  const result = allocateTickets(candidates, {
    sessionId: "test-insufficient",
    sessionType: "overnight",
    generatedAt: TEST_GENERATION_TIME,
  });

  assert.equal(result.tickets[0].status, "rejected");
  assert.equal(result.tickets[0].selectionCount, 11);
});

test("rejects expired predictions", () => {
  const candidate = createCandidate(1);

  candidate.prediction.expiresAt = "2026-11-10T00:00:00.000Z";

  const result = allocateTickets([candidate], {
    sessionId: "test-expired",
    sessionType: "overnight",
    generatedAt: TEST_GENERATION_TIME,
  });

  assert.equal(result.rejectedCandidates.length, 1);
  assert.equal(result.tickets[0].status, "rejected");
});

test("does not allocate an ineligible candidate", () => {
  const candidate = createCandidate(1);

  candidate.eligible = false;
  candidate.rejectionReasons = ["Test rejection."];

  const result = allocateTickets([candidate], {
    sessionId: "test-ineligible",
    sessionType: "overnight",
    generatedAt: TEST_GENERATION_TIME,
  });

  assert.equal(result.rejectedCandidates.length, 1);
  assert.equal(result.tickets[0].selectionCount, 0);
});

test("does not qualify a ticket below its minimum odds", () => {
  const candidates = Array.from(
    { length: 12 },
    (_, index) =>
      createCandidate(index + 1, { odds: 1.1 }),
  );

  const result = allocateTickets(candidates, {
    sessionId: "test-low-odds",
    sessionType: "overnight",
    generatedAt: TEST_GENERATION_TIME,
  });

  assert.equal(result.tickets[0].status, "rejected");
  assert.ok(result.tickets[0].combinedOdds < 2000);
});

test("does not allocate more than 30 selections to a ticket", () => {
  const candidates = Array.from(
    { length: 35 },
    (_, index) =>
      createCandidate(index + 1, { odds: 2 }),
  );

  const result = allocateTickets(candidates, {
    sessionId: "test-selection-limit",
    sessionType: "overnight",
    generatedAt: TEST_GENERATION_TIME,
  });

  assert.ok(result.tickets[0].selectionCount <= 30);
});

test("does not repeat the same exact pick across qualified tickets", () => {
  const candidates = Array.from(
    { length: 30 },
    (_, index) => createCandidate(index + 1),
  );

  const result = allocateTickets(candidates, {
    sessionId: "test-no-reuse",
    sessionType: "overnight",
    generatedAt: TEST_GENERATION_TIME,
  });

  const allocatedIds = result.tickets
    .filter((ticket) => ticket.status === "qualified")
    .flatMap((ticket) =>
      ticket.selections.map((selection) => selection.selectionId),
    );

  assert.equal(
    allocatedIds.length,
    new Set(allocatedIds).size,
  );
});

test("ranks qualified tickets from highest safety score to lowest", () => {
  const candidates = Array.from(
    { length: 30 },
    (_, index) => createCandidate(index + 1),
  );

  const result = allocateTickets(candidates, {
    sessionId: "test-ranking",
    sessionType: "overnight",
    generatedAt: TEST_GENERATION_TIME,
  });

  for (let index = 1; index < result.ranking.length; index += 1) {
    assert.ok(
      result.ranking[index - 1].safetyScore >=
      result.ranking[index].safetyScore,
    );
  }

  assert.equal(
    result.ranking.length,
    result.ranking.length > 0 ? 2 : 0,
  );
});
