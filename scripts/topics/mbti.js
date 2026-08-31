const TYPES = [
  "ISTJ", "ISFJ", "INFJ", "INTJ",
  "ISTP", "ISFP", "INFP", "INTP",
  "ESTP", "ESFP", "ENFP", "ENTP",
  "ESTJ", "ESFJ", "ENFJ", "ENTJ",
];

export default {
  slug: "mbti",
  title: "MBTI별 오늘의 조언",
  emoji: "🎭",
  desc: "16개 유형별 오늘의 조언·주의점·행운 포인트",

  async run({ date, weekday, askJSON }) {
    const prompt = `너는 MBTI를 재치있게 풀어내는 작가야. ${date} (${weekday}요일), 16개 유형 각각의 "오늘의 조언"을 만들어.

규칙:
- 유형별 성격 특성이 실제로 드러나게 (아무 유형에나 갖다 붙일 수 있는 뻔한 말 금지)
- 점치는 말투 대신, 그 유형이 오늘 하루를 잘 보내는 팁이라는 톤
- 날짜와 요일 분위기를 살짝 반영 (예: 월요일이면 한 주의 시작)
- 유형 순서: ${TYPES.join(", ")}

JSON 스키마:
{
  "theme": "오늘 하루 전체를 관통하는 테마 한 줄",
  "types": [
    {
      "type": "ISTJ",
      "advice": "오늘의 조언 1~2문장 (유형 특성 반영)",
      "caution": "오늘 주의할 점 1문장",
      "lucky": "행운 포인트 (사물/행동/시간대 등 짧게)"
    }
  ]
}
types에는 16개 유형 모두, 위 순서대로.`;

    const json = await askJSON(prompt);
    const md = [
      `# 🎭 MBTI별 오늘의 조언 — ${date}`,
      "",
      `> 오늘의 테마: ${json.theme}`,
      "",
      ...(json.types ?? []).flatMap((t) => [
        `## ${t.type}`,
        `- **조언** ${t.advice}`,
        `- **주의** ${t.caution}`,
        `- **행운 포인트** ${t.lucky}`,
        "",
      ]),
    ].join("\n");
    return { json, markdown: md };
  },
};
