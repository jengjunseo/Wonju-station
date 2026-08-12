import { airGrade, alertLabel, dedupeNotices, extractDistrictEvidence, newsCoverage, type AirSnapshot, type AlertSnapshot, type CitySnapshot, type MayorSnapshot, type MapSnapshot, type NewsSnapshot, type Notice, type PopulationSnapshot, type ProviderStamp, type WeatherSnapshot } from "./city.ts";

const WONJU = { latitude: 37.3422, longitude: 127.9202 };
const WONJU_NEWS_URL = "https://www.wonju.go.kr/www/sub.do?key=209";
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const WONJU_POPULATION_URL = "https://www.wonju.go.kr/stat/selectBbsNttList.do?bbsNo=1229&integrDeptCode=&key=6313&pageUnit=40&searchCnd=all&searchCtgry=&searchKrwd=";
const WONJU_HOME_URL = "https://www.wonju.go.kr/www/main.do";
const KMA_FORECAST_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";
const KMA_ALERT_URL = "https://apis.data.go.kr/1360000/WthrWrnInfoService/getPwnStatus";
const KMA_SOURCE_URL = "https://www.data.go.kr/data/15084084/openapi.do";
const AIRKOREA_STATION_URL = "https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getMsrstnList";
const AIRKOREA_MEASURE_URL = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty";
const AIRKOREA_SOURCE_URL = "https://www.data.go.kr/data/15073861/openapi.do";
const NAVER_NEWS_URL = "https://openapi.naver.com/v1/search/news.json";
const NAVER_NEWS_SOURCE_URL = "https://developers.naver.com/docs/serviceapi/search/news/news.md";
const KAKAO_ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json";
const KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
export const KAKAO_LOCAL_SOURCE_URL = "https://developers.kakao.com/docs/ko/local/dev-guide#search-by-keyword";

export type WonjuPlace = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  roadAddress: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  placeUrl: string;
  distance: number | null;
};

export type WonjuPlaceSearch = {
  provider: "Kakao Local";
  sourceUrl: string;
  status: "LIVE" | "UNAVAILABLE";
  fetchedAt: string | null;
  query: string;
  places: WonjuPlace[];
  detail: string;
};

function envValue(name: string): string | null {
  const value = typeof process !== "undefined" ? process.env[name]?.trim() : undefined;
  return value || null;
}

function publicDataKey(specificName: string): string | null {
  return envValue(specificName) ?? envValue("PUBLIC_DATA_SERVICE_KEY");
}

