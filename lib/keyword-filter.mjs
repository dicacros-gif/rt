const matchupSeparator = /\s+(?:vs\.?|versus|대)\s+/iu;
const harmfulPattern = /사망|숨진|숨져|별세|살인|살해|피살|시신|극단적\s*선택|19금|야동|음란|포르노|성관계|성폭력|성추행|강간|이혼|파경|혐오|극혐|비하(?!인드)|차별(?!화)/iu;
const adultPattern = /(?:^|[^가-힣])성인(?:$|[^가-힣])|성인(?:물|영상|사이트|콘텐츠|방송|만화|용품|인증|게임)/iu;
const lotteryQuizPattern = /로또|복권|당첨\s*번호|행운\s*번호|퀴즈|정답|캐시워크|오퀴즈/iu;
const sportsLatinPattern = /\b(?:ssg|kia|kbo|mlb|epl|nba|nfl|nhl|ufc|fifa|afc|fc)\b/iu;
const sportsPattern = /야구|축구|농구|배구(?!조)|골프|테니스|배드민턴|탁구|수영(?!복)|육상|복싱|격투기|올림픽|월드컵|아시안게임|프로야구|프로축구|선수|투수|타자|포수|외야수|내야수|구단|트레이드|홈런|이닝|무실점|원정\s*경기|선발\s*등판|완봉|승점|챔피언스리그|프리미어리그|한화이글스|두산베어스|롯데자이언츠|삼성라이온즈|키움히어로즈|lg트윈스|kt위즈|nc다이노스|ssg랜더스|kia타이거즈|울산현대|전북현대|fc서울|수원삼성|포항스틸러스|첼시|아스널|리버풀|맨유|맨시티|토트넘|바르셀로나|레알마드리드|바이에른/iu;

/**
 * Excludes head-to-head sports queries such as
 * "Chelsea vs Western Sydney Wanderers FC" and "KIA 대 삼성".
 */
export function isMatchupKeyword(value) {
  const keyword = String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!keyword) return false;

  const parts = keyword.split(matchupSeparator);
  return parts.length >= 2 && parts.every((part) => part.trim().length > 0);
}

/**
 * Blocks categories that must never be stored or displayed.
 */
export function isBlockedKeyword(value) {
  const keyword = String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!keyword) return false;

  return isMatchupKeyword(keyword)
    || harmfulPattern.test(keyword)
    || adultPattern.test(keyword)
    || lotteryQuizPattern.test(keyword)
    || sportsLatinPattern.test(keyword)
    || sportsPattern.test(keyword);
}
