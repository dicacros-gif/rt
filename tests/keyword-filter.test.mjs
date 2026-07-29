import assert from "node:assert/strict";
import test from "node:test";
import { isBlockedKeyword, isMatchupKeyword } from "../lib/keyword-filter.mjs";

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

test("blocks harmful and adult keywords", () => {
  assert.equal(isBlockedKeyword("배우 사망 소식"), true);
  assert.equal(isBlockedKeyword("살인 사건"), true);
  assert.equal(isBlockedKeyword("19금 성인 콘텐츠"), true);
  assert.equal(isBlockedKeyword("그래 이혼 하자"), true);
  assert.equal(isBlockedKeyword("혐오 발언"), true);
});

test("blocks sports keywords", () => {
  assert.equal(isBlockedKeyword("SSG 아빌라 무실점 6이닝"), true);
  assert.equal(isBlockedKeyword("KIA 하주석 첫 대구 원정"), true);
  assert.equal(isBlockedKeyword("첼시 감독"), true);
  assert.equal(isBlockedKeyword("프로야구 개막"), true);
});

test("blocks lottery and quiz keywords", () => {
  assert.equal(isBlockedKeyword("기후동행퀴즈7월27일"), true);
  assert.equal(isBlockedKeyword("로또 당첨번호"), true);
  assert.equal(isBlockedKeyword("캐시워크 정답"), true);
});

test("keeps unrelated ordinary keywords", () => {
  assert.equal(isBlockedKeyword("삼성그룹 실적 발표"), false);
  assert.equal(isBlockedKeyword("삼성그룹 지배구조"), false);
  assert.equal(isBlockedKeyword("원피스 수영복"), false);
  assert.equal(isBlockedKeyword("스모킹 비하인드"), false);
  assert.equal(isBlockedKeyword("성인병 예방 방법"), false);
  assert.equal(isBlockedKeyword("기후동행카드 신청"), false);
});