export function buildWonjuPlaceQuery(question: string): string {
  const intent = question
    .replace(/[?!.,~]+/g, " ")
    .replace(/원주시?(?:에서|의|에|로|근처)?/g, " ")
    .replace(/(?:추천해|알려|찾아)(?:줘|주세요|줄래|볼래)?/g, " ")
    .replace(/갈\s*만한/g, " ")
    .replace(/([가-힣]+(?:읍|면|동))에서/g, "$1 ")
    .replace(/먹을\s*곳(?:이)?\s*있어/g, "음식점")
    .replace(/밥\s*음식점/g, "음식점")
    .replace(/있어|어디야|어디\s*있어/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `원주시 ${intent || "장소"}`.slice(0, 80);
}

type KakaoPlaceDocument = {
  id?: unknown;
  place_name?: unknown;
  category_name?: unknown;
  address_name?: unknown;
  road_address_name?: unknown;
  phone?: unknown;
  x?: unknown;
  y?: unknown;
  place_url?: unknown;
  distance?: unknown;
};

export function normalizeKakaoPlaces(data: unknown): WonjuPlace[] {
  const documents = (data as { documents?: KakaoPlaceDocument[] })?.documents;
  if (!Array.isArray(documents)) return [];
  return documents.flatMap((document): WonjuPlace[] => {
    const id = typeof document.id === "string" ? document.id.trim() : "";
    const name = typeof document.place_name === "string" ? document.place_name.replace(/\s+/g, " ").trim() : "";
    const address = typeof document.address_name === "string" && document.address_name.trim() ? document.address_name.replace(/\s+/g, " ").trim() : null;
    const roadAddress = typeof document.road_address_name === "string" && document.road_address_name.trim() ? document.road_address_name.replace(/\s+/g, " ").trim() : null;
    const latitude = finiteNumber(document.y);
    const longitude = finiteNumber(document.x);
    const placeUrl = typeof document.place_url === "string" ? document.place_url.trim() : "";
    const isWonju = [address, roadAddress].some((value) => value?.includes("원주"));
    if (!id || !name || !isWonju || latitude === null || longitude === null || !/^https?:\/\/place\.map\.kakao\.com\/\d+\/?$/i.test(placeUrl)) return [];
    return [{
      id,
      name: name.slice(0, 100),
      category: typeof document.category_name === "string" && document.category_name.trim() ? document.category_name.replace(/\s+/g, " ").trim().slice(0, 160) : null,
      address,
      roadAddress,
      phone: typeof document.phone === "string" && document.phone.trim() ? document.phone.trim().slice(0, 40) : null,
      latitude,
      longitude,
      placeUrl,
      distance: finiteNumber(document.distance),
    }];
  }).filter((place, index, all) => all.findIndex((candidate) => candidate.id === place.id) === index).slice(0, 6);
}

const wonjuPlaceCache = new Map<string, { value: WonjuPlaceSearch; expiresAt: number }>();

export async function searchWonjuPlaces(question: string, kakaoKey = envValue("KAKAO_REST_API_KEY")): Promise<WonjuPlaceSearch> {
  const query = buildWonjuPlaceQuery(question);
  const unavailable = (detail: string): WonjuPlaceSearch => ({ provider: "Kakao Local", sourceUrl: KAKAO_LOCAL_SOURCE_URL, status: "UNAVAILABLE", fetchedAt: null, query, places: [], detail });
  if (!kakaoKey) return unavailable("KAKAO_REST_API_KEY 미구성");
  const cached = wonjuPlaceCache.get(query);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const params = new URLSearchParams({
      query,
      x: String(WONJU.longitude),
      y: String(WONJU.latitude),
      radius: "20000",
      size: "8",
      sort: "accuracy",
    });
    const response = await safeFetch(`${KAKAO_KEYWORD_URL}?${params}`, 4500, { headers: { Authorization: `KakaoAK ${kakaoKey}` } });
    const places = normalizeKakaoPlaces(await response.json());
    const value: WonjuPlaceSearch = {
      provider: "Kakao Local",
      sourceUrl: KAKAO_LOCAL_SOURCE_URL,
      status: "LIVE",
      fetchedAt: new Date().toISOString(),
      query,
      places,
      detail: places.length ? `원주 중심 20km · 주소 원주 검증 · ${places.length}건` : "검색 결과 없음",
    };
    wonjuPlaceCache.set(query, { value, expiresAt: Date.now() + 5 * 60_000 });
    return value;
  } catch (error) {
    const value = unavailable(error instanceof Error ? error.message : "provider failure");
    wonjuPlaceCache.set(query, { value, expiresAt: Date.now() + 60_000 });
    return value;
  }
}

async function safeFetch(url: string, timeoutMs = 6500, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json,text/html;q=0.9", ...init.headers },
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

type KmaItem = { category?: string; obsrValue?: string; fcstValue?: string; fcstDate?: string; fcstTime?: string };

function kstDateParts(date = new Date()): { date: string; hour: number; minute: number } {
  const shifted = new Date(date.getTime() + 9 * 60 * 60_000);
  return {
    date: `${shifted.getUTCFullYear()}${String(shifted.getUTCMonth() + 1).padStart(2, "0")}${String(shifted.getUTCDate()).padStart(2, "0")}`,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function previousKstDate(date = new Date()): string {
  return kstDateParts(new Date(date.getTime() - 24 * 60 * 60_000)).date;
}

function latestKmaBase(schedule: number[], releaseDelayMinutes: number, date = new Date()): { baseDate: string; baseTime: string } {
  const now = kstDateParts(date);
  const currentMinutes = now.hour * 60 + now.minute;
  const available = schedule.filter((hour) => currentMinutes >= hour * 60 + releaseDelayMinutes);
  const hour = available.at(-1);
  return hour === undefined
    ? { baseDate: previousKstDate(date), baseTime: `${String(schedule.at(-1) ?? 23).padStart(2, "0")}00` }
    : { baseDate: now.date, baseTime: `${String(hour).padStart(2, "0")}00` };
}

function publicDataItems(data: unknown): KmaItem[] {
  const record = data as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: KmaItem[] | KmaItem } } } };
  const code = record.response?.header?.resultCode;
  if (code !== "00" && code !== "0") throw new Error(`provider result ${code ?? "missing"}`);
  const item = record.response?.body?.items?.item;
  return Array.isArray(item) ? item : item ? [item] : [];
}

