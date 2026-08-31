import { spawnSync } from "node:child_process";

// 기본은 sonnet — daily_fortune 운영 경험상 데일리 대량 생성에 opus를 쓰면
// 구독 토큰이 빠르게 소진된다(실제로 자동 실행을 중단했던 원인). 장문 주제만 개별로 opus 지정.
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

/**
 * Claude Code CLI 헤드리스 모드(`claude -p`)로 프롬프트 1회 실행.
 * - 로컬: 로그인된 claude CLI 자격증명을 그대로 사용
 * - CI:   환경변수 CLAUDE_CODE_OAUTH_TOKEN 사용 (GitHub Secrets)
 */
export function askClaude(prompt, { model = MODEL } = {}) {
  // --max-turns 1은 긴 출력(꿈해몽 3건·MBTI 16종)에서 "Reached max turns" 실패를 냈다.
  // 순수 생성이라 보통 1턴에 끝나지만, 세션이 헤맬 때를 대비해 약간의 여유 + 상한을 둔다.
  const res = spawnSync("claude", ["-p", "--model", model, "--max-turns", "8"], {
    input: prompt,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: process.platform === "win32",
    timeout: 5 * 60 * 1000,
  });
  if (res.error) throw new Error(`claude CLI 실행 실패: ${res.error.message}`);
  if (res.status !== 0) {
    throw new Error(`claude CLI 종료코드 ${res.status}: ${(res.stderr || res.stdout || "").slice(0, 500)}`);
  }
  return (res.stdout || "").trim();
}

/** 응답 텍스트에서 JSON 본문만 추출 */
function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("응답에서 JSON을 찾지 못함");
  return JSON.parse(body.slice(start, end + 1));
}

/** JSON 결과를 기대하는 호출. 파싱 실패 시 1회 재시도. */
export function askClaudeJSON(prompt, opts) {
  const strict =
    prompt + "\n\n중요: 반드시 위에서 정의한 스키마의 JSON 하나만 출력해. 코드펜스, 설명, 인사말 등 JSON 외의 텍스트는 절대 출력하지 마.";
  try {
    return extractJSON(askClaude(strict, opts));
  } catch (e) {
    console.warn(`  [retry] JSON 파싱 실패, 재시도: ${e.message}`);
    return extractJSON(askClaude(strict, opts));
  }
}
