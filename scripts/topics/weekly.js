import fs from "node:fs";
import path from "node:path";
import { CONTENT_DIR, readJSON } from "../lib/util.js";
import { summaryOf } from "../lib/summary.js";

/** 최근 7일치 콘텐츠 요약을 모아 한 주 다이제스트 입력을 만든다 */
function collectWeek(todayStr) {
  const lines = [];
  const today = new Date(`${todayStr}T00:00:00+09:00`);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const dir = path.join(CONTENT_DIR, date);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const slug = f.replace(/\.json$/, "");
      if (slug === "weekly") continue;
      const j = readJSON(path.join(dir, f));
      const s = summaryOf(slug, j?.data ?? {});
      if (s) lines.push(`${date} [${j?.title ?? slug}] ${s}`);
    }
  }
  return lines;
}

export default {
  slug: "weekly",
  title: "주간 다이제스트",
  emoji: "🗞️",
  desc: "한 주의 콘텐츠를 되돌아보는 일요일 스페셜",

  // 일요일에만 생성. 주 1회 장문 에디토리얼이라 opus 사용 (데일리 주제들은 sonnet)
  when: ({ weekday }) => weekday === "일",
  model: "claude-opus-5",

  async run({ date, askJSON }) {
    const lines = collectWeek(date);
    if (lines.length < 5) throw new Error("이번 주 콘텐츠가 부족해 다이제스트를 만들 수 없음");

    const prompt = `너는 주간지 에디터야. 아래는 이번 주(${date} 기준 최근 7일)에 발행된 콘텐츠들의 요약 목록이야. 이걸 바탕으로 "한 주 되돌아보기" 다이제스트를 만들어.

[이번 주 발행 콘텐츠]
${lines.join("\n")}

JSON 스키마:
{
  "headline": "이번 주를 한 줄로 정리한 헤드라인",
  "intro": "한 주를 여는 에디터의 말 2~3문장 (계절감/시기 반영)",
  "picks": [
    {"title": "다시 볼 만한 콘텐츠를 소개하는 제목", "reason": "왜 추천하는지 1~2문장"},
    {"title": "...", "reason": "..."},
    {"title": "...", "reason": "..."}
  ],
  "numbers": "이번 주 발행량을 재치있게 표현한 한 줄 (예: '이번 주 퀴즈 35문제, 몇 개나 맞히셨나요?')",
  "next_week": "다음 주를 기대하게 만드는 마무리 한 줄"
}
picks는 실제 위 목록에 있는 콘텐츠에서만 골라. 정확히 3개.`;

    const json = await askJSON(prompt);
    const md = [
      `# 🗞️ 주간 다이제스트 — ${date}`,
      "",
      `> ${json.headline}`,
      "",
      json.intro,
      "",
      "## 이번 주 다시 보기",
      ...(json.picks ?? []).map((p) => `- **${p.title}** — ${p.reason}`),
      "",
      `${json.numbers ?? ""}`,
      "",
      "---",
      `${json.next_week ?? ""}`,
    ].join("\n");
    return { json, markdown: md };
  },
};