function kmaWeatherCode(sky: number | null, precipitation: number | null): number | null {
  if (precipitation === 1 || precipitation === 5) return 61;
  if (precipitation === 2 || precipitation === 6) return 66;
  if (precipitation === 3 || precipitation === 7) return 71;
  if (sky === 1) return 0;
  if (sky === 3) return 2;
  if (sky === 4) return 3;
  return null;
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() && value !== "-" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function latLonToKmaGrid(latitude: number, longitude: number): { nx: number; ny: number } {
  const rad = Math.PI / 180;
  const re = 6371.00877 / 5;
  const slat1 = 30 * rad;
  const slat2 = 60 * rad;
  const olon = 126 * rad;
  const olat = 38 * rad;
  const xo = 43;
  const yo = 136;
  const sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(Math.tan(Math.PI * .25 + slat2 * .5) / Math.tan(Math.PI * .25 + slat1 * .5));
  const sf = Math.pow(Math.tan(Math.PI * .25 + slat1 * .5), sn) * Math.cos(slat1) / sn;
  const ro = re * sf / Math.pow(Math.tan(Math.PI * .25 + olat * .5), sn);
  const ra = re * sf / Math.pow(Math.tan(Math.PI * .25 + latitude * rad * .5), sn);
  let theta = longitude * rad - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + xo + .5), ny: Math.floor(ro - ra * Math.cos(theta) + yo + .5) };
}

export async function fetchKmaWeather(key = publicDataKey("KMA_SERVICE_KEY"), now = new Date()): Promise<WeatherSnapshot> {
  if (!key) throw new Error("KMA_SERVICE_KEY not configured");
  const grid = latLonToKmaGrid(WONJU.latitude, WONJU.longitude);
  const currentBase = latestKmaBase(Array.from({ length: 24 }, (_, hour) => hour), 12, now);
  const forecastBase = latestKmaBase([2, 5, 8, 11, 14, 17, 20, 23], 15, now);
  const request = async (operation: string, base: { baseDate: string; baseTime: string }) => {
    const params = new URLSearchParams({ serviceKey: key, pageNo: "1", numOfRows: "1000", dataType: "JSON", base_date: base.baseDate, base_time: base.baseTime, nx: String(grid.nx), ny: String(grid.ny) });
    return publicDataItems(await (await safeFetch(`${KMA_FORECAST_URL}/${operation}?${params}`, 6500)).json());
  };
  const [currentItems, forecastItems] = await Promise.all([
    request("getUltraSrtNcst", currentBase),
    request("getVilageFcst", forecastBase),
  ]);
  const current = new Map(currentItems.map((item) => [item.category, item.obsrValue]));
  const today = kstDateParts(now).date;
  const todayItems = forecastItems.filter((item) => item.fcstDate === today);
  const byTime = new Map<string, Map<string, string>>();
  for (const item of todayItems) {
    if (!item.fcstTime || !item.category || item.fcstValue === undefined) continue;
    const values = byTime.get(item.fcstTime) ?? new Map<string, string>();
    values.set(item.category, item.fcstValue);
    byTime.set(item.fcstTime, values);
  }
  const orderedTimes = [...byTime.keys()].sort();
  const nowTime = `${String(kstDateParts(now).hour).padStart(2, "0")}00`;
  const representative = byTime.get(orderedTimes.find((time) => time >= nowTime) ?? orderedTimes[0] ?? "") ?? new Map<string, string>();
  const temperature = finiteNumber(current.get("T1H"));
  if (temperature === null) throw new Error("KMA current temperature missing");
  const hourly = orderedTimes.slice(0, 12).flatMap((time) => {
    const values = byTime.get(time);
    const itemTemperature = finiteNumber(values?.get("TMP"));
    if (itemTemperature === null) return [];
    return [{
      time: `${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2)}:00+09:00`,
      temperature: itemTemperature,
      precipitationProbability: finiteNumber(values?.get("POP")) ?? 0,
    }];
  });
  const precipitation = finiteNumber(current.get("PTY")) ?? finiteNumber(representative.get("PTY"));
  const sky = finiteNumber(representative.get("SKY"));
  return {
    provider: "기상청 단기예보",
    sourceUrl: KMA_SOURCE_URL,
    status: "LIVE",
    fetchedAt: new Date().toISOString(),
    detail: `기상청 ${grid.nx},${grid.ny} 격자 · 발표 ${forecastBase.baseDate} ${forecastBase.baseTime}`,
    temperature,
    apparentTemperature: null,
    humidity: finiteNumber(current.get("REH")),
    windSpeed: finiteNumber(current.get("WSD")),
    weatherCode: kmaWeatherCode(sky, precipitation),
    high: finiteNumber(todayItems.find((item) => item.category === "TMX")?.fcstValue),
    low: finiteNumber(todayItems.find((item) => item.category === "TMN")?.fcstValue),
    precipitationProbability: Math.max(...todayItems.filter((item) => item.category === "POP").map((item) => finiteNumber(item.fcstValue) ?? 0), 0),
    sunrise: null,
    sunset: null,
    hourly,
  };
}

