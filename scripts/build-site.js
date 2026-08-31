#!/usr/bin/env node
/**
 * content/ 에 쌓인 생성 결과 전체 → docs/ 정적 사이트 + 정적 JSON API 빌드
 *   docs/index.html            오늘의 콘텐츠 카드
 *   docs/<slug>/index.html     주제별 아카이브
 *   docs/<slug>/<date>.html    개별 콘텐츠 (퀴즈·밸런스·MBTI는 인터랙티브)
 *   docs/dream/dictionary.html 꿈해몽 키워드 사전 (가나다순, 누적)
 *   docs/archive/index.html    날짜별 전체 아카이브
 *   docs/data/**               JSON 정적 API + latest.json + index.json
 *   docs/feed.xml              RSS 피드
 */
import fs from "node:fs";
import path from "node:path";
import { TOPICS } from "./topics/index.js";
import { summaryOf } from "./lib/summary.js";
import { CONTENT_DIR, DOCS_DIR, ensureDir, escapeHtml, mdToHtml, readJSON, writeText } from "./lib/util.js";

const SITE_NAME = process.env.SITE_NAME || "AI 데일리";
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "");

// ---------- 데이터 로드 ----------
const dates = fs.existsSync(CONTENT_DIR)
  ? fs.readdirSync(CONTENT_DIR).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  : [];
if (dates.length === 0) {
  console.error("content/ 에 생성된 콘텐츠가 없습니다. 먼저 generate.js를 실행하세요.");
  process.exit(1);
}
const latestDate = dates[dates.length - 1];

/** byTopic[slug] = [{date, data, md}] (날짜 오름차순) */
const byTopic = Object.fromEntries(TOPICS.map((t) => [t.slug, []]));
for (const date of dates) {
  for (const t of TOPICS) {
    const jsonFile = path.join(CONTENT_DIR, date, `${t.slug}.json`);
    const mdFile = path.join(CONTENT_DIR, date, `${t.slug}.md`);
    if (fs.existsSync(jsonFile) && fs.existsSync(mdFile)) {
      byTopic[t.slug].push({ date, data: readJSON(jsonFile)?.data ?? {}, md: fs.readFileSync(mdFile, "utf8") });
    }
  }
}
const activeTopics = TOPICS.filter((t) => byTopic[t.slug].length > 0);

// ---------- 레이아웃 ----------
const CSS = `
:root{--bg:#faf9f7;--card:#ffffff;--ink:#1f2328;--sub:#6b7280;--line:#e7e4df;--accent:#4f6ef7;--ok:#16a34a;--no:#dc2626;color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;line-height:1.7}
a{color:inherit;text-decoration:none}
button{font:inherit;cursor:pointer}
.wrap{max-width:880px;margin:0 auto;padding:0 20px}
header.site{border-bottom:1px solid var(--line);background:var(--card)}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;height:60px}
.logo{font-weight:800;font-size:19px}
.logo span{color:var(--accent)}
.hdr-sub{font-size:12px;color:var(--sub)}
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
.pn{display:flex;justify-content:space-between;gap:10px;margin-top:18px;font-size:14px}
.pn a{color:var(--accent);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 14px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips a{font-size:13px;border:1px solid var(--line);background:var(--card);border-radius:99px;padding:4px 11px}
.chips a:hover{border-color:var(--accent);color:var(--accent)}
/* 퀴즈 */
.choices{display:grid;gap:8px;margin:10px 0}
.choices button{text-align:left;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px 14px}
.choices button:hover:not(:disabled){border-color:var(--accent)}
.choices button.ok{border-color:var(--ok);background:#f0fdf4;font-weight:700}
.choices button.no{border-color:var(--no);background:#fef2f2;opacity:.8}
.choices button:disabled{cursor:default}
.expl{background:var(--bg);border-radius:10px;padding:10px 14px;font-size:14.5px}
.qz-score{font-weight:800;font-size:17px;text-align:center;background:var(--bg);border-radius:12px;padding:14px}
/* 밸런스 */
.vs{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:stretch;margin:16px 0}
.vs .vote{border:2px solid var(--line);background:var(--bg);border-radius:14px;padding:18px 14px;font-size:15px;font-weight:700;line-height:1.5}
.vs .vote:hover{border-color:var(--accent)}
.vs .vote.picked{border-color:var(--accent);background:#eef2ff}
.vs .mid{align-self:center;font-weight:800;color:var(--sub)}
.my-pick{text-align:center;font-weight:700;color:var(--accent)}
/* MBTI */
.mb-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 20px}
.mb-tabs button{border:1px solid var(--line);background:var(--bg);border-radius:99px;padding:5px 12px;font-size:13px}
.mb-tabs button.on{background:var(--accent);border-color:var(--accent);color:#fff}
@media(max-width:560px){article{padding:22px 18px}.vs{grid-template-columns:1fr;gap:8px}.vs .mid{justify-self:center}}
`;

