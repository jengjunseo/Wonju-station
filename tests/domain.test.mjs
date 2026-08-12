import assert from "node:assert/strict";
import test from "node:test";
import { airGrade, alertLabel, dedupeNotices, freshnessFromAge, normalizeTitle, pulseScore } from "../lib/city.ts";
import { parsePopulationDetail } from "../lib/providers.ts";

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