async function fetchOpenMeteoWeather(fallbackReason: string): Promise<WeatherSnapshot> {
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
    const temperature = finiteNumber(data.current?.temperature_2m);
    if (temperature === null || !Array.isArray(data.hourly?.time) || !Array.isArray(data.hourly?.temperature_2m) || !Array.isArray(data.hourly?.precipitation_probability)) throw new Error("Open-Meteo weather payload malformed");
    const fetchedAt = new Date().toISOString();
    const startIndex = Math.max(0, data.hourly.time.findIndex((time: string) => time >= data.current.time));
    return {
      provider: "Open-Meteo · KMA 대체 피드",
      sourceUrl: "https://open-meteo.com/",
      status: "LIVE",
      fetchedAt,
      detail: `KMA 대신 사용하는 명시적 보조 피드 · ${fallbackReason}`,
      temperature,
      apparentTemperature: finiteNumber(data.current.apparent_temperature),
      humidity: finiteNumber(data.current.relative_humidity_2m),
      windSpeed: finiteNumber(data.current.wind_speed_10m),
      weatherCode: finiteNumber(data.current.weather_code),
      high: finiteNumber(data.daily?.temperature_2m_max?.[0]),
      low: finiteNumber(data.daily?.temperature_2m_min?.[0]),
      precipitationProbability: finiteNumber(data.daily?.precipitation_probability_max?.[0]),
      sunrise: data.daily.sunrise?.[0] ?? null,
      sunset: data.daily.sunset?.[0] ?? null,
      hourly: data.hourly.time.slice(startIndex, startIndex + 12).flatMap((time: string, index: number) => {
        const hourlyTemperature = finiteNumber(data.hourly.temperature_2m[startIndex + index]);
        const precipitationProbability = finiteNumber(data.hourly.precipitation_probability[startIndex + index]);
        return hourlyTemperature === null || precipitationProbability === null ? [] : [{ time, temperature: hourlyTemperature, precipitationProbability }];
      }),
    };
  } catch (error) {
    return unavailableWeather(error instanceof Error ? error.message : "provider failure");
  }
}

export async function fetchWeather(): Promise<WeatherSnapshot> {
  const key = publicDataKey("KMA_SERVICE_KEY");
  if (key) {
    try {
      return await fetchKmaWeather(key);
    } catch (error) {
      return fetchOpenMeteoWeather(`KMA 실패 격리: ${error instanceof Error ? error.message : "provider failure"}`);
    }
  }
  return fetchOpenMeteoWeather("KMA_SERVICE_KEY 미구성");
}

