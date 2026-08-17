import assert from "node:assert/strict";
import test from "node:test";
import {
  isExpiredKeywordDate,
  keywordRetentionCutoffIso,
} from "../lib/keyword-retention.mjs";

const now = Date.parse("2026-08-17T12:00:00.000Z");

test("expires keyword records older than 30 days", () => {
  assert.equal(isExpiredKeywordDate("2026-07-18T11:59:59.999Z", now), true);
  assert.equal(isExpiredKeywordDate("2026-07-18T12:00:00.000Z", now), false);
  assert.equal(isExpiredKeywordDate("2026-08-17T11:00:00.000Z", now), false);
  assert.equal(isExpiredKeywordDate("invalid", now), true);
});

test("creates an ISO cutoff suitable for indexed database deletion", () => {
  assert.equal(keywordRetentionCutoffIso(now), "2026-07-18T12:00:00.000Z");
});