function page({ title, desc, body, activeSlug = "", pathToRoot = ".", canonicalPath = "", script = "", jsonld = null }) {
  const canonical = BASE_URL && canonicalPath ? `\n<link rel="canonical" href="${BASE_URL}${canonicalPath}">` : "";
  const og = `\n<meta property="og:title" content="${escapeHtml(title)}">\n<meta property="og:description" content="${escapeHtml(desc)}">\n<meta property="og:type" content="article">\n<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`;
  const feed = `\n<link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_NAME)}" href="${pathToRoot}/feed.xml">`;
  const ld = jsonld ? `\n<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : "";
  const nav = activeTopics
    .map((t) => `<a class="${t.slug === activeSlug ? "on" : ""}" href="${pathToRoot}/${t.slug}/">${t.emoji} ${t.title}</a>`)
    .join("");
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">${canonical}${og}${feed}${ld}
<style>${CSS}</style>
</head>
<body>
<header class="site"><div class="wrap"><a class="logo" href="${pathToRoot}/index.html">📅 <span>${escapeHtml(SITE_NAME)}</span></a><a class="hdr-sub" href="${pathToRoot}/archive/">지난 콘텐츠 전체 보기 →</a></div></header>
<nav class="topics"><div class="wrap">${nav}</div></nav>
<main><div class="wrap">
${body}
</div></main>
<footer class="site" style="border-top:1px solid var(--line);color:var(--sub);font-size:13px;padding:22px 0;text-align:center">매일 새벽 자동 생성 · Powered by Claude · <a href="${pathToRoot}/feed.xml" style="color:var(--accent)">RSS</a></footer>${script ? `\n<script>${script}</script>` : ""}
</body>
</html>`;
}

