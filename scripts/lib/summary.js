/** 주제별 결과 JSON → 카드/피드/다이제스트용 한 줄 요약 */
export function summaryOf(slug, data) {
  try {
    switch (slug) {
      case "weather": return data.headline;
      case "welfare": return data.headline;
      case "dream": return `오늘의 키워드: ${(data.keywords ?? []).join(", ")}`;
      case "mbti": return data.theme;
      case "book": return `《${data.title}》 — ${data.author}`;
      case "quiz": return `오늘의 카테고리: ${data.category}`;
      case "history": return `${data.main?.year}년, ${data.main?.title}`;
      case "korean": return data.topic;
      case "dinner": return data.mood;
      case "balance": return data.question;
      case "weekly": return data.headline;
      default: return "";
    }
  } catch {
    return "";
  }
}
