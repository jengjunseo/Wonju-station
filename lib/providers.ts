import { airGrade, dedupeNotices, type AirSnapshot, type AlertSnapshot, type CitySnapshot, type Notice, type WeatherSnapshot } from "./city";

const WONJU = { latitude: 37.3422, longitude: 127.9202 };
const WONJU_NEWS_URL = "https://www.wonju.go.kr/www/sub.do?key=209";
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

async function safeFetch(url: string, timeoutMs = 6500): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json,text/html;q=0.9" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function unavailableWeather(detail: string): WeatherSnapshot {
  return {
    provider: "KMA / Open-Meteo fallback",
    sourceUrl: "https://www.weather.go.kr/",
    status: "UNAVAILABLE",
    fetchedAt: null,
    detail,
    temperature: null,
    apparentTemperature: null,
    humidity: null,
    windSpeed: null,
    weatherCode: null,
    high: null,
    low: null,
    precipitationProbability: null,
    sunrise: null,
    sunset: null,
    hourly: [],
  };
}

export async function fetchWeather(): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(WONJU.latitude),
    longitude: String(WONJU.longitude),
    timezone: "Asia/Seoul",
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    forecast_days: "3",
  });
  try {
    const response = await safeFetch(`${OPEN_METEO_URL}?${params}`);
    const data = (await response.json()) as {
      current: {
        time: string;
        temperature_2m: number | null;
        relative_humidity_2m: number | null;
        apparent_temperature: number | null;
        weather_code: number | null;
        wind_speed_10m: number | null;
      };
      hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: number[] };
      daily: { temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[]; sunrise: string[]; sunset: string[] };
    };
    const fetchedAt = new Date().toISOString();
    const startIndex = Math.max(0, data.hourly.time.findIndex((time: string) => time >= data.current.time));
    return {
      provider: "Open-Meteo · KMA 대체 피드",
      sourceUrl: "https://open-meteo.com/",
      status: "LIVE",
      fetchedAt,
      detail: "KMA 서비스 키가 없는 환경에서 사용하는 명시적 보조 피드",
      temperature: data.current.temperature_2m ?? null,
      apparentTemperature: data.current.apparent_temperature ?? null,
      humidity: data.current.relative_humidity_2m ?? null,
      windSpeed: data.current.wind_speed_10m ?? null,
      weatherCode: data.current.weather_code ?? null,
      high: data.daily.temperature_2m_max?.[0] ?? null,
      low: data.daily.temperature_2m_min?.[0] ?? null,
      precipitationProbability: data.daily.precipitation_probability_max?.[0] ?? null,
      sunrise: data.daily.sunrise?.[0] ?? null,
      sunset: data.daily.sunset?.[0] ?? null,
      hourly: data.hourly.time.slice(startIndex, startIndex + 12).map((time: string, index: number) => ({
        time,
        temperature: data.hourly.temperature_2m[startIndex + index],
        precipitationProbability: data.hourly.precipitation_probability[startIndex + index],
      })),
    };
  } catch (error) {
    return unavailableWeather(error instanceof Error ? error.message : "provider failure");
  }
}

export async function fetchAir(): Promise<AirSnapshot> {
  const params = new URLSearchParams({
    latitude: String(WONJU.latitude),
    longitude: String(WONJU.longitude),
    timezone: "Asia/Seoul",
    current: "pm10,pm2_5",
  });
  try {
    const response = await safeFetch(`${OPEN_METEO_AIR_URL}?${params}`);
    const data = (await response.json()) as { current?: { pm10?: number | null; pm2_5?: number | null } };
    const pm10 = data.current?.pm10 ?? null;
    const pm25 = data.current?.pm2_5 ?? null;
    return {
      provider: "Open-Meteo Air Quality",
      sourceUrl: "https://open-meteo.com/en/docs/air-quality-api",
      status: "LIVE",
      fetchedAt: new Date().toISOString(),
      detail: "AirKorea 키가 없는 환경의 보조 피드",
      pm10,
      pm25,
      grade: airGrade(pm10, pm25),
    };
  } catch (error) {
    return {
      provider: "AirKorea / Open-Meteo fallback",
      sourceUrl: "https://www.airkorea.or.kr/",
      status: "UNAVAILABLE",
      fetchedAt: null,
      detail: error instanceof Error ? error.message : "provider failure",
      pm10: null,
      pm25: null,
      grade: null,
    };
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function parseWonjuNotices(html: string): Notice[] {
  const items: Notice[] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const body = row[1];
    const cells = [...body.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => decodeHtml(match[1]));
    const link = body.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link || cells.length < 3) continue;
    const title = decodeHtml(link[2]);
    const date = cells.find((cell) => /^20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}$/.test(cell));
    if (!title || !date) continue;
    const canonicalUrl = new URL(link[1].replace(/&amp;/g, "&"), WONJU_NEWS_URL).toString();
    items.push({
      id: canonicalUrl,
      title,
      department: cells.find((cell) => /과$|센터$|소$|관$/.test(cell)) ?? "원주시",
      publishedAt: date.replace(/\./g, "-"),
      canonicalUrl,
    });
  }
  return dedupeNotices(items).slice(0, 8);
}

export async function fetchNotices() {
  try {
    const response = await safeFetch(WONJU_NEWS_URL);
    const items = parseWonjuNotices(await response.text());
    if (!items.length) throw new Error("공식 목록 형식 변경 감지");
    return {
      provider: "원주시청 새소식",
      sourceUrl: WONJU_NEWS_URL,
      status: "LIVE" as const,
      fetchedAt: new Date().toISOString(),
      items,
    };
  } catch (error) {
    return {
      provider: "원주시청 새소식",
      sourceUrl: WONJU_NEWS_URL,
      status: "UNAVAILABLE" as const,
      fetchedAt: null,
      detail: error instanceof Error ? error.message : "provider failure",
      items: [],
    };
  }
}

export function alertUnavailable(): AlertSnapshot {
  return {
    provider: "기상청 기상특보",
    sourceUrl: "https://www.weather.go.kr/w/warning/report.do",
    status: "UNAVAILABLE",
    fetchedAt: null,
    detail: "검증된 특보 어댑터 자격 증명 미구성",
    level: null,
    label: "CHECK",
    title: null,
    issuedAt: null,
  };
}

export async function getCitySnapshot(): Promise<CitySnapshot> {
  const [weather, air, notices] = await Promise.all([fetchWeather(), fetchAir(), fetchNotices()]);
  return { generatedAt: new Date().toISOString(), weather, air, notices, alerts: alertUnavailable() };
}
