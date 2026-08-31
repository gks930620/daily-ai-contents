import { fetchText, parseRssItems } from "../lib/util.js";

// 구글 뉴스 RSS — 최근 2일 내 지원금·정책 혜택 기사
// (korea.kr 자체 RSS는 2018년에 갱신이 멈춰 사용 불가 확인됨)
const QUERIES = ["정부 지원금 신청 when:2d", "지원 혜택 대상 확대 when:2d", "청년 신혼부부 지원 정책 when:2d"];

function feedUrl(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
}

async function fetchPolicyItems() {
  const seen = new Set();
  const items = [];
  for (const q of QUERIES) {
    try {
      for (const it of parseRssItems(await fetchText(feedUrl(q)))) {
        const key = it.title.replace(/\s+-\s+[^-]+$/, "").trim(); // "제목 - 언론사" 의 제목부로 중복 제거
        if (!key || seen.has(key)) continue;
        seen.add(key);
        items.push(it);
      }
    } catch {
      // 쿼리 하나 실패는 무시하고 계속
    }
  }
  if (items.length === 0) throw new Error("정책 뉴스 RSS를 하나도 가져오지 못함");
  items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  return items.slice(0, 15);
}

export default {
  slug: "welfare",
  title: "정부 지원금·정책 브리핑",
  emoji: "🏛️",
  desc: "오늘의 정책 뉴스 중 일반인이 돈 받거나 아낄 수 있는 것만 골라 요약",

  async run({ date, askJSON }) {
    const items = await fetchPolicyItems();
    const list = items
      .map((it, i) => `${i + 1}. ${it.title} — ${it.description.slice(0, 150)} (링크: ${it.link})`)
      .join("\n");

    const prompt = `너는 복잡한 정부 정책을 쉬운 말로 풀어주는 전문가야. 오늘은 ${date}. 아래는 오늘의 정부 정책 뉴스 목록이야.

[정책 뉴스 목록]
${list}

이 중에서 **일반 국민이 직접 돈을 받거나, 아끼거나, 혜택을 신청할 수 있는 것**만 골라서 JSON으로 정리해.
해당되는 게 없으면 picks를 빈 배열로 두고, 대신 오늘 뉴스 중 생활에 영향이 큰 것 1~2개를 etc에 한 줄로 적어.

JSON 스키마:
{
  "headline": "오늘의 핵심 혜택 한 줄 (없으면 '오늘은 새 지원금 소식이 없어요')",
  "picks": [
    {
      "title": "혜택을 쉬운 말로 바꾼 제목",
      "target": "누가 해당되는지",
      "benefit": "구체적으로 뭘 받거나 아끼는지",
      "action": "어떻게 신청/확인하는지",
      "link": "위 목록에 있던 원문 링크 그대로"
    }
  ],
  "etc": "그 외 알아두면 좋은 정책 한 줄 (없으면 빈 문자열)"
}
picks는 최대 5개. 과장하지 말고 목록에 있는 내용에 근거해서만 써.`;

    const json = await askJSON(prompt);
    const md = [
      `# 🏛️ 오늘의 지원금·정책 브리핑 — ${date}`,
      "",
      `> ${json.headline}`,
      "",
      ...(json.picks ?? []).flatMap((p) => [
        `## ${p.title}`,
        `- **누가?** ${p.target}`,
        `- **무엇을?** ${p.benefit}`,
        `- **어떻게?** ${p.action}`,
        `- 원문: ${p.link}`,
        "",
      ]),
      ...(json.etc ? ["---", `${json.etc}`] : []),
    ].join("\n");
    return { json, markdown: md };
  },
};
