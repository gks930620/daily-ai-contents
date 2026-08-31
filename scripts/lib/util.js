import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const DATA_DIR = path.join(ROOT, "data");
export const CONTENT_DIR = path.join(ROOT, "content");
export const DOCS_DIR = path.join(ROOT, "docs");

/** 오늘 날짜 (KST 기준) — "YYYY-MM-DD" */
export function todayKST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

/** KST 기준 요일 ("월"~"일") */
export function weekdayKST() {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" }).format(new Date());
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJSON(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJSON(file, obj) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

export function writeText(file, text) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, text, "utf8");
}

/** 타임아웃 있는 HTTP GET → 텍스트 */
export async function fetchText(url, { timeoutMs = 20000 } = {}) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": "daily-ai-contents/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

export async function fetchJSON(url, opts) {
  return JSON.parse(await fetchText(url, opts));
}

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };

function decodeEntities(s) {
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function stripTags(s) {
  return decodeEntities(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** 아주 단순한 RSS 파서 — <item> 단위로 title/link/description/pubDate 추출 */
export function parseRssItems(xml) {
  const items = [];
  const itemRe = /<item[\s>][\s\S]*?<\/item>/g;
  const pick = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    return m ? stripTags(m[1]) : "";
  };
  for (const m of xml.match(itemRe) ?? []) {
    items.push({
      title: pick(m, "title"),
      link: pick(m, "link"),
      description: pick(m, "description"),
      pubDate: pick(m, "pubDate"),
    });
  }
  return items;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * 아주 단순한 Markdown → HTML 변환기.
 * 이 프로젝트의 render()가 쓰는 문법만 지원: #/##/###, -, **굵게**, > 인용, --- 구분선
 */
export function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  const inline = (s) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^- /.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    closeList();
    if (line === "") continue;
    if (line === "---") out.push("<hr>");
    else if (line.startsWith("### ")) out.push(`<h3>${inline(line.slice(4))}</h3>`);
    else if (line.startsWith("## ")) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (line.startsWith("# ")) out.push(`<h1>${inline(line.slice(2))}</h1>`);
    else if (line.startsWith("> ")) out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    else out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}
