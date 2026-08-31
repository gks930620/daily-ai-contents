import path from "node:path";
import { DATA_DIR, readJSON, writeJSON } from "../lib/util.js";

const QUEUE_FILE = path.join(DATA_DIR, "korean-topics.json");

export default {
  slug: "korean",
  title: "오늘의 맞춤법",
  emoji: "✏️",
  desc: "헷갈리는 맞춤법·우리말을 매일 하나씩",

  async run({ date, askJSON }) {
    const q = readJSON(QUEUE_FILE);
    if (!q?.topics?.length) throw new Error("korean-topics.json이 비어 있음");
    const idx = q.index % q.topics.length;
    const topic = q.topics[idx];

    const prompt = `너는 국어를 쉽고 재미있게 알려주는 선생님이야. 오늘의 헷갈리는 표현: **${topic}**

JSON 스키마:
{
  "topic": "${topic}",
  "quiz": "둘 중 뭐가 맞는지 고르게 하는 도입 문제 문장 (예: '오늘 회의가 [결재/결제]됐다')",
  "answer": "정답 표현",
  "rule": "구별하는 규칙을 쉬운 말로 2~3문장",
  "trick": "안 헷갈리는 암기 요령 1문장",
  "examples": [
    {"sentence": "올바른 예문 1", "note": "왜 이 표현인지 짧게"},
    {"sentence": "올바른 예문 2", "note": "짧은 설명"},
    {"sentence": "틀리기 쉬운 예문 (틀린 표기 → 올바른 표기)", "note": "짧은 설명"}
  ],
  "bonus": "관련해서 알아두면 좋은 우리말 상식 1~2문장"
}`;

    const json = await askJSON(prompt);
    const md = [
      `# ✏️ 오늘의 맞춤법 — ${json.topic}`,
      "",
      `> Q. ${json.quiz}`,
      "",
      `**정답: ${json.answer}**`,
      "",
      "## 구별법",
      json.rule,
      "",
      `**암기 요령** — ${json.trick}`,
      "",
      "## 예문으로 익히기",
      ...(json.examples ?? []).map((e) => `- ${e.sentence} — ${e.note}`),
      "",
      "---",
      json.bonus ?? "",
    ].join("\n");

    return {
      json,
      markdown: md,
      commit() {
        q.index = (idx + 1) % q.topics.length;
        writeJSON(QUEUE_FILE, q);
      },
    };
  },
};