// ---------- 주제별 커스텀 렌더러 (인터랙티브) ----------
const RENDERERS = {
  quiz({ date, data }) {
    const qs = data.questions ?? [];
    const body = [
      `<h1>🧠 데일리 상식 퀴즈 — ${date}</h1>`,
      `<blockquote>오늘의 카테고리: <strong>${escapeHtml(data.category ?? "")}</strong> · 보기를 눌러 정답을 확인하세요</blockquote>`,
      ...qs.map(
        (q, i) => `<section class="qz" data-answer="${q.answer_index}">
<h2>Q${i + 1}. ${escapeHtml(q.q)} <small style="color:var(--sub);font-weight:400">(${escapeHtml(q.level ?? "")})</small></h2>
<div class="choices">${q.choices.map((c, j) => `<button type="button" data-i="${j}">${j + 1}) ${escapeHtml(c)}</button>`).join("")}</div>
<p class="expl" hidden><strong>정답: ${q.answer_index + 1}) ${escapeHtml(q.choices[q.answer_index] ?? "")}</strong> — ${escapeHtml(q.explanation ?? "")}</p>
</section>`
      ),
      `<p class="qz-score" id="qz-score" hidden></p>`,
    ].join("\n");
    const script = `
var secs=[].slice.call(document.querySelectorAll('.qz')),done=0,score=0;
secs.forEach(function(sec){
  var ans=+sec.dataset.answer,btns=[].slice.call(sec.querySelectorAll('button'));
  btns.forEach(function(b){b.addEventListener('click',function(){
    if(sec.dataset.done)return;sec.dataset.done='1';done++;
    var i=+b.dataset.i;if(i===ans){score++;b.classList.add('ok');}else{b.classList.add('no');btns[ans].classList.add('ok');}
    btns.forEach(function(x){x.disabled=true});
    sec.querySelector('.expl').hidden=false;
    if(done===secs.length){var s=document.getElementById('qz-score');s.textContent='최종 점수: '+score+' / '+secs.length+(score===secs.length?' 🎉 만점!':score>=3?' 👍 좋아요!':' 내일 다시 도전!');s.hidden=false;}
  })});
});`;
    return { body, script };
  },

  balance({ date, data }) {
    const side = (k, c) => `<h2>${k === "A" ? "🅰️" : "🅱️"} ${escapeHtml(c?.title ?? "")}</h2>
<p>${escapeHtml(c?.argument ?? "")}</p>
<blockquote>${escapeHtml(c?.type ?? "")}</blockquote>`;
    const body = [
      `<h1>⚖️ 오늘의 밸런스 게임 — ${date}</h1>`,
      `<h2 style="border:0;padding-top:0">${escapeHtml(data.question ?? "")}</h2>`,
      `<div class="vs">
<button type="button" class="vote" data-side="A">A. ${escapeHtml(data.option_a ?? "")}</button>
<span class="mid">VS</span>
<button type="button" class="vote" data-side="B">B. ${escapeHtml(data.option_b ?? "")}</button>
</div>`,
      `<p class="my-pick" id="my-pick" hidden></p>`,
      side("A", data.case_a),
      side("B", data.case_b),
      `<hr><p><strong>반전 조건</strong> — ${escapeHtml(data.twist ?? "")}</p>`,
    ].join("\n");
    const script = `
var KEY='balance:${date}',btns=[].slice.call(document.querySelectorAll('.vote')),msg=document.getElementById('my-pick');
function mark(side){btns.forEach(function(b){b.classList.toggle('picked',b.dataset.side===side)});msg.textContent='내 선택: '+side+' — 당신의 선택은 이 브라우저에만 저장됩니다';msg.hidden=false;}
try{var saved=localStorage.getItem(KEY);if(saved)mark(saved);}catch(e){}
btns.forEach(function(b){b.addEventListener('click',function(){mark(b.dataset.side);try{localStorage.setItem(KEY,b.dataset.side);}catch(e){}})});`;
    return { body, script };
  },

  mbti({ date, data }) {
    const types = data.types ?? [];
    const body = [
      `<h1>🎭 MBTI별 오늘의 조언 — ${date}</h1>`,
      `<blockquote>오늘의 테마: ${escapeHtml(data.theme ?? "")} · 내 유형을 누르면 바로 볼 수 있어요</blockquote>`,
      `<div class="mb-tabs"><button type="button" data-t="all" class="on">전체</button>${types
        .map((t) => `<button type="button" data-t="${escapeHtml(t.type)}">${escapeHtml(t.type)}</button>`)
        .join("")}</div>`,
      ...types.map(
        (t) => `<section class="mb" data-type="${escapeHtml(t.type)}">
<h2>${escapeHtml(t.type)}</h2>
<ul>
<li><strong>조언</strong> ${escapeHtml(t.advice ?? "")}</li>
<li><strong>주의</strong> ${escapeHtml(t.caution ?? "")}</li>
<li><strong>행운 포인트</strong> ${escapeHtml(t.lucky ?? "")}</li>
</ul>
</section>`
      ),
    ].join("\n");
    const script = `
var tabs=[].slice.call(document.querySelectorAll('.mb-tabs button')),cards=[].slice.call(document.querySelectorAll('.mb'));
function show(t){cards.forEach(function(c){c.hidden=(t!=='all'&&c.dataset.type!==t)});tabs.forEach(function(b){b.classList.toggle('on',b.dataset.t===t)});}
tabs.forEach(function(b){b.addEventListener('click',function(){show(b.dataset.t);try{localStorage.setItem('mbti:me',b.dataset.t);}catch(e){}})});
try{var me=localStorage.getItem('mbti:me');if(me)show(me);}catch(e){}`;
    return { body, script };
  },

  dream({ date, data }) {
    const entries = data.entries ?? [];
    const body = [
      `<h1>🌙 오늘의 꿈해몽 — ${date}</h1>`,
      `<blockquote>오늘 추가된 키워드: ${(data.keywords ?? []).map((k) => `<strong>${escapeHtml(k)}</strong>`).join(", ")} · <a href="./dictionary.html" style="color:var(--accent)">전체 사전 보기</a></blockquote>`,
      ...entries.map(
        (e) => `<section id="kw-${escapeHtml(e.keyword)}">
<h2>${escapeHtml(e.keyword)} 꿈</h2>
<blockquote>${escapeHtml(e.one_line ?? "")}</blockquote>
<ul>${(e.scenarios ?? []).map((s) => `<li><strong>${escapeHtml(s.case)}</strong> — ${escapeHtml(s.meaning)}</li>`).join("")}</ul>
<h3>심리학적으로 보면</h3><p>${escapeHtml(e.psychology ?? "")}</p>
<h3>조언</h3><p>${escapeHtml(e.advice ?? "")}</p>
</section>`
      ),
    ].join("\n");
    return { body, script: "" };
  },
};

