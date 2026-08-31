import { getRecent, pushRecent } from "../lib/state.js";

function seasonOf(month) {
  if (month >= 3 && month <= 5) return "봄";
  if (month >= 6 && month <= 8) return "여름";
  if (month >= 9 && month <= 11) return "가을";
  return "겨울";
}

export default {
  slug: "dinner",
  title: "오늘 뭐 먹지",
  emoji: "🍽️",
  desc: "매일 저녁 메뉴 3가지 추천 + 간단 레시피",

  async run({ date, weekday, askJSON }) {
    const month = Number(date.split("-")[1]);
    const season = seasonOf(month);
    const recent = getRecent("dinner");

    const prompt = `너는 "오늘 저녁 뭐 먹지?"를 해결해주는 요리 큐레이터야. ${date} (${weekday}요일, ${season})의 저녁 메뉴를 추천해.

구성: 집밥 1개 (30분 내 조리), 간편식/초간단 1개 (15분 내), 외식/배달 1개
${recent.length ? `최근 추천한 메뉴 (중복 금지): ${recent.join(", ")}` : ""}

규칙:
- ${season} 제철 재료나 계절 분위기를 반영
- 요일 감성 반영 (금요일이면 좀 신나는 메뉴, 월요일이면 만만한 메뉴)
- 레시피는 요리 초보도 따라할 수 있게

JSON 스키마:
{
  "mood": "오늘 저녁의 컨셉 한 줄 (예: '월요일엔 설거지 적은 한 그릇')",
  "menus": [
    {
      "kind": "집밥|간편|외식",
      "name": "메뉴 이름",
      "why": "오늘 이 메뉴인 이유 1문장",
      "ingredients": ["재료1", "재료2"],
      "recipe": ["순서1", "순서2", "순서3"],
      "tip": "맛 살리는 팁 1문장"
    }
  ]
}
menus는 정확히 3개. 외식 메뉴는 ingredients와 recipe를 빈 배열로 두고 tip에 주문 팁을 써.`;

    const json = await askJSON(prompt);
    const md = [
      `# 🍽️ 오늘 뭐 먹지 — ${date}`,
      "",
      `> ${json.mood}`,
      "",
      ...(json.menus ?? []).flatMap((m) => [
        `## [${m.kind}] ${m.name}`,
        m.why,
        "",
        ...(m.ingredients?.length ? [`**재료**: ${m.ingredients.join(", ")}`, ""] : []),
        ...(m.recipe?.length ? ["**만드는 법**", ...m.recipe.map((s, i) => `- ${i + 1}. ${s}`), ""] : []),
        `**팁** — ${m.tip}`,
        "",
      ]),
    ].join("\n");

    return {
      json,
      markdown: md,
      commit() {
        pushRecent("dinner", (json.menus ?? []).map((m) => m.name).filter(Boolean), 30);
      },
    };
  },
};
