# daily-ai-contents

매일 아침 06:30(KST), AI(Claude)가 **10가지 생활 콘텐츠**를 자동 생성하고 정적 사이트로 배포하는 프로젝트.

| # | 주제 | 설명 | 데이터 소스 |
|---|---|---|---|
| 🌤️ | 날씨 생활지수 | 전국 7개 도시 날씨·미세먼지 → 옷차림/우산/빨래/세차/마스크 지수 | Open-Meteo (무료·무키) |
| 🏛️ | 지원금·정책 브리핑 | 정책 뉴스 중 "돈 받거나 아낄 수 있는 것"만 쉬운 말로 | korea.kr RSS |
| 🌙 | 꿈해몽 사전 | 매일 키워드 3개씩 해몽 사전 확장 (SEO 자산 축적형) | 키워드 큐 |
| 🎭 | MBTI별 오늘의 조언 | 16개 유형별 조언·주의점·행운 포인트 | — |
| 📚 | 하루 한 권 책 요약 | 명저 1권 핵심 요약 + 오늘의 실천 | 도서 큐 (60권) |
| 🧠 | 데일리 상식 퀴즈 | 요일별 카테고리, 5문제 + 해설 (중복 방지) | — |
| 📜 | 역사 속 오늘 | 오늘 날짜의 역사적 사건 스토리텔링 | — |
| ✏️ | 오늘의 맞춤법 | 헷갈리는 표현 하나씩 (40개 로테이션) | 주제 큐 |
| 🍽️ | 오늘 뭐 먹지 | 계절·요일 반영 저녁 메뉴 3종 + 레시피 (중복 방지) | — |
| ⚖️ | 밸런스 게임 | 매일 1개 + AI 양측 변론 (중복 방지) | — |

## 아키텍처

```
GitHub Actions (매일 21:30 UTC = 06:30 KST)
  └─ scripts/generate.js all
       ├─ 주제별 데이터 수집 (Open-Meteo / RSS / 큐 파일)
       ├─ Claude Code CLI 헤드리스 호출 (claude -p) → JSON
       └─ content/YYYY-MM-DD/<slug>.json + .md 저장
  └─ scripts/build-site.js
       └─ docs/  정적 사이트 + 정적 JSON API (docs/data/**)
  └─ git commit & push  →  GitHub Pages 자동 배포
```

- **결과물은 JSON(재활용용) + Markdown(읽기용) 이중 저장** — 웹 배포는 그중 하나의 소비 방식일 뿐
- 의존성 0개 (Node 내장 기능만 사용), Node 20+
- 주제 큐(`data/*.json`)와 중복 방지 기록(`data/state.json`)은 생성 성공 시에만 전진하고 함께 커밋됨

## 설정 방법

### 1. GitHub 저장소 준비
```bash
git init && git add -A && git commit -m "init"
gh repo create daily-ai-contents --public --source=. --push
```

### 2. 시크릿 등록 (필수)
저장소 → Settings → Secrets and variables → Actions → **Secrets**:
- `CLAUDE_CODE_OAUTH_TOKEN` — `claude setup-token` 명령으로 발급한 토큰 (sk-ant-oat01-…)

### 3. 변수 등록 (선택)
같은 화면의 **Variables**:
- `BASE_URL` — 배포 주소 (예: `https://<계정>.github.io/daily-ai-contents`) → sitemap/canonical 생성됨
- `SITE_NAME` — 사이트 이름 (기본: `AI 데일리`)
- `CLAUDE_MODEL` — 기본 `claude-opus-5`, 비용 절약 시 `claude-sonnet-5`

### 4. GitHub Pages 켜기
저장소 → Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / 폴더 `/docs`

### 5. 첫 실행
Actions 탭 → `daily-contents` → **Run workflow** (topics: `all`)
이후엔 매일 06:30 KST 자동 실행.

## 로컬 실행

로컬에서는 로그인된 Claude Code CLI 자격증명을 그대로 사용하므로 토큰 설정이 필요 없다.

```bash
node scripts/generate.js all        # 전체 생성
node scripts/generate.js weather    # 특정 주제만
node scripts/build-site.js          # 사이트 빌드
# docs/index.html 을 브라우저로 열면 확인 가능
```

## 구조

```
scripts/
  generate.js          # 엔트리: 주제 실행 + content/ 저장
  build-site.js        # content/ → docs/ 정적 사이트 빌드
  lib/claude.js        # Claude Code CLI 헤드리스 호출 + JSON 파싱/재시도
  lib/util.js          # 날짜(KST)/파일/HTTP/RSS/Markdown 유틸
  lib/state.js         # 중복 방지 최근 기록 (data/state.json)
  topics/<slug>.js     # 주제별 모듈: 데이터 수집 → 프롬프트 → 렌더링
data/                  # 주제 큐 + 상태 (생성 성공 시 전진)
content/YYYY-MM-DD/    # 생성 결과 (json + md) — 영구 아카이브
docs/                  # 배포용 정적 사이트 (자동 생성물, 직접 수정 금지)
```

## 주제 추가하는 법

1. `scripts/topics/새주제.js` 생성 — `{ slug, title, emoji, desc, async run(ctx) }` 형태로 작성
   - `ctx = { date, weekday, askJSON }` / 반환 `{ json, markdown, commit? }`
2. `scripts/topics/index.js`의 `TOPICS` 배열에 추가
3. 끝. 생성·사이트·API에 자동 반영됨

## 토큰 비용

하루 Claude 호출 10회(주제당 1회), 호출당 출력 1~2천 토큰 수준.
`CLAUDE_MODEL` 변수를 `claude-sonnet-5`로 바꾸면 비용이 크게 줄어든다.
