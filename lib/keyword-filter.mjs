const matchupSeparator = /\s+(?:vs\.?|versus|대)\s+/iu;
const harmfulPattern = /사망|숨진|숨져|별세|살인|살해|피살|시신|극단적\s*선택|19금|야동|음란|포르노|성관계|성폭력|성추행|강간|이혼|파경|혐오|극혐|비하(?!인드)|차별(?!화)/iu;
const adultPattern = /(?:^|[^가-힣])성인(?:$|[^가-힣])|성인(?:물|영상|사이트|콘텐츠|방송|만화|용품|인증|게임)/iu;
const lotteryQuizPattern = /로또|복권|당첨\s*번호|행운\s*번호|퀴즈|정답|캐시워크|오퀴즈/iu;
const sportsLatinPattern = /(?:^|[^A-Za-z0-9가-힣])(?:ssg|kia|nc|kbo|mlb|epl|nba|nfl|nhl|ufc|fifa|afc|fc|klpga|lpga|kpga|pga|kbl|wkbl|kovo|lafc|pba|lpba|wta|atp|wbc|f1|mvp)(?=$|[^A-Za-z0-9가-힣])/iu;
const sportsPattern = /야구|축구|농구|배구(?!조)|골프|테니스|배드민턴|탁구|수영(?!복)|육상|복싱|격투기|사격|양궁|역도|승마|빙상|스케이팅|스켈레톤|아이스\s*하키|하키|스키(?:장|선수|대회|경기|점프|알파인|크로스|팀|국가대표|월드컵)|스노보드|컬링|레이싱|바둑|체스|리그오브레전드|e스포츠|올림픽|월드컵|아시안게임|프로야구|프로축구|선수|투수|타자|포수|외야수|내야수|야수|구단|트레이드|홈런|이닝|무실점|안타|무안타|타구|타율|방어율|볼넷|삼진|도루|타점|세이브|홀드|투구|등판|마운드|득점|실점|승점|완봉|완투|승부차기|준우승|챔피언십|개막전|챔피언스리그|프리미어리그|메이저\s*리그|k\s*리그\d?|퓨처스리그|리그스?컵|한화이글스|두산베어스|롯데자이언츠|삼성라이온즈|키움히어로즈|lg트윈스|kt위즈|nc다이노스|ssg랜더스|kia타이거즈|울산현대|전북현대|fc서울|수원삼성|포항스틸러스|첼시|아스널|리버풀|맨유|맨시티|토트넘|바르셀로나|레알마드리드|바이에른/iu;
const sportsContextPattern = /시구|시타|결승타|연승|연패|무승부|국가대표|대표팀|드래프트|교체\s*출전|릴레이\s*경기|선두\s*질주|연속골|오로라월드\s*(?:선두|우승|챔피언십)|\d+\s*경기(?:\s*(?:연속|무안타|출전|출장|결장|침묵|만에|째|차|승|패))?|(?:홈|원정|개막|결승|준결승|정규|시범)\s*경기|경기\s*(?:결과|일정|중계|출전|출장|복귀|결장|취소|승리|패배)|(?:kt|lg|nc|kia|ssg|두산|삼성|롯데|한화|키움)\s*전(?:\s|$)|\d+\s*(?:승|패|골|홈런|안타|타점|이닝|세이브|홀드)(?:\s|$|[!,.)])|(?:^|\s)골(?:\s|$|[!,.)])/iu;
const sportsPersonPattern = /임지민|이정후|최혜진|고영표|이숭용|하영민|류중일|김민솔|김시우|최민석|손흥민|황희찬|백인천|추신수|배지환|힐리어드|장은수|이강인|강채연|염경엽|시메오네|배준호|마레스카|김원형|송교창|설종진|지단|만치니/iu;
const sportsNamedCoachPattern = /사비(?:,|\s).*감독/iu;
const sportsTeamResultPattern = /(?:두산|한화|롯데|삼성|키움|lg|kt|nc|ssg|kia|울산|전북|수원|포항|대전|광주|강원|안양|부천|김해)\s*[·,]?\s*(?:두산|한화|롯데|삼성|키움|lg|kt|nc|ssg|kia|울산|전북|수원|포항|대전|광주|강원|안양|부천|김해).*(?:경기|승리|패배|무승부|선두|잡고|꺾고)/iu;

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
    || sportsPattern.test(keyword)
    || sportsContextPattern.test(keyword)
    || sportsPersonPattern.test(keyword)
    || sportsNamedCoachPattern.test(keyword)
    || sportsTeamResultPattern.test(keyword);
}
