import assert from "node:assert/strict";
import test from "node:test";
import { isMatchupKeyword } from "../lib/keyword-filter.mjs";

test("filters English and Korean head-to-head sports queries", () => {
  assert.equal(isMatchupKeyword("chelsea vs western sydney wanderers fc"), true);
  assert.equal(isMatchupKeyword("Chelsea VS. Arsenal"), true);
  assert.equal(isMatchupKeyword("KIA 대 삼성"), true);
  assert.equal(isMatchupKeyword("두산 대 SSG"), true);
});

test("keeps ordinary keywords", () => {
  assert.equal(isMatchupKeyword("첼시 감독"), false);
  assert.equal(isMatchupKeyword("삼성그룹"), false);
  assert.equal(isMatchupKeyword("그래 이혼 하자"), false);
});
