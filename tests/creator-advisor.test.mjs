import assert from "node:assert/strict";
import test from "node:test";
import { extractCreatorAdvisorKeywords } from "../lib/creator-advisor.mjs";

test("extracts only the 10 keywords rendered by the creator advisor card", () => {
  const payload = {
    result: "success",
    data: Array.from({ length: 20 }, (_, index) => `검색어 ${index + 1}`),
  };

  assert.deepEqual(
    extractCreatorAdvisorKeywords(payload),
    Array.from({ length: 10 }, (_, index) => `검색어 ${index + 1}`),
  );
});

test("ignores an unsuccessful payload", () => {
  assert.deepEqual(extractCreatorAdvisorKeywords('{"result":"error","data":["검색어"]}'), []);
});
