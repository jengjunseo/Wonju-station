import { airGrade, dedupeNotices, type AirSnapshot, type AlertSnapshot, type CitySnapshot, type MayorSnapshot, type Notice, type PopulationSnapshot, type WeatherSnapshot } from "./city.ts";

const WONJU = { latitude: 37.3422, longitude: 127.9202 };
const WONJU_NEWS_URL = "https://www.wonju.go.kr/www/sub.do?key=209";
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const WONJU_POPULATION_URL = "https://www.wonju.go.kr/stat/selectBbsNttList.do?bbsNo=1229&integrDeptCode=&key=6313&pageUnit=40&searchCnd=all&searchCtgry=&searchKrwd=";
const WONJU_HOME_URL = "https://www.wonju.go.kr/www/main.do";

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

export function parsePopulationDetail(html: string): Omit<PopulationSnapshot, keyof import("./city.ts").ProviderStamp> {
  const text = decodeHtml(html).replace(/,/g, "");
  const period = text.match(/(20\d{2}년\s*\d{1,2}월말)\s*기준/)?.[1]?.replace(/\s+/g, " ") ?? null;
  const households = text.match(/세대수\s*([0-9]+)세대/)?.[1];
  const populationBlock = text.match(/인구수\s*([0-9]+)명[^남]*남\s*([0-9]+)[^여]*여\s*([0-9]+)/);
  const householdChange = text.match(/세대수[^▶]*▶?\s*전월대비\s*([0-9]+)세대\s*(증가|감소)/);
  const populationChange = text.match(/인구수[^▶]*▶?\s*전월대비\s*([0-9]+)명\s*(증가|감소)/);
  const signed = (match: RegExpMatchArray | null) => match ? Number(match[1]) * (match[2] === "감소" ? -1 : 1) : null;
  return {
    period,
    households: households ? Number(households) : null,
    population: populationBlock ? Number(populationBlock[1]) : null,
    male: populationBlock ? Number(populationBlock[2]) : null,
    female: populationBlock ? Number(populationBlock[3]) : null,
    householdChange: signed(householdChange),
    populationChange: signed(populationChange),
  };
}

export async function fetchPopulation(): Promise<PopulationSnapshot> {
  try {
    const listResponse = await safeFetch(WONJU_POPULATION_URL);
    const listHtml = await listResponse.text();
    const detailLink = [...listHtml.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => ({ href: match[1], title: decodeHtml(match[2]) }))
      .find((item) => /20\d{2}년\s*\d{1,2}월말\s*기준\s*원주시\s*인구현황/.test(item.title));
    if (!detailLink) throw new Error("최신 인구 게시물 링크를 찾지 못함");
    const sourceUrl = new URL(detailLink.href.replace(/&amp;/g, "&"), WONJU_POPULATION_URL).toString();
    const detailResponse = await safeFetch(sourceUrl);
    const parsed = parsePopulationDetail(await detailResponse.text());
    if (parsed.population === null || parsed.households === null) throw new Error("인구 상세 형식 변경 감지");
    return { provider: "원주통계정보 월별인구현황", sourceUrl, status: "LIVE", fetchedAt: new Date().toISOString(), ...parsed };
  } catch (error) {
    return { provider: "원주통계정보 월별인구현황", sourceUrl: WONJU_POPULATION_URL, status: "UNAVAILABLE", fetchedAt: null, detail: error instanceof Error ? error.message : "provider failure", period: null, population: null, households: null, male: null, female: null, populationChange: null, householdChange: null };
  }
}

export async function fetchMayor(): Promise<MayorSnapshot> {
  try {
    const response = await safeFetch(WONJU_HOME_URL);
    const name = decodeHtml(await response.text()).match(/원주시장\s*([가-힣]{2,4})\s*입니다/)?.[1] ?? null;
    if (!name) throw new Error("공식 시장 표기 형식 변경 감지");
    return { provider: "원주시청", sourceUrl: WONJU_HOME_URL, status: "LIVE", fetchedAt: new Date().toISOString(), name };
  } catch (error) {
    return { provider: "원주시청", sourceUrl: WONJU_HOME_URL, status: "UNAVAILABLE", fetchedAt: null, detail: error instanceof Error ? error.message : "provider failure", name: null };
  }
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
  const [weather, air, notices, population, mayor] = await Promise.all([fetchWeather(), fetchAir(), fetchNotices(), fetchPopulation(), fetchMayor()]);
  return { generatedAt: new Date().toISOString(), weather, air, notices, population, mayor, alerts: alertUnavailable() };
}
