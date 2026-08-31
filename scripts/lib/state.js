import path from "node:path";
import { DATA_DIR, readJSON, writeJSON } from "./util.js";

const STATE_FILE = path.join(DATA_DIR, "state.json");

/** 주제별 "최근에 다룬 것" 목록 — 반복 방지용 */
export function getRecent(slug, limit = 30) {
  const state = readJSON(STATE_FILE, {});
  return (state[slug]?.recent ?? []).slice(-limit);
}

/** 생성 성공 후 호출 — 최근 목록에 추가 (최대 cap개 유지) */
export function pushRecent(slug, items, cap = 60) {
  const state = readJSON(STATE_FILE, {});
  const cur = state[slug]?.recent ?? [];
  state[slug] = { recent: [...cur, ...items].slice(-cap) };
  writeJSON(STATE_FILE, state);
}
