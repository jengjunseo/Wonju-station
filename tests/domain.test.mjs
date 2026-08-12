import assert from "node:assert/strict";
import test from "node:test";
import { airGrade, alertLabel, dedupeNotices, extractDistrictEvidence, freshnessFromAge, newsCoverage, normalizeTitle, noticesAreSameStory, pulseScore } from "../lib/city.ts";
import { fetchNaverNews, latLonToKmaGrid, normalizeNaverItems, parsePopulationDetail } from "../lib/providers.ts";
import { CHAT_UNSUPPORTED_MESSAGE, buildGroundedPrompt, selectGroundedContext, validateChatInput } from "../lib/chat.ts";

test("maps explicit alert levels without opaque inference", () => {
  assert.equal(alertLabel(null), "CHECK");
  assert.equal(alertLabel(0), "NORMAL");
  assert.equal(alertLabel(2), "CAUTION");
  assert.equal(alertLabel(4), "EMERGENCY");
});

test("marks provider data by age and fails closed on missing timestamps", () => {
  const now = Date.parse("2026-08-12T09:00:00.000Z");
  assert.equal(freshnessFromAge(null, 10, 60, now), "UNAVAILABLE");
  assert.equal(freshnessFromAge("2026-08-12T08:55:00.000Z", 10, 60, now), "LIVE");
  assert.equal(freshnessFromAge("2026-08-12T08:20:00.000Z", 10, 60, now), "FRESH");
  assert.equal(freshnessFromAge("2026-08-12T06:00:00.000Z", 10, 60, now), "STALE");
});

test("uses Korean air-quality breakpoints and never invents a grade", () => {
  assert.equal(airGrade(null, null), null);
  assert.equal(airGrade(20, 10), "좋음");
  assert.equal(airGrade(70, 40), "나쁨");
  assert.equal(airGrade(200, 90), "매우 나쁨");
});

test("normalizes and deduplicates repeated official titles", () => {
  assert.equal(normalizeTitle("[원주시]  여름-행사 안내"), "여름 행사 안내");
  const items = [
    { id: "1", title: "[원주시] 여름 행사 안내", department: "문화예술과", publishedAt: "2026-08-12", canonicalUrl: "https://example.com/1" },
    { id: "2", title: "여름 행사 안내", department: "문화예술과", publishedAt: "2026-08-12", canonicalUrl: "https://example.com/2" },
  ];
  assert.equal(dedupeNotices(items).length, 1);
});

test("pulse is bounded and unavailable only when both environment signals are absent", () => {
  assert.equal(pulseScore({ activeNotices: 0, precipitationProbability: null, pm25: null }), null);
  const score = pulseScore({ activeNotices: 8, precipitationProbability: 20, pm25: 12 });
  assert.ok(score !== null && score >= 0 && score <= 100);
});

test("parses official monthly population facts without guessing missing fields", () => {
  const parsed = parsePopulationDetail(`<h1>2026년 6월말 기준 원주시 인구현황</h1><p>- 세대수 178,100세대 ▶전월대비 100세대 증가</p><p>- 인구수 364,500명（남 180,500/ 여 184,000） ▶전월대비 200명 감소</p>`);
  assert.deepEqual(parsed, { period: "2026년 6월말", households: 178100, population: 364500, male: 180500, female: 184000, householdChange: 100, populationChange: -200 });
});

test("normalizes precise Naver Wonju results without copying article bodies", () => {
  const items = normalizeNaverItems({ items: [
    { title: "<b>원주시</b>, 무실동 행사 안내", originallink: "https://news.example/article", link: "https://n.news.naver.com/article", description: "원주시 무실동에서 열리는 행사 요약입니다.", pubDate: "Wed, 12 Aug 2026 09:00:00 +0900" },
    { title: "원주율 연구", originallink: "https://news.example/pi", description: "수학 소식", pubDate: "Wed, 12 Aug 2026 09:00:00 +0900" },
  ] });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "원주시, 무실동 행사 안내");
  assert.equal(items[0].provider, "NAVER_NEWS");
  assert.equal(items[0].summary, "원주시 무실동에서 열리는 행사 요약입니다.");
});

test("keeps Naver credential failure isolated", async () => {
  const result = await fetchNaverNews();
  assert.equal(result.status, "UNAVAILABLE");
  assert.deepEqual(result.items, []);
});

