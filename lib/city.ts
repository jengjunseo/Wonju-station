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

export type Notice = {
  id: string;
  title: string;
  department: string;
  publishedAt: string;
  canonicalUrl: string;
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

export type CitySnapshot = {
  generatedAt: string;
  weather: WeatherSnapshot;
  air: AirSnapshot;
  alerts: AlertSnapshot;
  notices: { items: Notice[] } & ProviderStamp;
  population: PopulationSnapshot;
  mayor: MayorSnapshot;
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

export function dedupeNotices(items: Notice[]): Notice[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeTitle(item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
