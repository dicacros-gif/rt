import assert from "node:assert/strict";
import test from "node:test";
import { extractDaumRealtimeKeywords } from "../lib/daum-trends.mjs";

test("extracts only the right-side realtime trend array by display rank", () => {
  const html = `
    {"keyword":"기사 제목","rank":1}
    {"uiType":"REALTIME_TREND_TOP","contents":{"data":{"updatedAt":"2026-07-28T21:00:00+09:00",
    "keywords":[
      {"keyword":"세 번째 검색어","rank":22,"displayRank":3,"status":"new"},
      {"keyword":"첫 번째 검색어","rank":2,"displayRank":1,"status":"0"},
      {"keyword":"두 번째 검색어","rank":9,"displayRank":2,"status":"3"}
    ]}},"contentsStatus":{"data":"SUCCESS"}}
    {"keyword":"다른 영역 검색어","rank":2}
  `;

  assert.deepEqual(extractDaumRealtimeKeywords(html), [
    "첫 번째 검색어",
    "두 번째 검색어",
    "세 번째 검색어",
  ]);
});

test("returns no keywords when the realtime trend widget is absent", () => {
  assert.deepEqual(
    extractDaumRealtimeKeywords('{"keywords":[{"keyword":"뉴스 기사"}]}'),
    [],
  );
});
