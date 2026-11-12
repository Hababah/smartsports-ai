
import test from "node:test";
import assert from "node:assert/strict";

import {
  areNormalizedNamesEqual,
  normalizeEntityName,
} from "./fixtureNormalization";

test("normalizes case and repeated whitespace", () => {
  const result = normalizeEntityName("  ARSENAL   FC  ");

  assert.equal(result.normalized, "arsenal fc");
});

test("normalizes accented characters", () => {
  const result = normalizeEntityName("Atlético Madrid");

  assert.equal(result.normalized, "atletico madrid");
});

test("normalizes punctuation consistently", () => {
  const result = normalizeEntityName("Paris-Saint-Germain");

  assert.equal(result.normalized, "paris saint germain");
});

test("normalizes ampersands without losing meaning", () => {
  const result = normalizeEntityName("Ajax & Sons");

  assert.equal(result.normalized, "ajax and sons");
});

test("preserves club suffixes by default", () => {
  const first = normalizeEntityName("Arsenal FC");
  const second = normalizeEntityName("Arsenal");

  assert.notEqual(first.normalized, second.normalized);
});

test("supports explicitly configured suffix removal", () => {
  const first = normalizeEntityName("Arsenal FC", {
    removeCommonClubSuffixes: true,
  });

  const second = normalizeEntityName("Arsenal", {
    removeCommonClubSuffixes: true,
  });

  assert.equal(first.normalized, second.normalized);
});

test("does not consider empty names equal", () => {
  assert.equal(areNormalizedNamesEqual("", ""), false);
});

test("compares normalized names", () => {
  assert.equal(
    areNormalizedNamesEqual("Atlético Madrid", "Atletico Madrid"),
    true,
  );
});

test("preserves original input", () => {
  const result = normalizeEntityName("  Real Madrid  ");

  assert.equal(result.original, "  Real Madrid  ");
  assert.equal(result.normalized, "real madrid");
});

test("returns normalized tokens", () => {
  const result = normalizeEntityName("Manchester City");

  assert.deepEqual(result.tokens, ["manchester", "city"]);
});
