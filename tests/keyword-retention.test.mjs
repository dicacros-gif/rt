import assert from "node:assert/strict";
import test from "node:test";
import {
  areSimilarKeywords,
  isExpiredKeywordDate,
  keywordRetentionCutoffIso,
  keywordSimilarityCutoffIso,
  selectAgedKeywordIdsToDelete,
} from "../lib/keyword-retention.mjs";

const now = Date.parse("2026-08-21T12:00:00.000Z");
const daysAgo = (days) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

test("recognizes close search variants without merging distinct topics", () => {
  assert.equal(areSimilarKeywords("김성균 배우", "김성균 영화배우"), true);
  assert.equal(areSimilarKeywords("김성균", "김성균 프로필"), true);
  assert.equal(areSimilarKeywords("삼성전자 실적 발표", "삼성전자 신제품 공개"), false);
});

test("keeps recent and unique aged keywords while deleting aged variants", () => {
  const deleteIds = selectAgedKeywordIdsToDelete([
    { id: 1, keyword: "김성균", firstSeenAt: daysAgo(8) },
    { id: 2, keyword: "김성균 배우", firstSeenAt: daysAgo(8) },
    { id: 3, keyword: "김성균 영화배우", firstSeenAt: daysAgo(9) },
    { id: 4, keyword: "서로 다른 유니크 키워드", firstSeenAt: daysAgo(10) },
    { id: 5, keyword: "최신 검색어", firstSeenAt: daysAgo(2) },
    { id: 6, keyword: "최신 검색어 관련", firstSeenAt: daysAgo(8) },
  ], now);
  assert.deepEqual([...deleteIds].sort(), ["2", "3", "6"]);
});

test("deletes every record older than 20 days", () => {
  const deleteIds = selectAgedKeywordIdsToDelete([
    { id: 1, keyword: "20일 경계", firstSeenAt: daysAgo(20) },
    { id: 2, keyword: "20일 초과", firstSeenAt: daysAgo(20) },
    { id: 3, keyword: "21일 지난 키워드", firstSeenAt: daysAgo(21) },
  ], now);
  assert.equal(deleteIds.has("3"), true);
  assert.equal(isExpiredKeywordDate(daysAgo(21), now), true);
  assert.equal(isExpiredKeywordDate(daysAgo(20), now), false);
});

test("creates ISO cutoffs for indexed database cleanup", () => {
  assert.equal(keywordSimilarityCutoffIso(now), "2026-08-14T12:00:00.000Z");
  assert.equal(keywordRetentionCutoffIso(now), "2026-08-01T12:00:00.000Z");
});