// ---------- 빌드 ----------
fs.rmSync(DOCS_DIR, { recursive: true, force: true });
ensureDir(DOCS_DIR);
const sitemapUrls = ["/index.html", "/archive/"];

// 1) 메인: 최신 날짜 카드
const cards = activeTopics
  .map((t) => {
    const entries = byTopic[t.slug];
    const latest = entries[entries.length - 1];
    const s = summaryOf(t.slug, latest.data);
    return `<a class="card" href="./${t.slug}/${latest.date}.html">
  <span class="e">${t.emoji}</span>
  <span class="t">${escapeHtml(t.title)}${latest.date !== latestDate ? ` <small style="color:var(--sub);font-weight:400">(${latest.date})</small>` : ""}</span>
  <span class="s">${escapeHtml(s || t.desc)}</span>
</a>`;
  })
  .join("\n");

writeText(
  path.join(DOCS_DIR, "index.html"),
  page({
    title: `${SITE_NAME} — 오늘의 콘텐츠`,
    desc: "날씨 생활지수, 지원금 브리핑, 꿈해몽, MBTI 조언, 책 요약, 상식 퀴즈까지 — 매일 AI가 만드는 데일리 콘텐츠",
    body: `<p class="date-line">${latestDate} 오늘의 콘텐츠</p>\n<div class="grid">\n${cards}\n</div>`,
    canonicalPath: "/index.html",
  })
);

