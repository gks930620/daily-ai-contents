# daily-ai-contents — Claude 자동화 프로젝트

GitHub Actions가 매일 새벽 Claude를 실행해 생활 콘텐츠 10종(+일요일 주간 다이제스트)을
자동 생성·게시하는 프로젝트. 상세 사용법은 [README.md](README.md).

라이브: https://gks930620.github.io/daily-ai-contents/

## 파이프라인

```
cron 03:00 KST (UTC 18:00)
 ① generate.js  주제별 모듈 실행 (scripts/topics/<slug>.js)
     - 사실 데이터는 코드가 수집 (Open-Meteo, 구글뉴스 RSS) → AI는 해석·집필만 (환각 방지)
     - claude -p 헤드리스 1회 호출/주제, JSON 강제 + 파싱 실패 시 1회 재시도
     - content/<날짜>/<slug>.json + .md 저장 (JSON=재활용용, MD=읽기용)
 ② build-site.js  content/ 전체 → docs/ 정적 사이트 + 정적 JSON API + RSS
 ③ 커밋·푸시 (워크플로) → GitHub Pages 재빌드
```

## 이 프로젝트의 규칙

- **cron은 UTC** — 워크플로 스케줄에 KST 병기. GitHub cron 지연 대비 새벽 3시 실행.
- **시크릿은 CLAUDE_CODE_OAUTH_TOKEN(구독 토큰)만** — ⚠️ API 키를 Secrets에 넣으면 종량 과금된다.
- **모델**: 데일리 주제는 sonnet(기본), 주간 다이제스트만 opus (`topic.model`).
  전역 변경은 저장소 Variables의 `CLAUDE_MODEL`.
- **docs/는 직접 수정 금지** — build-site.js가 매번 통째로 재생성한다. 사이트 수정은
  build-site.js(레이아웃·렌더러)에서 한다.
- **content/의 과거 산출물은 고쳐 쓰지 않는다** — 그날 생성 기록이다.
- **출력 스키마는 계약** — 주제 모듈의 프롬프트 JSON 스키마와 렌더링(md/커스텀 렌더러)은
  같은 파일(topics/<slug>.js) + build-site.js의 RENDERERS/summaryOf를 함께 고친다.
- **주제 큐(data/*.json)와 중복 방지 기록(data/state.json)은 생성 성공 시에만 전진**
  (`commit()` 콜백) — 실패한 날의 키워드는 다음 날 다시 시도된다.
- **주제 추가**: topics/<slug>.js 작성 → topics/index.js TOPICS에 등록. 그걸로 끝.
  `when(ctx)`로 발행 요일 제한, `model`로 주제별 모델 지정 가능.
- **백필·재생**: 수동 실행(workflow_dispatch)의 date 입력 또는 `DATE=YYYY-MM-DD node scripts/generate.js ...`
- **로컬 실행은 로그인된 claude CLI를 그대로 사용** — .env의 토큰은 CI Secrets 등록용.

## 참고: daily_fortune 프로젝트에서 가져온 운영 교훈

- 토큰 미등록이 실패 원인 1위 → 워크플로 시작에서 사전 체크
- opus로 데일리 대량 생성 시 구독 한도가 빠르게 소진됨(자동 실행 중단까지 갔던 원인) → sonnet 기본
- 커밋 전 pull 금지 — 커밋 후 `pull --rebase -X theirs` + 1회 재시도
- 프롬프트에 "좋은 예"를 단어로 박으면 그 예가 매일 반복된다 → 방향만 서술
