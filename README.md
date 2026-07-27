# TREND NOW

네이버·구글·다음의 인기 흐름을 한 화면에서 최대 50위까지 보여주는 한국어 트렌드 대시보드입니다.

루트의 `index.html`을 브라우저로 열면 정적 화면을 바로 확인할 수 있습니다. 파일로 직접 연 경우 화면의 API 서버 주소 입력란에 배포 주소를 넣으면 실제 DB 데이터와 연결됩니다.

## 데이터 방식

- Google: Google Trends 대한민국 공개 RSS
- Naver: 네이버 뉴스 많이 본 뉴스의 제목 기반 화제어
- Daum: 다음 뉴스 많이 본 뉴스의 제목 기반 화제어
- 매시간 수집된 키워드는 D1 데이터베이스에 중복 없이 누적됩니다.
- 화면의 `×`를 누른 키워드는 즉시 삭제되며 차단 목록에 기록되어 다시 수집되지 않습니다.

네이버와 다음은 공식 실시간 검색어 서비스를 종료했으므로, 두 포털의 순위는 검색량 순위가 아닌 뉴스 관심도 기반 화제어입니다.

## 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
npm run dev
```

브라우저에서 개발 서버가 안내하는 주소를 여세요.

## 프로덕션 빌드

```bash
npm run build
npm run start
```

Cloudflare Worker 호환 빌드를 사용하며 GitHub 저장소, Codespaces 또는 일반 Node 개발 환경에서 실행할 수 있습니다.

## 1시간 자동 수집 설정

배포 환경에 D1 바인딩 `DB`와 비밀값 `CRON_SECRET`을 설정합니다. GitHub 저장소의 Actions secrets에는 다음 두 값을 등록합니다.

- `CRAWL_ENDPOINT`: 배포된 사이트 주소
- `CRON_SECRET`: 배포 환경과 동일한 임의의 긴 비밀값

`.github/workflows/hourly-crawl.yml`이 매시간 7분에 `/api/crawl`을 호출합니다. Cloudflare Cron Trigger를 사용하는 경우에도 Worker의 `scheduled` 핸들러가 같은 수집 작업을 실행합니다.