// 2) 주제별: 개별 페이지(이전/다음 내비 + JSON-LD) + 아카이브
for (const t of activeTopics) {
  const entries = byTopic[t.slug];
  entries.forEach((e, i) => {
    const s = summaryOf(t.slug, e.data);
    const prev = entries[i - 1];
    const next = entries[i + 1];
    const rendered = RENDERERS[t.slug]?.({ date: e.date, data: e.data });
    const inner = rendered ? rendered.body : mdToHtml(e.md);
    const pn = `<div class="pn"><span>${prev ? `<a href="./${prev.date}.html">← ${prev.date}</a>` : ""}</span><a href="./">목록</a><span>${next ? `<a href="./${next.date}.html">${next.date} →</a>` : ""}</span></div>`;
    const jsonld = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${t.title} — ${e.date}`,
      description: s || t.desc,
      datePublished: e.date,
      author: { "@type": "Organization", name: SITE_NAME },
    };
    if (t.slug === "quiz" && Array.isArray(e.data.questions)) {
      jsonld["@type"] = "Article"; // 본문은 Article 유지, FAQ는 별도 블록
    }
    writeText(
      path.join(DOCS_DIR, t.slug, `${e.date}.html`),
      page({
        title: `${t.title} | ${e.date} | ${SITE_NAME}`,
        desc: s || t.desc,
        body: `<div class="crumb"><a href="../index.html">홈</a> › <a href="./">${t.emoji} ${t.title}</a> › ${e.date}</div>\n<article>\n${inner}\n</article>\n${pn}`,
        activeSlug: t.slug,
        pathToRoot: "..",
        canonicalPath: `/${t.slug}/${e.date}.html`,
        script: rendered?.script ?? "",
        jsonld,
      })
    );
    sitemapUrls.push(`/${t.slug}/${e.date}.html`);
  });

  const list = [...entries]
    .reverse()
    .map((e) => {
      const s = summaryOf(t.slug, e.data);
      return `<li><span class="d">${e.date}</span><a href="./${e.date}.html"><strong>${escapeHtml(s || t.title)}</strong></a></li>`;
    })
    .join("\n");
  const extra = t.slug === "dream" ? ` · <a href="./dictionary.html" style="color:var(--accent)">키워드 사전 보기</a>` : "";
  writeText(
    path.join(DOCS_DIR, t.slug, "index.html"),
    page({
      title: `${t.emoji} ${t.title} 아카이브 | ${SITE_NAME}`,
      desc: t.desc,
      body: `<h1 style="font-size:22px">${t.emoji} ${t.title}</h1><p class="date-line">${t.desc} · 총 ${entries.length}건${extra}</p>\n<ul class="archive">\n${list}\n</ul>`,
      activeSlug: t.slug,
      pathToRoot: "..",
      canonicalPath: `/${t.slug}/`,
    })
  );
  sitemapUrls.push(`/${t.slug}/`);
}

// 3) 꿈해몽 키워드 사전 — 누적 키워드 전체를 가나다순으로
{
  const entries = byTopic.dream ?? [];
  const kw = [];
  for (const e of entries) for (const en of e.data.entries ?? []) kw.push({ keyword: en.keyword, one_line: en.one_line ?? "", date: e.date });
  if (kw.length > 0) {
    kw.sort((a, b) => a.keyword.localeCompare(b.keyword, "ko"));
    const list = kw
      .map((k) => `<li><span class="d">${k.date}</span><a href="./${k.date}.html#kw-${escapeHtml(k.keyword)}"><strong>${escapeHtml(k.keyword)} 꿈</strong></a> <span style="color:var(--sub);font-size:13.5px">— ${escapeHtml(k.one_line)}</span></li>`)
      .join("\n");
    writeText(
      path.join(DOCS_DIR, "dream", "dictionary.html"),
      page({
        title: `꿈해몽 사전 (${kw.length}개 키워드) | ${SITE_NAME}`,
        desc: `뱀꿈, 물꿈, 이빨 빠지는 꿈… 매일 늘어나는 꿈해몽 사전 — 현재 ${kw.length}개 키워드`,
        body: `<h1 style="font-size:22px">🌙 꿈해몽 사전</h1><p class="date-line">매일 3개씩 늘어나는 해몽 사전 · 현재 ${kw.length}개 키워드 (가나다순)</p>\n<ul class="archive">\n${list}\n</ul>`,
        activeSlug: "dream",
        pathToRoot: "..",
        canonicalPath: `/dream/dictionary.html`,
      })
    );
    sitemapUrls.push(`/dream/dictionary.html`);
  }
}

// 4) 날짜별 전체 아카이브
{
  const rows = [...dates]
    .reverse()
    .map((date) => {
      const chips = activeTopics
        .filter((t) => byTopic[t.slug].some((e) => e.date === date))
        .map((t) => `<a href="../${t.slug}/${date}.html">${t.emoji} ${t.title}</a>`)
        .join("");
      return `<h2 style="font-size:16px;margin:20px 0 8px">${date}</h2><div class="chips">${chips}</div>`;
    })
    .join("\n");
  writeText(
    path.join(DOCS_DIR, "archive", "index.html"),
    page({
      title: `지난 콘텐츠 전체 | ${SITE_NAME}`,
      desc: `발행일 ${dates.length}일치 콘텐츠 전체 아카이브`,
      body: `<h1 style="font-size:22px">🗂️ 지난 콘텐츠</h1><p class="date-line">총 ${dates.length}일 발행</p>\n${rows}`,
      pathToRoot: "..",
      canonicalPath: `/archive/`,
    })
  );
}

// 5) 정적 JSON API
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
      topics: activeTopics
        .filter((t) => byTopic[t.slug].some((e) => e.date === latestDate))
        .map((t) => ({ slug: t.slug, title: t.title, url: `/data/${latestDate}/${t.slug}.json` })),
    },
    null,
    2
  )
);
writeText(
  path.join(DOCS_DIR, "data", "index.json"),
  JSON.stringify(
    {
      site: SITE_NAME,
      dates,
      topics: activeTopics.map((t) => ({ slug: t.slug, title: t.title, emoji: t.emoji, count: byTopic[t.slug].length })),
    },
    null,
    2
  )
);

// 6) RSS 피드 — 최근 3일치
{
  const recent = dates.slice(-3).reverse();
  const items = [];
  for (const date of recent) {
    for (const t of activeTopics) {
      const e = byTopic[t.slug].find((x) => x.date === date);
      if (!e) continue;
      const s = summaryOf(t.slug, e.data);
      items.push(`  <item>
    <title>${escapeHtml(`${t.emoji} ${t.title} — ${s || date}`)}</title>
    <link>${BASE_URL}/${t.slug}/${date}.html</link>
    <guid isPermaLink="true">${BASE_URL}/${t.slug}/${date}.html</guid>
    <pubDate>${new Date(`${date}T06:30:00+09:00`).toUTCString()}</pubDate>
    <description>${escapeHtml(s || t.desc)}</description>
  </item>`);
    }
  }
  writeText(
    path.join(DOCS_DIR, "feed.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeHtml(SITE_NAME)}</title>
  <link>${BASE_URL || "/"}</link>
  <description>매일 AI가 만드는 데일리 콘텐츠</description>
  <language>ko</language>
${items.join("\n")}
</channel>
</rss>
`
  );
}

// 7) sitemap / robots / .nojekyll
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

console.log(`docs/ 빌드 완료 — 날짜 ${dates.length}개, 페이지 ${sitemapUrls.length}개, RSS/사전/아카이브 포함`);
