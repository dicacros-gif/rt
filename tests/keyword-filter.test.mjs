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
  assert.equal(isBlockedKeyword("NC 임지민 수술 예정"), true);
  assert.equal(isBlockedKeyword("NC 임지민 턱뼈 분쇄골절"), true);
  assert.equal(isBlockedKeyword("임지민 타구 맞아 수술 예정"), true);
  assert.equal(isBlockedKeyword("이정후 3경기 무안타"), true);
  assert.equal(isBlockedKeyword("최혜진 포틀랜드 2위 유지"), true);
  assert.equal(isBlockedKeyword("KT 고영표 승리!"), true);
  assert.equal(isBlockedKeyword("이숭용 감독, 승리의 주역"), true);
  assert.equal(isBlockedKeyword("하영민 KT전 복귀 예정"), true);
  assert.equal(isBlockedKeyword("류중일"), true);
  assert.equal(isBlockedKeyword("김민솔 KLPGA 2R 단독 선두"), true);
  assert.equal(isBlockedKeyword("최민석 10승 달성!"), true);
  assert.equal(isBlockedKeyword("손흥민 LAFC 리그스컵"), true);
  assert.equal(isBlockedKeyword("백인천 감독"), true);
  assert.equal(isBlockedKeyword("유연정 시구"), true);
  assert.equal(isBlockedKeyword("추신수 메이저리그 연금"), true);
  assert.equal(isBlockedKeyword("KT 힐리어드 MVP"), true);
  assert.equal(isBlockedKeyword("팀 K리그 패배"), true);
  assert.equal(isBlockedKeyword("두산 LG 승리"), true);
  assert.equal(isBlockedKeyword("사격 국가대표 실탄 보관 적발"), true);
  assert.equal(isBlockedKeyword("한국여자바둑리그"), true);
  assert.equal(isBlockedKeyword("리그오브레전드"), true);
  assert.equal(isBlockedKeyword("지단 프랑스 감독"), true);
  assert.equal(isBlockedKeyword("김수지 오로라월드 선두"), true);
  assert.equal(isBlockedKeyword("김시우 1차전 준우승"), true);
  assert.equal(isBlockedKeyword("KT 키움 경기"), true);
  assert.equal(isBlockedKeyword("황희찬 챔피언십 개막전"), true);
  assert.equal(isBlockedKeyword("LG 스켈레톤 아이스하키 후원"), true);
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
  assert.equal(isBlockedKeyword("경기 침체 우려"), false);
  assert.equal(isBlockedKeyword("NC소프트 신작 발표"), false);
  assert.equal(isBlockedKeyword("KT 실적 발표"), false);
  assert.equal(isBlockedKeyword("영화감독 신작 공개"), false);
  assert.equal(isBlockedKeyword("김민석 경선 승리"), false);
  assert.equal(isBlockedKeyword("경기도교육청 교권보호"), false);
  assert.equal(isBlockedKeyword("양평 식당 붕괴 14명 부상"), false);
  assert.equal(isBlockedKeyword("볼로디미르 젤렌스키"), false);
  assert.equal(isBlockedKeyword("이승영 감독 신작"), false);
  assert.equal(isBlockedKeyword("LG유플러스 토스 페이스페이"), false);
});