type AirKoreaStation = { stationName?: string; addr?: string; dmX?: string; dmY?: string };
type AirKoreaMeasurement = { pm10Value?: string; pm25Value?: string; dataTime?: string };

function publicDataRecords<T>(data: unknown): T[] {
  const record = data as { response?: { header?: { resultCode?: string }; body?: { items?: T[] | T | { item?: T[] | T } } } };
  const code = record.response?.header?.resultCode;
  if (code !== "00" && code !== "0") throw new Error(`provider result ${code ?? "missing"}`);
  const raw = record.response?.body?.items;
  const item = raw && !Array.isArray(raw) && typeof raw === "object" && "item" in raw ? raw.item : raw;
  return Array.isArray(item) ? item : item ? [item as T] : [];
}

export async function fetchAirKorea(key = publicDataKey("AIRKOREA_SERVICE_KEY")): Promise<AirSnapshot> {
  if (!key) throw new Error("AIRKOREA_SERVICE_KEY not configured");
  const stationParams = new URLSearchParams({ serviceKey: key, returnType: "json", numOfRows: "100", pageNo: "1", addr: "강원특별자치도 원주시" });
  const stations = publicDataRecords<AirKoreaStation>(await (await safeFetch(`${AIRKOREA_STATION_URL}?${stationParams}`, 6500)).json())
    .filter((station) => station.stationName && station.addr?.includes("원주시"));
  if (!stations.length) throw new Error("원주시 측정소를 찾지 못함");
  const station = [...stations].sort((left, right) => {
    const distance = (value: AirKoreaStation) => {
      const lat = finiteNumber(value.dmX);
      const lon = finiteNumber(value.dmY);
      return lat === null || lon === null ? Number.POSITIVE_INFINITY : (lat - WONJU.latitude) ** 2 + (lon - WONJU.longitude) ** 2;
    };
    return distance(left) - distance(right);
  })[0];
  const measureParams = new URLSearchParams({ serviceKey: key, returnType: "json", numOfRows: "1", pageNo: "1", stationName: station.stationName!, dataTerm: "DAILY", ver: "1.3" });
  const measurement = publicDataRecords<AirKoreaMeasurement>(await (await safeFetch(`${AIRKOREA_MEASURE_URL}?${measureParams}`, 6500)).json())[0];
  const pm10 = finiteNumber(measurement?.pm10Value);
  const pm25 = finiteNumber(measurement?.pm25Value);
  if (pm10 === null && pm25 === null) throw new Error("측정값이 비어 있음");
  return {
    provider: `에어코리아 · ${station.stationName} 측정소`,
    sourceUrl: AIRKOREA_SOURCE_URL,
    status: "LIVE",
    fetchedAt: new Date().toISOString(),
    detail: measurement?.dataTime ? `측정시각 ${measurement.dataTime}` : "에어코리아 실시간 측정",
    pm10,
    pm25,
    grade: airGrade(pm10, pm25),
  };
}

