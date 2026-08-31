#!/usr/bin/env node
/**
 * content/ 에 쌓인 생성 결과 전체 → docs/ 정적 사이트 + 정적 JSON API 빌드
 *   docs/index.html            오늘의 콘텐츠 10개 카드
 *   docs/<slug>/index.html     주제별 아카이브
 *   docs/<slug>/<date>.html    개별 콘텐츠 페이지
 *   docs/data/**               JSON 그대로 노출 (앱 등에서 재활용)
 *   docs/sitemap.xml, robots.txt
 */
import fs from "node:fs";
import path from "node:path";
import { TOPICS } from "./topics/index.js";
import { CONTENT_DIR, DOCS_DIR, ensureDir, escapeHtml, mdToHtml, readJSON, writeText } from "./lib/util.js";

const SITE_NAME = process.env.SITE_NAME || "AI 데일리";
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, ""); // 예: https://<user>.github.io/daily-ai-contents

// ---------- 데이터 로드 ----------
const dates = fs.existsSync(CONTENT_DIR)
  ? fs.readdirSync(CONTENT_DIR).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  : [];
if (dates.length === 0) {
  console.error("content/ 에 생성된 콘텐츠가 없습니다. 먼저 generate.js를 실행하세요.");
  process.exit(1);
}
const latestDate = dates[dates.length - 1];

/** byTopic[slug] = [{date, json, md}] (날짜 오름차순) */
const byTopic = Object.fromEntries(TOPICS.map((t) => [t.slug, []]));
for (const date of dates) {
  for (const t of TOPICS) {
    const jsonFile = path.join(CONTENT_DIR, date, `${t.slug}.json`);
    const mdFile = path.join(CONTENT_DIR, date, `${t.slug}.md`);
    if (fs.existsSync(jsonFile) && fs.existsSync(mdFile)) {
      byTopic[t.slug].push({ date, json: readJSON(jsonFile), md: fs.readFileSync(mdFile, "utf8") });
    }
  }
}

// ---------- 카드 요약문 ----------
function summaryOf(slug, data) {
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
      default: return "";
    }
  } catch {
    return "";
  }
}

// ---------- 레이아웃 ----------
const CSS = `
:root{--bg:#faf9f7;--card:#ffffff;--ink:#1f2328;--sub:#6b7280;--line:#e7e4df;--accent:#4f6ef7;color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;line-height:1.7}
a{color:inherit;text-decoration:none}
.wrap{max-width:880px;margin:0 auto;padding:0 20px}
header.site{border-bottom:1px solid var(--line);background:var(--card)}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;height:60px}
.logo{font-weight:800;font-size:19px}
.logo span{color:var(--accent)}
nav.topics{border-bottom:1px solid var(--line);background:var(--card);overflow-x:auto;white-space:nowrap}
nav.topics .wrap{padding:8px 20px;display:flex;gap:6px}
nav.topics a{font-size:13px;color:var(--sub);padding:5px 11px;border-radius:99px;border:1px solid var(--line)}
nav.topics a:hover,nav.topics a.on{background:var(--accent);border-color:var(--accent);color:#fff}
main{padding:32px 0 64px}
.date-line{color:var(--sub);font-size:14px;margin:0 0 18px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:8px;transition:.15s}
.card:hover{border-color:var(--accent);box-shadow:0 4px 16px rgba(79,110,247,.10);transform:translateY(-2px)}
.card .t{font-weight:700;font-size:15px}
.card .s{color:var(--sub);font-size:13.5px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.card .e{font-size:22px}
article{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:32px 34px}
article h1{font-size:24px;margin-top:0;line-height:1.4}
article h2{font-size:19px;margin:28px 0 10px;padding-top:14px;border-top:1px solid var(--line)}
article h3{font-size:16px;margin:18px 0 6px}
article blockquote{margin:14px 0;padding:10px 16px;background:var(--bg);border-left:4px solid var(--accent);border-radius:0 8px 8px 0}
article ul{padding-left:20px}
article li{margin:5px 0}
article hr{border:0;border-top:1px solid var(--line);margin:22px 0}
.archive li{list-style:none;border-bottom:1px solid var(--line);padding:12px 4px;display:flex;gap:14px;align-items:baseline}
.archive li .d{color:var(--sub);font-size:13px;min-width:92px}
.archive{padding:0;margin:0}
.crumb{font-size:13px;color:var(--sub);margin-bottom:14px}
.crumb a{color:var(--accent)}
footer.site{border-top:1px solid var(--line);color:var(--sub);font-size:13px;padding:22px 0;text-align:center}
@media(max-width:560px){article{padding:22px 18px}}
`;

