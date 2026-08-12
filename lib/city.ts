export type Freshness = "LIVE" | "FRESH" | "STALE" | "UNAVAILABLE";

export type ProviderStamp = {
  provider: string;
  status: Freshness;
  fetchedAt: string | null;
  sourceUrl: string;
  detail?: string;
};

export type WeatherSnapshot = ProviderStamp & {
  temperature: number | null;
  apparentTemperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  weatherCode: number | null;
  high: number | null;
  low: number | null;
  precipitationProbability: number | null;
  sunrise: string | null;
  sunset: string | null;
  hourly: Array<{ time: string; temperature: number; precipitationProbability: number }>;
};

export type AirSnapshot = ProviderStamp & {
  pm10: number | null;
  pm25: number | null;
  grade: "좋음" | "보통" | "나쁨" | "매우 나쁨" | null;
};

export type NewsLocation = {
  label: string;
  district: string | null;
  latitude: number;
  longitude: number;
  confidence: "EXACT" | "VERIFIED_PLACE" | "DISTRICT_APPROXIMATE";
  approximate: boolean;
  evidence: string;
};

export type NoticeSource = {
  provider: "WONJU_CITY" | "NAVER_NEWS";
  label: string;
  url: string;
};

export type Notice = {
  id: string;
  title: string;
  department: string;
  publishedAt: string;
  canonicalUrl: string;
  summary?: string | null;
  provider?: NoticeSource["provider"];
  sources?: NoticeSource[];
  location?: NewsLocation | null;
};

export type NewsSnapshot = ProviderStamp & {
  items: Notice[];
  providers: Array<ProviderStamp & { key: NoticeSource["provider"] }>;
  coverage: { geolocated: number; eligible: number; percentage: number | null };
};

export type AlertSnapshot = ProviderStamp & {
  level: 0 | 1 | 2 | 3 | 4 | null;
  label: "NORMAL" | "INFO" | "CAUTION" | "WARNING" | "EMERGENCY" | "CHECK";
  title: string | null;
  issuedAt: string | null;
};

export type PopulationSnapshot = ProviderStamp & {
  period: string | null;
  population: number | null;
  households: number | null;
  male: number | null;
  female: number | null;
  populationChange: number | null;
  householdChange: number | null;
};

export type MayorSnapshot = ProviderStamp & { name: string | null };

export type MapSnapshot = ProviderStamp & {
  kind: "KAKAO_MAPS" | "OPENSTREETMAP";
  publicAppKey: string | null;
};

export type CitySnapshot = {
  generatedAt: string;
  weather: WeatherSnapshot;
  air: AirSnapshot;
  alerts: AlertSnapshot;
  notices: NewsSnapshot;
  population: PopulationSnapshot;
  mayor: MayorSnapshot;
  map: MapSnapshot;
};

export function freshnessFromAge(
  sourceUpdatedAt: string | null,
  freshMinutes: number,
  staleMinutes: number,
  now = Date.now(),
): Freshness {
  if (!sourceUpdatedAt) return "UNAVAILABLE";
  const age = now - new Date(sourceUpdatedAt).getTime();
  if (!Number.isFinite(age) || age < 0) return "UNAVAILABLE";
  if (age <= freshMinutes * 60_000) return "LIVE";
  if (age <= staleMinutes * 60_000) return "FRESH";
  return "STALE";
}

export function alertLabel(level: number | null): AlertSnapshot["label"] {
  if (level === null) return "CHECK";
  if (level >= 4) return "EMERGENCY";
  if (level === 3) return "WARNING";
  if (level === 2) return "CAUTION";
  if (level === 1) return "INFO";
  return "NORMAL";
}

export function airGrade(pm10: number | null, pm25: number | null): AirSnapshot["grade"] {
  if (pm10 === null && pm25 === null) return null;
  const score = Math.max(
    pm10 === null ? 0 : pm10 <= 30 ? 0 : pm10 <= 80 ? 1 : pm10 <= 150 ? 2 : 3,
    pm25 === null ? 0 : pm25 <= 15 ? 0 : pm25 <= 35 ? 1 : pm25 <= 75 ? 2 : 3,
  );
  return ["좋음", "보통", "나쁨", "매우 나쁨"][score] as AirSnapshot["grade"];
}

