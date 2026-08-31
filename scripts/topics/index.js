import weather from "./weather.js";
import welfare from "./welfare.js";
import dream from "./dream.js";
import mbti from "./mbti.js";
import book from "./book.js";
import quiz from "./quiz.js";
import history from "./history.js";
import korean from "./korean.js";
import dinner from "./dinner.js";
import balance from "./balance.js";

/** 사이트 노출 순서 = 이 배열 순서 */
export const TOPICS = [weather, welfare, dream, mbti, book, quiz, history, korean, dinner, balance];

export function findTopic(slug) {
  return TOPICS.find((t) => t.slug === slug);
}