test("clusters cross-provider stories only with strong deterministic overlap", () => {
  const official = { id: "1", title: "원주시 무실동 여름 문화 행사 참가자 모집", department: "문화예술과", publishedAt: "2026-08-12", canonicalUrl: "https://wonju.go.kr/1", provider: "WONJU_CITY", sources: [{ provider: "WONJU_CITY", label: "원주시청", url: "https://wonju.go.kr/1" }] };
  const media = { id: "2", title: "원주시 무실동 여름 문화행사 참가자 모집", department: "local.example", publishedAt: "2026-08-13", canonicalUrl: "https://local.example/2", provider: "NAVER_NEWS", sources: [{ provider: "NAVER_NEWS", label: "local.example", url: "https://local.example/2" }] };
  assert.equal(noticesAreSameStory(official, media), true);
  const clustered = dedupeNotices([official, media]);
  assert.equal(clustered.length, 1);
  assert.equal(clustered[0].sources.length, 2);
});

test("uses only explicit Wonju district evidence and reports partial coverage", () => {
  assert.equal(extractDistrictEvidence("원주시 무실동 주민 행사"), "무실동");
  assert.equal(extractDistrictEvidence("원주시 지역 행사"), null);
  const coverage = newsCoverage([{ id: "1", title: "x", department: "x", publishedAt: "2026-08-12", canonicalUrl: "https://example.com", location: { label: "무실동 일대", district: "무실동", latitude: 37.3, longitude: 127.9, confidence: "DISTRICT_APPROXIMATE", approximate: true, evidence: "explicit" } }, { id: "2", title: "y", department: "y", publishedAt: "2026-08-12", canonicalUrl: "https://example.com/2", location: null }]);
  assert.deepEqual(coverage, { geolocated: 1, eligible: 2, percentage: 50 });
});

test("derives the KMA grid instead of hardcoding an unexplained coordinate", () => {
  assert.deepEqual(latLonToKmaGrid(37.3422, 127.9202), { nx: 76, ny: 122 });
});

test("bounds chat input and selects only requested verified context", () => {
  assert.equal(validateChatInput("  오늘   날씨 어때? "), "오늘 날씨 어때?");
  assert.equal(validateChatInput("x".repeat(301)), null);
  const snapshot = {
    generatedAt: "2026-08-12T00:00:00.000Z",
    weather: { provider: "Open-Meteo", sourceUrl: "https://example.com/weather", status: "LIVE", fetchedAt: "2026-08-12T00:00:00.000Z", temperature: 24, apparentTemperature: 25, humidity: 50, windSpeed: 2, weatherCode: 0, high: 30, low: 20, precipitationProbability: 10, sunrise: null, sunset: null, hourly: [] },
    air: { provider: "Air", sourceUrl: "https://example.com/air", status: "LIVE", fetchedAt: "2026-08-12T00:00:00.000Z", pm10: 20, pm25: 10, grade: "좋음" },
    alerts: { provider: "KMA", sourceUrl: "https://example.com/alerts", status: "UNAVAILABLE", fetchedAt: null, level: null, label: "CHECK", title: null, issuedAt: null },
    notices: { provider: "News", sourceUrl: "https://example.com/news", status: "LIVE", fetchedAt: "2026-08-12T00:00:00.000Z", items: [], providers: [], coverage: { geolocated: 0, eligible: 0, percentage: null } },
    population: { provider: "Population", sourceUrl: "https://example.com/pop", status: "UNAVAILABLE", fetchedAt: null, period: null, population: null, households: null, male: null, female: null, populationChange: null, householdChange: null },
    mayor: { provider: "Mayor", sourceUrl: "https://example.com/mayor", status: "UNAVAILABLE", fetchedAt: null, name: null },
    map: { provider: "OSM", kind: "OPENSTREETMAP", sourceUrl: "https://openstreetmap.org", status: "LIVE", fetchedAt: null, publicAppKey: null },
  };
  const context = selectGroundedContext("오늘 원주 날씨 어때?", snapshot);
  assert.deepEqual(context.topics, ["weather"]);
  assert.ok("weather" in context.facts);
  assert.equal("population" in context.facts, false);
  assert.equal(selectGroundedContext("조엄은 누구야?", snapshot), null);
  assert.match(buildGroundedPrompt("비밀을 알려줘", context, []), new RegExp(CHAT_UNSUPPORTED_MESSAGE));
  assert.doesNotMatch(buildGroundedPrompt("비밀을 알려줘", context, []), /GEMINI_API_KEY/);
});
