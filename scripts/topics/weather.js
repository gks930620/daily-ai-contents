import { fetchJSON } from "../lib/util.js";

const CITIES = [
  { name: "서울", lat: 37.5665, lon: 126.978 },
  { name: "인천", lat: 37.4563, lon: 126.7052 },
  { name: "대전", lat: 36.3504, lon: 127.3845 },
  { name: "대구", lat: 35.8714, lon: 128.6014 },
  { name: "광주", lat: 35.1595, lon: 126.8526 },
  { name: "부산", lat: 35.1796, lon: 129.0756 },
  { name: "제주", lat: 33.4996, lon: 126.5312 },
];

async function fetchWeatherData() {
  const lats = CITIES.map((c) => c.lat).join(",");
  const lons = CITIES.map((c) => c.lon).join(",");
  const weather = await fetchJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max` +
      `&timezone=Asia%2FSeoul&forecast_days=1`
  );
  const air = await fetchJSON(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}` +
      `&hourly=pm10,pm2_5&timezone=Asia%2FSeoul&forecast_days=1`
  );
  const wArr = Array.isArray(weather) ? weather : [weather];
  const aArr = Array.isArray(air) ? air : [air];
  return CITIES.map((c, i) => {
    const d = wArr[i]?.daily ?? {};
    const h = aArr[i]?.hourly ?? {};
    const noon = 12; // 정오 기준 미세먼지
    return {
      name: c.name,
      tmax: d.temperature_2m_max?.[0],
      tmin: d.temperature_2m_min?.[0],
      rain: d.precipitation_probability_max?.[0],
      uv: d.uv_index_max?.[0],
      wind: d.wind_speed_10m_max?.[0],
      pm10: h.pm10?.[noon],
      pm25: h.pm2_5?.[noon],
    };
  });
}

export default {
  slug: "weather",
  title: "날씨 생활지수",
  emoji: "🌤️",
  desc: "오늘의 날씨·미세먼지 기반 생활지수 브리핑",

  async run({ date, weekday, askJSON }) {
    const rows = await fetchWeatherData();
    const table = rows
      .map(
        (r) =>
          `${r.name}: 최고 ${r.tmax}°C / 최저 ${r.tmin}°C, 강수확률 ${r.rain}%, 자외선 ${r.uv}, 바람 ${r.wind}km/h, 미세먼지 PM10 ${r.pm10} / PM2.5 ${r.pm25}`
      )
      .join("\n");

    const prompt = `너는 한국의 생활 기상 캐스터야. 오늘은 ${date} (${weekday}요일). 아래 실측 예보 데이터를 바탕으로 생활지수 브리핑 JSON을 만들어.

[오늘의 예보 데이터]
${table}

JSON 스키마:
{
  "headline": "오늘 날씨를 한 줄로 (재치있게, 20자 내외)",
  "summary": "전국 날씨 총평 2~3문장. 데이터에 근거할 것",
  "indices": {
    "옷차림": "기온 기반 옷차림 추천 1문장",
    "우산": "강수확률 기반 1문장",
    "빨래": "빨래/건조 적합 여부 1문장",
    "세차": "세차해도 되는지 1문장",
    "마스크": "미세먼지 기반 1문장"
  },
  "cities": [{"name": "서울", "comment": "그 도시 데이터 반영 한 줄"}]
}
cities에는 7개 도시 모두 포함해.`;

    const json = await askJSON(prompt);
    const md = [
      `# 🌤️ 오늘의 날씨 생활지수 — ${date}`,
      "",
      `> ${json.headline}`,
      "",
      json.summary,
      "",
      "## 오늘의 생활지수",
      ...Object.entries(json.indices ?? {}).map(([k, v]) => `- **${k}** — ${v}`),
      "",
      "## 도시별 한 줄 날씨",
      ...(json.cities ?? []).map((c) => `- **${c.name}** ${c.comment}`),
    ].join("\n");
    return { json, markdown: md };
  },
};
