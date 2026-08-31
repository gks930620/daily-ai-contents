import path from "node:path";
import { DATA_DIR, readJSON, writeJSON } from "../lib/util.js";

const QUEUE_FILE = path.join(DATA_DIR, "books.json");

export default {
  slug: "book",
  title: "하루 한 권 책 요약",
  emoji: "📚",
  desc: "매일 명저 1권의 핵심을 10분 분량으로 요약",

  async run({ date, askJSON }) {
    const q = readJSON(QUEUE_FILE);
    if (!q?.books?.length) throw new Error("books.json이 비어 있음");
    const idx = q.index % q.books.length;
    const book = q.books[idx];

    const prompt = `너는 책의 정수를 뽑아내는 북 큐레이터야. 아래 책을 아직 읽지 않은 사람을 위해 요약해.

오늘의 책: 《${book.title}》 — ${book.author}

JSON 스키마:
{
  "title": "${book.title}",
  "author": "${book.author}",
  "one_line": "이 책을 한 문장으로",
  "why_read": "이 책을 왜 읽어야 하는지 2~3문장",
  "core_message": "책의 핵심 메시지 3~4문장",
  "key_points": [
    {"point": "핵심 포인트 제목", "detail": "설명 2~3문장"},
    {"point": "...", "detail": "..."},
    {"point": "...", "detail": "..."}
  ],
  "famous_quote": "책 속 유명한 문장 또는 핵심 사상을 담은 문장 1개 (정확히 기억나지 않으면 의역임을 표시)",
  "action_today": "이 책의 내용으로 오늘 당장 실천할 수 있는 것 1가지",
  "for_whom": "특히 이런 사람에게 추천 1문장"
}
key_points는 정확히 3개. 실제 책 내용에 근거하고, 불확실한 세부사항은 지어내지 마.`;

    const json = await askJSON(prompt);
    const md = [
      `# 📚 하루 한 권 — 《${json.title}》 (${json.author})`,
      "",
      `> ${json.one_line}`,
      "",
      `**${date}의 책** · ${json.for_whom}`,
      "",
      "## 왜 읽어야 할까",
      json.why_read,
      "",
      "## 핵심 메시지",
      json.core_message,
      "",
      "## 꼭 알아야 할 3가지",
      ...(json.key_points ?? []).map((k) => `- **${k.point}** — ${k.detail}`),
      "",
      "## 기억할 문장",
      `> ${json.famous_quote}`,
      "",
      "## 오늘의 실천",
      json.action_today,
    ].join("\n");

    return {
      json,
      markdown: md,
      commit() {
        q.index = (idx + 1) % q.books.length;
        writeJSON(QUEUE_FILE, q);
      },
    };
  },
};
