#!/usr/bin/env node
/**
 * 사용법:
 *   node scripts/generate.js all          # 10개 주제 전부 생성
 *   node scripts/generate.js weather mbti # 지정한 주제만 생성
 */
import path from "node:path";
import { TOPICS, findTopic } from "./topics/index.js";
import { askClaudeJSON } from "./lib/claude.js";
import { CONTENT_DIR, todayKST, weekdayKST, writeJSON, writeText } from "./lib/util.js";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("사용법: node scripts/generate.js all | <slug...>");
  console.log("주제 목록:", TOPICS.map((t) => t.slug).join(", "));
  process.exit(0);
}

const targets =
  args[0] === "all"
    ? TOPICS
    : args.map((slug) => {
        const t = findTopic(slug);
        if (!t) {
          console.error(`알 수 없는 주제: ${slug}`);
          process.exit(1);
        }
        return t;
      });

const date = todayKST();
const weekday = weekdayKST();
const ctx = { date, weekday, askJSON: async (prompt) => askClaudeJSON(prompt) };

console.log(`=== ${date} (${weekday}) 콘텐츠 생성: ${targets.map((t) => t.slug).join(", ")} ===`);

let ok = 0;
let fail = 0;
for (const topic of targets) {
  const t0 = Date.now();
  try {
    console.log(`\n[${topic.slug}] ${topic.emoji} ${topic.title} 생성 중...`);
    const { json, markdown, commit } = await topic.run(ctx);
    const dir = path.join(CONTENT_DIR, date);
    writeJSON(path.join(dir, `${topic.slug}.json`), { date, slug: topic.slug, title: topic.title, generated_at: new Date().toISOString(), data: json });
    writeText(path.join(dir, `${topic.slug}.md`), markdown + "\n");
    commit?.();
    ok++;
    console.log(`[${topic.slug}] 완료 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    fail++;
    console.error(`[${topic.slug}] 실패: ${e.message}`);
  }
}

console.log(`\n=== 결과: 성공 ${ok} / 실패 ${fail} ===`);
if (ok === 0) process.exit(1); // 전부 실패했을 때만 실패 처리 (부분 성공은 커밋되도록)