async function fetchOpenMeteoAir(fallbackReason: string): Promise<AirSnapshot> {
  const params = new URLSearchParams({
    latitude: String(WONJU.latitude),
    longitude: String(WONJU.longitude),
    timezone: "Asia/Seoul",
    current: "pm10,pm2_5",
  });
  try {
    const response = await safeFetch(`${OPEN_METEO_AIR_URL}?${params}`);
    const data = (await response.json()) as { current?: { pm10?: number | null; pm2_5?: number | null } };
    const pm10 = finiteNumber(data.current?.pm10);
    const pm25 = finiteNumber(data.current?.pm2_5);
    if (pm10 === null && pm25 === null) throw new Error("Open-Meteo air payload malformed");
    return {
      provider: "Open-Meteo Air Quality",
      sourceUrl: "https://open-meteo.com/en/docs/air-quality-api",
      status: "LIVE",
      fetchedAt: new Date().toISOString(),
      detail: `AirKorea 대신 사용하는 보조 피드 · ${fallbackReason}`,
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

export async function fetchAir(): Promise<AirSnapshot> {
  const key = publicDataKey("AIRKOREA_SERVICE_KEY");
  if (key) {
    try {
      return await fetchAirKorea(key);
    } catch (error) {
      return fetchOpenMeteoAir(`AirKorea 실패 격리: ${error instanceof Error ? error.message : "provider failure"}`);
    }
  }
  return fetchOpenMeteoAir("AIRKOREA_SERVICE_KEY 미구성");
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
    .replace(/\s+([,.!?;:])/g, "$1")
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
      summary: null,
      provider: "WONJU_CITY",
      sources: [{ provider: "WONJU_CITY", label: "원주시청", url: canonicalUrl }],
      location: null,
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

async function fetchOfficialNotices(): Promise<ProviderStamp & { key: "WONJU_CITY"; items: Notice[] }> {
  try {
    const response = await safeFetch(WONJU_NEWS_URL);
    const items = parseWonjuNotices(await response.text());
    if (!items.length) throw new Error("공식 목록 형식 변경 감지");
    return {
      provider: "원주시청 새소식",
      key: "WONJU_CITY" as const,
      sourceUrl: WONJU_NEWS_URL,
      status: "LIVE" as const,
      fetchedAt: new Date().toISOString(),
      items,
    };
  } catch (error) {
    return {
      provider: "원주시청 새소식",
      key: "WONJU_CITY" as const,
      sourceUrl: WONJU_NEWS_URL,
      status: "UNAVAILABLE" as const,
      fetchedAt: null,
      detail: error instanceof Error ? error.message : "provider failure",
      items: [],
    };
  }
}

type NaverNewsItem = { title?: string; originallink?: string; link?: string; description?: string; pubDate?: string };

function validPublicUrl(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function publicationDate(value: string | undefined): string | null {
  const date = new Date(value ?? "");
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

export function normalizeNaverItems(data: unknown): Notice[] {
  const rawItems = (data as { items?: NaverNewsItem[] })?.items;
  if (!Array.isArray(rawItems)) throw new Error("Naver response items missing");
  return rawItems.flatMap((raw) => {
    const title = decodeHtml(raw.title ?? "");
    const summary = decodeHtml(raw.description ?? "");
    const publishedAt = publicationDate(raw.pubDate);
    const canonicalUrl = validPublicUrl(raw.originallink) ?? validPublicUrl(raw.link);
    const searchable = `${title} ${summary}`;
    if (!title || !publishedAt || !canonicalUrl || !searchable.includes("원주시")) return [];
    const hostname = new URL(canonicalUrl).hostname.replace(/^www\./, "");
    return [{
      id: canonicalUrl,
      title,
      department: hostname,
      publishedAt,
      canonicalUrl,
      summary: summary.slice(0, 240) || null,
      provider: "NAVER_NEWS" as const,
      sources: [{ provider: "NAVER_NEWS" as const, label: hostname, url: canonicalUrl }],
      location: null,
    }];
  });
}

let naverNewsCache: { value: ProviderStamp & { key: "NAVER_NEWS"; items: Notice[] }; expiresAt: number } | null = null;

export async function fetchNaverNews(): Promise<ProviderStamp & { key: "NAVER_NEWS"; items: Notice[] }> {
  const clientId = envValue("NAVER_NEWS_CLIENT_ID");
  const clientSecret = envValue("NAVER_NEWS_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return { provider: "Naver 뉴스 검색", key: "NAVER_NEWS", sourceUrl: NAVER_NEWS_SOURCE_URL, status: "UNAVAILABLE", fetchedAt: null, detail: "NAVER_NEWS_CLIENT_ID / NAVER_NEWS_CLIENT_SECRET 미구성", items: [] };
  }
  if (naverNewsCache && naverNewsCache.expiresAt > Date.now()) return naverNewsCache.value;
  try {
    const params = new URLSearchParams({ query: "원주시", display: "30", start: "1", sort: "date" });
    const response = await safeFetch(`${NAVER_NEWS_URL}?${params}`, 5000, { headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret } });
    const items = dedupeNotices(normalizeNaverItems(await response.json())).slice(0, 12);
    const value = { provider: "Naver 뉴스 검색", key: "NAVER_NEWS" as const, sourceUrl: NAVER_NEWS_SOURCE_URL, status: "LIVE" as const, fetchedAt: new Date().toISOString(), detail: "정밀 질의: 원주시 · 날짜순 30건 · 본문 미수집", items };
    naverNewsCache = { value, expiresAt: Date.now() + 5 * 60_000 };
    return value;
  } catch (error) {
    return { provider: "Naver 뉴스 검색", key: "NAVER_NEWS", sourceUrl: NAVER_NEWS_SOURCE_URL, status: "UNAVAILABLE", fetchedAt: null, detail: error instanceof Error ? error.message : "provider failure", items: [] };
  }
}

const districtGeocodeCache = new Map<string, { value: Notice["location"]; expiresAt: number }>();

async function geocodeDistrict(district: string, key: string): Promise<Notice["location"]> {
  const params = new URLSearchParams({ query: `강원특별자치도 원주시 ${district}`, analyze_type: "exact", size: "1" });
  const response = await safeFetch(`${KAKAO_ADDRESS_URL}?${params}`, 4500, { headers: { Authorization: `KakaoAK ${key}` } });
  const documents = (await response.json() as { documents?: Array<{ address_name?: string; x?: string; y?: string; address?: { region_2depth_name?: string } }> }).documents;
  const result = Array.isArray(documents) ? documents[0] : null;
  const latitude = finiteNumber(result?.y);
  const longitude = finiteNumber(result?.x);
  if (!result || latitude === null || longitude === null || !result.address?.region_2depth_name?.includes("원주")) return null;
  return { label: `${district} 일대`, district, latitude, longitude, confidence: "DISTRICT_APPROXIMATE", approximate: true, evidence: `기사 문구의 ${district} · Kakao 주소 검색 지역 좌표` };
}

export async function geolocateNews(items: Notice[], kakaoKey = envValue("KAKAO_REST_API_KEY")): Promise<Notice[]> {
  if (!kakaoKey) return items;
  const districts = [...new Set(items.map((item) => extractDistrictEvidence(`${item.title} ${item.summary ?? ""}`)).filter((value): value is string => Boolean(value)))].slice(0, 5);
  const resolved = new Map<string, Notice["location"]>();
  await Promise.all(districts.map(async (district) => {
    const cached = districtGeocodeCache.get(district);
    if (cached && cached.expiresAt > Date.now()) { resolved.set(district, cached.value); return; }
    try {
      const value = await geocodeDistrict(district, kakaoKey);
      districtGeocodeCache.set(district, { value, expiresAt: Date.now() + (value ? 24 * 60 * 60_000 : 5 * 60_000) });
      resolved.set(district, value);
    } catch {
      districtGeocodeCache.set(district, { value: null, expiresAt: Date.now() + 5 * 60_000 });
      resolved.set(district, null);
    }
  }));
  return items.map((item) => {
    const district = extractDistrictEvidence(`${item.title} ${item.summary ?? ""}`);
    return district ? { ...item, location: resolved.get(district) ?? null } : item;
  });
}

export async function fetchNotices(): Promise<NewsSnapshot> {
  const [official, naver] = await Promise.all([fetchOfficialNotices(), fetchNaverNews()]);
  const clustered = dedupeNotices([...official.items, ...naver.items]).slice(0, 16);
  const items = await geolocateNews(clustered);
  const liveProviders = [official, naver].filter((provider) => provider.status !== "UNAVAILABLE");
  const fetchedAt = liveProviders.map((provider) => provider.fetchedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return {
    provider: "원주시청 + Naver 뉴스",
    sourceUrl: WONJU_NEWS_URL,
    status: liveProviders.length ? "LIVE" : "UNAVAILABLE",
    fetchedAt,
    detail: naver.status === "UNAVAILABLE" ? "원주시청 피드는 독립 운영 · Naver는 자격 증명 대기 또는 실패" : "독립 제공자 통합 · 결정론적 교차 중복 제거",
    items,
    providers: [official, naver].map(({ key, provider, sourceUrl, status, fetchedAt: time, detail }) => ({ key, provider, sourceUrl, status, fetchedAt: time, detail })),
    coverage: newsCoverage(items),
  };
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

function compactKstTimestamp(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 12) return null;
  const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}T${digits.slice(8, 10)}:${digits.slice(10, 12)}:00+09:00`;
  return Number.isFinite(new Date(iso).getTime()) ? iso : null;
}

export async function fetchAlerts(key = publicDataKey("KMA_SERVICE_KEY")): Promise<AlertSnapshot> {
  if (!key) return alertUnavailable();
  try {
    const params = new URLSearchParams({ serviceKey: key, pageNo: "1", numOfRows: "200", dataType: "JSON" });
    const records = publicDataRecords<Record<string, unknown>>(await (await safeFetch(`${KMA_ALERT_URL}?${params}`, 6000)).json());
    const wonju = records.filter((record) => decodeHtml(JSON.stringify(record)).includes("원주"));
    if (!wonju.length) {
      return { provider: "기상청 특보현황", sourceUrl: "https://www.data.go.kr/data/15000415/openapi.do", status: "LIVE", fetchedAt: new Date().toISOString(), detail: "기상청 활성 특보현황 응답에서 원주 항목 없음", level: 0, label: "NORMAL", title: null, issuedAt: null };
    }
    const text = wonju.map((record) => decodeHtml(JSON.stringify(record))).join(" ");
    const level = text.includes("경보") ? 3 as const : text.includes("주의보") ? 2 as const : 1 as const;
    const first = wonju[0];
    const title = decodeHtml(String(first.title ?? first.wrn ?? first.warnVar ?? "원주 기상특보"));
    return { provider: "기상청 특보현황", sourceUrl: "https://www.data.go.kr/data/15000415/openapi.do", status: "LIVE", fetchedAt: new Date().toISOString(), detail: "기상청 활성 특보현황의 원주 명시 항목", level, label: alertLabel(level), title, issuedAt: compactKstTimestamp(first.tmFc ?? first.tmEf) };
  } catch (error) {
    return { ...alertUnavailable(), detail: `KMA 특보 실패 격리: ${error instanceof Error ? error.message : "provider failure"}` };
  }
}

export function getMapConfiguration(): MapSnapshot {
  const publicAppKey = envValue("NEXT_PUBLIC_KAKAO_MAP_KEY");
  if (!publicAppKey) return { provider: "OpenStreetMap", kind: "OPENSTREETMAP", status: "LIVE", fetchedAt: new Date().toISOString(), publicAppKey: null, sourceUrl: "https://www.openstreetmap.org/", detail: "Kakao JavaScript 키 미구성 · OSM 보조 지도 사용" };
  return { provider: "Kakao Maps", kind: "KAKAO_MAPS", status: "FRESH", fetchedAt: new Date().toISOString(), publicAppKey, sourceUrl: "https://developers.kakao.com/docs/ko/kakaomap/common", detail: "공개용 JavaScript 키 · 등록된 웹 도메인에서 활성화" };
}

let citySnapshotCache: { value: CitySnapshot; expiresAt: number } | null = null;
let citySnapshotPending: Promise<CitySnapshot> | null = null;

export async function getCitySnapshot(): Promise<CitySnapshot> {
  if (citySnapshotCache && citySnapshotCache.expiresAt > Date.now()) return citySnapshotCache.value;
  if (citySnapshotPending) return citySnapshotPending;
  citySnapshotPending = (async () => {
    const [weather, air, notices, population, mayor, alerts] = await Promise.all([fetchWeather(), fetchAir(), fetchNotices(), fetchPopulation(), fetchMayor(), fetchAlerts()]);
    const value = { generatedAt: new Date().toISOString(), weather, air, notices, population, mayor, alerts, map: getMapConfiguration() };
    citySnapshotCache = { value, expiresAt: Date.now() + 2 * 60_000 };
    return value;
  })();
  try { return await citySnapshotPending; } finally { citySnapshotPending = null; }
}
