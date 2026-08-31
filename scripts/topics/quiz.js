import { getRecent, pushRecent } from "../lib/state.js";

const CATEGORIES = {
  월: "과학·자연",
  화: "역사·인물",
  수: "경제·시사용어",
  목: "한국·세계 지리",
  금: "문화·예술",
  토: "스포츠·엔터",
  일: "종합 (아무거나)",
};

export default {
  slug: "quiz",
  title: "데일리 상식 퀴즈",
  emoji: "🧠",
  desc: "매일 5문제 상식 퀴즈 + 해설",

  async run({ date, weekday, askJSON }) {
    const category = CATEGORIES[weekday] ?? "종합";
    const recent = getRecent("quiz");

    const prompt = `너는 상식 퀴즈 출제자야. ${date} (${weekday}요일)의 퀴즈 5문제를 만들어.

오늘의 카테고리: **${category}**
난이도 구성: 쉬움 2, 보통 2, 어려움 1
${recent.length ? `최근에 낸 문제 주제 (중복 금지): ${recent.join(", ")}` : ""}

규칙:
- 정답이 논쟁의 여지 없이 명확한 사실만 출제
- 보기 4개는 그럴듯해야 함 (뻔한 오답 금지)
- 해설은 정답의 근거 + 알아두면 좋은 상식 한 스푼

JSON 스키마:
{
  "category": "${category}",
  "questions": [
    {
      "level": "쉬움|보통|어려움",
      "q": "문제",
      "choices": ["보기1", "보기2", "보기3", "보기4"],
      "answer_index": 0,
      "explanation": "해설 2~3문장",
      "topic": "이 문제의 핵심 주제어 하나 (중복 방지 기록용)"
    }
  ]
}
questions는 정확히 5개.`;

    const json = await askJSON(prompt);
    // LLM은 정답을 특정 위치에 몰아넣는 편향이 있어(실측: 5문제 전부 2번) 코드에서 셔플한다
    for (const q of json.questions ?? []) {
      const correct = q.choices[q.answer_index];
      for (let i = q.choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [q.choices[i], q.choices[j]] = [q.choices[j], q.choices[i]];
      }
      q.answer_index = q.choices.indexOf(correct);
    }
    const md = [
      `# 🧠 데일리 상식 퀴즈 — ${date}`,
      "",
      `> 오늘의 카테고리: **${json.category}**`,
      "",
      ...(json.questions ?? []).flatMap((q, i) => [
        `## Q${i + 1}. ${q.q} (${q.level})`,
        ...q.choices.map((c, j) => `- ${j + 1}) ${c}`),
        "",
      ]),
      "---",
      "",
      "## 정답과 해설",
      ...(json.questions ?? []).map(
        (q, i) => `- **Q${i + 1} 정답: ${q.answer_index + 1}) ${q.choices[q.answer_index]}** — ${q.explanation}`
      ),
    ].join("\n");

    return {
      json,
      markdown: md,
      commit() {
        pushRecent("quiz", (json.questions ?? []).map((q) => q.topic).filter(Boolean));
      },
    };
  },
};
