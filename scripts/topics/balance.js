import { getRecent, pushRecent } from "../lib/state.js";

export default {
  slug: "balance",
  title: "오늘의 밸런스 게임",
  emoji: "⚖️",
  desc: "매일 밸런스 게임 1개 + AI의 양측 변론",

  async run({ date, weekday, askJSON }) {
    const recent = getRecent("balance");

    const prompt = `너는 밸런스 게임 진행자이자 토론 코치야. ${date} (${weekday}요일)의 밸런스 게임을 만들어.

규칙:
- 정답이 없고 양쪽 다 고르는 사람이 실제로 있을 법한 대결 (60:40 이내로 갈릴 만한 것)
- 일상·연애·직장·돈·음식 등 누구나 공감할 소재
- 양측 변론은 각각 진지하고 설득력 있게 (한쪽 편들기 금지)
${recent.length ? `- 최근에 낸 주제 (중복 금지): ${recent.join(" / ")}` : ""}

JSON 스키마:
{
  "question": "밸런스 게임 질문",
  "option_a": "선택지 A",
  "option_b": "선택지 B",
  "case_a": {
    "title": "A를 골라야 하는 이유 요약 한 줄",
    "argument": "A측 변론 3~4문장",
    "type": "이런 사람이 A를 고른다 1문장"
  },
  "case_b": {
    "title": "B를 골라야 하는 이유 요약 한 줄",
    "argument": "B측 변론 3~4문장",
    "type": "이런 사람이 B를 고른다 1문장"
  },
  "twist": "고민을 더 어렵게 만드는 반전 조건 하나 (예: '단, A를 고르면 ...')"
}`;

    const json = await askJSON(prompt);
    const md = [
      `# ⚖️ 오늘의 밸런스 게임 — ${date}`,
      "",
      `## ${json.question}`,
      "",
      `**A. ${json.option_a}**  vs  **B. ${json.option_b}**`,
      "",
      `### 🅰️ ${json.case_a?.title}`,
      json.case_a?.argument ?? "",
      `> ${json.case_a?.type ?? ""}`,
      "",
      `### 🅱️ ${json.case_b?.title}`,
      json.case_b?.argument ?? "",
      `> ${json.case_b?.type ?? ""}`,
      "",
      "---",
      `**반전 조건** — ${json.twist}`,
    ].join("\n");

    return {
      json,
      markdown: md,
      commit() {
        pushRecent("balance", [json.question].filter(Boolean), 60);
      },
    };
  },
};
