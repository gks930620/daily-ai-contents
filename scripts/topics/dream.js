import path from "node:path";
import { DATA_DIR, readJSON, writeJSON } from "../lib/util.js";

const QUEUE_FILE = path.join(DATA_DIR, "dream-keywords.json");
const PER_DAY = 3;

export default {
  slug: "dream",
  title: "꿈해몽 사전",
  emoji: "🌙",
  desc: "매일 꿈 키워드 3개씩 해몽 사전을 확장",

  async run({ date, askJSON }) {
    const q = readJSON(QUEUE_FILE);
    if (!q?.keywords?.length) throw new Error("dream-keywords.json이 비어 있음");
    const start = q.index % q.keywords.length;
    const todays = Array.from({ length: PER_DAY }, (_, i) => q.keywords[(start + i) % q.keywords.length]);

    const prompt = `너는 전통 해몽과 현대 심리학 관점을 함께 다루는 꿈해몽 전문가야. 아래 3개 꿈 키워드에 대한 해몽 사전 항목을 만들어.

오늘의 키워드: ${todays.join(", ")}

JSON 스키마:
{
  "entries": [
    {
      "keyword": "키워드",
      "one_line": "이 꿈의 핵심 의미 한 줄",
      "scenarios": [
        {"case": "구체적 상황 (예: 뱀에게 물리는 꿈)", "meaning": "전통 해몽 해석 2~3문장"},
        {"case": "다른 상황", "meaning": "해석"},
        {"case": "또 다른 상황", "meaning": "해석"}
      ],
      "psychology": "현대 심리학 관점에서의 해석 2~3문장",
      "advice": "이 꿈을 꾼 사람에게 주는 따뜻한 조언 1~2문장"
    }
  ]
}
키워드당 scenarios는 정확히 3개. 미신을 단정하지 말고 '전통적으로 ~로 해석한다' 톤을 유지해.`;

    const json = await askJSON(prompt);
    const md = [
      `# 🌙 오늘의 꿈해몽 — ${date}`,
      "",
      `오늘 추가된 키워드: ${todays.map((k) => `**${k}**`).join(", ")}`,
      "",
      ...(json.entries ?? []).flatMap((e) => [
        `## ${e.keyword} 꿈`,
        `> ${e.one_line}`,
        "",
        ...(e.scenarios ?? []).map((s) => `- **${s.case}** — ${s.meaning}`),
        "",
        `### 심리학적으로 보면`,
        e.psychology,
        "",
        `### 조언`,
        e.advice,
        "",
        "---",
        "",
      ]),
    ].join("\n");

    return {
      json: { keywords: todays, ...json },
      markdown: md,
      commit() {
        q.index = (start + PER_DAY) % q.keywords.length;
        writeJSON(QUEUE_FILE, q);
      },
    };
  },
};