function page({ title, desc, body, activeSlug = "", pathToRoot = ".", canonicalPath = "" }) {
  const canonical = BASE_URL && canonicalPath ? `\n<link rel="canonical" href="${BASE_URL}${canonicalPath}">` : "";
  const og = `\n<meta property="og:title" content="${escapeHtml(title)}">\n<meta property="og:description" content="${escapeHtml(desc)}">\n<meta property="og:type" content="article">`;
  const nav = TOPICS.map(
    (t) => `<a class="${t.slug === activeSlug ? "on" : ""}" href="${pathToRoot}/${t.slug}/">${t.emoji} ${t.title}</a>`
  ).join("");
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">${canonical}${og}
<style>${CSS}</style>
</head>
<body>
<header class="site"><div class="wrap"><a class="logo" href="${pathToRoot}/index.html">📅 <span>${escapeHtml(SITE_NAME)}</span></a><span style="font-size:12px;color:var(--sub)">매일 아침 AI가 만드는 10가지 콘텐츠</span></div></header>
<nav class="topics"><div class="wrap">${nav}</div></nav>
<main><div class="wrap">
${body}
</div></main>
<footer class="site">매일 06:30 자동 생성 · Powered by Claude</footer>
</body>
</html>`;
}

// ---------- 빌드 ----------
fs.rmSync(DOCS_DIR, { recursive: true, force: true });
ensureDir(DOCS_DIR);

// 1) 메인: 최신 날짜 카드
const cards = TOPICS.map((t) => {
  const entries = byTopic[t.slug];
  const latest = entries[entries.length - 1];
  if (!latest) return "";
  const s = summaryOf(t.slug, latest.json?.data ?? {});
  return `<a class="card" href="./${t.slug}/${latest.date}.html">
  <span class="e">${t.emoji}</span>
  <span class="t">${escapeHtml(t.title)}</span>
  <span class="s">${escapeHtml(s || t.desc)}</span>
</a>`;
}).join("\n");

writeText(
  path.join(DOCS_DIR, "index.html"),
  page({
    title: `${SITE_NAME} — 오늘의 콘텐츠`,
    desc: "날씨 생활지수, 지원금 브리핑, 꿈해몽, MBTI 조언, 책 요약, 상식 퀴즈까지 — 매일 AI가 만드는 10가지 콘텐츠",
    body: `<p class="date-line">${latestDate} 오늘의 콘텐츠</p>\n<div class="grid">\n${cards}\n</div>`,
    canonicalPath: "/index.html",
  })
);

// 2) 주제별 아카이브 + 개별 페이지
const sitemapUrls = ["/index.html"];
for (const t of TOPICS) {
  const entries = byTopic[t.slug];
  if (entries.length === 0) continue;

  for (const e of entries) {
    const s = summaryOf(t.slug, e.json?.data ?? {});
    writeText(
      path.join(DOCS_DIR, t.slug, `${e.date}.html`),
      page({
        title: `${t.title} | ${e.date} | ${SITE_NAME}`,
        desc: s || t.desc,
        body: `<div class="crumb"><a href="../index.html">홈</a> › <a href="./">${t.emoji} ${t.title}</a> › ${e.date}</div>\n<article>\n${mdToHtml(e.md)}\n</article>`,
        activeSlug: t.slug,
        pathToRoot: "..",
        canonicalPath: `/${t.slug}/${e.date}.html`,
      })
    );
    sitemapUrls.push(`/${t.slug}/${e.date}.html`);
  }

  const list = [...entries]
    .reverse()
    .map((e) => {
      const s = summaryOf(t.slug, e.json?.data ?? {});
      return `<li><span class="d">${e.date}</span><a href="./${e.date}.html"><strong>${escapeHtml(s || t.title)}</strong></a></li>`;
    })
    .join("\n");
  writeText(
    path.join(DOCS_DIR, t.slug, "index.html"),
    page({
      title: `${t.emoji} ${t.title} 아카이브 | ${SITE_NAME}`,
      desc: t.desc,
      body: `<h1 style="font-size:22px">${t.emoji} ${t.title}</h1><p class="date-line">${t.desc} · 총 ${entries.length}건</p>\n<ul class="archive">\n${list}\n</ul>`,
      activeSlug: t.slug,
      pathToRoot: "..",
      canonicalPath: `/${t.slug}/`,
    })
  );
  sitemapUrls.push(`/${t.slug}/`);
}

// 3) 정적 JSON API (결과물 재활용용)
for (const date of dates) {
  for (const t of TOPICS) {
    const src = path.join(CONTENT_DIR, date, `${t.slug}.json`);
    if (fs.existsSync(src)) {
      ensureDir(path.join(DOCS_DIR, "data", date));
      fs.copyFileSync(src, path.join(DOCS_DIR, "data", date, `${t.slug}.json`));
    }
  }
}
writeText(
  path.join(DOCS_DIR, "data", "latest.json"),
  JSON.stringify(
    {
      date: latestDate,
      topics: TOPICS.filter((t) => byTopic[t.slug].some((e) => e.date === latestDate)).map((t) => ({
        slug: t.slug,
        title: t.title,
        url: `/data/${latestDate}/${t.slug}.json`,
      })),
    },
    null,
    2
  )
);

// 4) sitemap / robots / .nojekyll
if (BASE_URL) {
  writeText(
    path.join(DOCS_DIR, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      sitemapUrls.map((u) => `  <url><loc>${BASE_URL}${u}</loc></url>`).join("\n") +
      `\n</urlset>\n`
  );
  writeText(path.join(DOCS_DIR, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`);
} else {
  writeText(path.join(DOCS_DIR, "robots.txt"), `User-agent: *\nAllow: /\n`);
}
writeText(path.join(DOCS_DIR, ".nojekyll"), "");

console.log(`docs/ 빌드 완료 — 날짜 ${dates.length}개, 페이지 ${sitemapUrls.length}개`);