export function pulseScore(input: {
  activeNotices: number;
  precipitationProbability: number | null;
  pm25: number | null;
}): number | null {
  if (input.precipitationProbability === null && input.pm25 === null) return null;
  const noticeSignal = Math.min(input.activeNotices, 10) * 2;
  const weatherSignal = input.precipitationProbability === null ? 0 : (100 - input.precipitationProbability) * 0.35;
  const airSignal = input.pm25 === null ? 0 : Math.max(0, 35 - input.pm25) * 0.8;
  return Math.round(Math.max(0, Math.min(100, 30 + noticeSignal + weatherSignal + airSignal)));
}

export function normalizeTitle(value: string): string {
  return value
    .toLocaleLowerCase("ko-KR")
    .replace(/\[[^\]]+\]|\([^)]*보도자료[^)]*\)/g, " ")
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .trim();
}

const NEWS_STOP_WORDS = new Set(["원주", "원주시", "강원", "강원도", "강원특별자치도", "관련", "안내", "개최", "추진", "모집"]);

function titleTokens(value: string): Set<string> {
  return new Set(normalizeTitle(value).split(" ").filter((token) => token.length >= 2 && !NEWS_STOP_WORDS.has(token)));
}

function publicationDistanceDays(left: string, right: string): number {
  const a = new Date(left).getTime();
  const b = new Date(right).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / 86_400_000;
}

export function noticesAreSameStory(left: Notice, right: Notice): boolean {
  const leftTitle = normalizeTitle(left.title);
  const rightTitle = normalizeTitle(right.title);
  if (!leftTitle || !rightTitle) return false;
  if (leftTitle === rightTitle) return true;
  if (publicationDistanceDays(left.publishedAt, right.publishedAt) > 3) return false;
  const leftTokens = titleTokens(left.title);
  const rightTokens = titleTokens(right.title);
  if (leftTokens.size < 3 || rightTokens.size < 3) return false;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap >= 3 && overlap / Math.min(leftTokens.size, rightTokens.size) >= 0.72;
}

function noticeSources(item: Notice): NoticeSource[] {
  if (item.sources?.length) return item.sources;
  return [{
    provider: item.provider ?? "WONJU_CITY",
    label: item.provider === "NAVER_NEWS" ? item.department : "원주시청",
    url: item.canonicalUrl,
  }];
}

function locationRank(location: NewsLocation | null | undefined): number {
  return location?.confidence === "EXACT" ? 3 : location?.confidence === "VERIFIED_PLACE" ? 2 : location?.confidence === "DISTRICT_APPROXIMATE" ? 1 : 0;
}

export function dedupeNotices(items: Notice[]): Notice[] {
  const clusters: Notice[] = [];
  for (const item of items) {
    if (!normalizeTitle(item.title)) continue;
    const index = clusters.findIndex((candidate) => noticesAreSameStory(candidate, item));
    if (index === -1) {
      clusters.push({ ...item, sources: noticeSources(item) });
      continue;
    }
    const existing = clusters[index];
    const mergedSources = [...noticeSources(existing), ...noticeSources(item)].filter((source, sourceIndex, all) => all.findIndex((candidate) => candidate.url === source.url) === sourceIndex);
    clusters[index] = {
      ...existing,
      summary: existing.summary && existing.summary.length >= (item.summary?.length ?? 0) ? existing.summary : item.summary ?? existing.summary,
      sources: mergedSources,
      location: locationRank(item.location) > locationRank(existing.location) ? item.location : existing.location,
    };
  }
  return clusters;
}

export const WONJU_DISTRICTS = [
  "문막읍", "소초면", "호저면", "지정면", "부론면", "귀래면", "흥업면", "판부면", "신림면",
  "중앙동", "원인동", "개운동", "명륜1동", "명륜2동", "단구동", "일산동", "학성동", "단계동",
  "우산동", "태장1동", "태장2동", "봉산동", "행구동", "무실동", "반곡관설동",
] as const;

export function extractDistrictEvidence(value: string): string | null {
  const normalized = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return WONJU_DISTRICTS.find((district) => normalized.includes(district)) ?? null;
}

export function newsCoverage(items: Notice[]): NewsSnapshot["coverage"] {
  const eligible = items.length;
  const geolocated = items.filter((item) => item.location).length;
  return { geolocated, eligible, percentage: eligible ? Math.round(geolocated / eligible * 1000) / 10 : null };
}
