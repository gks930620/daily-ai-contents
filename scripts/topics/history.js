export default {
  slug: "history",
  title: "역사 속 오늘",
  emoji: "📜",
  desc: "오늘 날짜에 일어난 역사적 사건을 이야기로",

  async run({ date, askJSON }) {
    const [, month, day] = date.split("-").map(Number);

    const prompt = `너는 역사를 재미있게 들려주는 이야기꾼이야. ${month}월 ${day}일에 실제로 일어난 역사적 사건들을 다뤄.

규칙:
- 실제로 ${month}월 ${day}일에 일어난 사건만. 날짜가 확실하지 않으면 그 사건은 빼
- 메인 사건 1개는 깊이 있게 (배경 → 사건 → 그 후), 나머지는 짧게
- 한국사 사건을 최소 1개 포함하려 노력하되, 확실한 게 없으면 무리하지 마
- 교과서 말투 금지. 옆에서 이야기해주듯이

JSON 스키마:
{
  "main": {
    "year": 1969,
    "title": "사건 이름",
    "story": "배경부터 결말까지 이야기로 4~6문장",
    "aftermath": "이 사건이 오늘날 우리에게 남긴 것 2~3문장"
  },
  "briefs": [
    {"year": 1900, "title": "사건", "summary": "1~2문장"},
    {"year": 1950, "title": "사건", "summary": "1~2문장"},
    {"year": 1980, "title": "사건", "summary": "1~2문장"}
  ],
  "quote": "오늘의 사건과 어울리는 명언이나 역사 속 발언 1개 (출처 포함)"
}`;

    const json = await askJSON(prompt);
    const md = [
      `# 📜 역사 속 오늘 — ${month}월 ${day}일`,
      "",
      `## ${json.main?.year}년, ${json.main?.title}`,
      "",
      json.main?.story ?? "",
      "",
      `**그 후** — ${json.main?.aftermath ?? ""}`,
      "",
      "## 같은 날의 다른 사건들",
      ...(json.briefs ?? []).map((b) => `- **${b.year}년 · ${b.title}** — ${b.summary}`),
      "",
      "---",
      `> ${json.quote}`,
    ].join("\n");
    return { json, markdown: md };
  },
};
