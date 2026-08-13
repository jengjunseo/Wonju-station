"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- native anchors are intercepted by the persistent shell and retain deep-link semantics. */
/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- delegated click handling only enhances native anchors; their keyboard behavior remains native. */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { CitySnapshot, Freshness } from "../../lib/city";
import { pulseScore } from "../../lib/city";
import { HISTORICAL_PEOPLE, HISTORY_TIMELINE, VERIFIED_EVENTS, WONJU_TMI } from "../../lib/content";
import { CITY_REFRESH_INTERVAL_MS, CITY_SNAPSHOT_STORAGE_KEY, internalStationPath, nextRotatingIndex, parseStoredCitySnapshot, serializeCitySnapshot } from "../../lib/experience";
import "./station.css";

const ChatAssistant = lazy(() => import("./ChatAssistant"));

const DISTRICTS = [
  "문막읍", "소초면", "호저면", "지정면", "부론면", "귀래면", "흥업면", "판부면", "신림면",
  "중앙동", "원인동", "개운동", "명륜1동", "명륜2동", "단구동", "일산동", "학성동", "단계동",
  "우산동", "태장1동", "태장2동", "봉산동", "행구동", "무실동", "반곡관설동",
];

type NavItem = readonly [href: string, label: string, icon: string];
type NavGroup = { label: string; items: readonly NavItem[] };

const NAV_GROUPS: readonly NavGroup[] = [
  { label: "HOME", items: [["/", "지금 원주", "⌂"], ["/news", "뉴스", "◫"], ["/weather", "날씨", "☁"], ["/map", "지도", "◎"]] },
  { label: "LIFE", items: [["/events", "행사", "◇"], ["/discover", "탐방", "✦"], ["/transport", "교통", "↗"]] },
  { label: "CITY", items: [["/city", "도시", "◉"], ["/history", "역사", "⌁"], ["/stats", "통계", "▥"]] },
] as const;

const NAV: readonly NavItem[] = NAV_GROUPS.flatMap((group) => [...group.items]);
const FEATURED_DISTRICTS = ["무실동", "단계동", "반곡관설동", "단구동", "문막읍", "소초면", "지정면", "행구동"];

const VERIFIED_PLACES = [
  { name: "강원감영", district: "일산동", address: "원주시 원일로 77", note: "1395년부터 500년간 강원도의 수부", source: "https://www.wonju.go.kr/tour/contents.do?%5C=&key=5523" },
  { name: "박경리문학공원", district: "단구동", address: "원주시 토지길 1", note: "10:00–17:00 · 월요일 휴관 · 무료", source: "https://www.wonju.go.kr/tour/contents.do?key=6479" },
  { name: "원주시역사박물관", district: "봉산동", address: "원주시 봉산로 134", note: "09:00–18:00 · 월요일 휴관", source: "https://whm.wonju.go.kr/whm/main.php" },
];

const UNAVAILABLE_SNAPSHOT: CitySnapshot = {
  generatedAt: new Date(0).toISOString(),
  weather: {
    provider: "KMA / Open-Meteo fallback", sourceUrl: "https://www.weather.go.kr/", status: "UNAVAILABLE",
    fetchedAt: null, detail: "연결 중", temperature: null, apparentTemperature: null, humidity: null,
    windSpeed: null, weatherCode: null, high: null, low: null, precipitationProbability: null,
    sunrise: null, sunset: null, hourly: [],
  },
  air: {
    provider: "AirKorea / Open-Meteo fallback", sourceUrl: "https://www.airkorea.or.kr/", status: "UNAVAILABLE",
    fetchedAt: null, detail: "연결 중", pm10: null, pm25: null, grade: null,
  },
  alerts: {
    provider: "기상청 기상특보", sourceUrl: "https://www.weather.go.kr/w/warning/report.do", status: "UNAVAILABLE",
    fetchedAt: null, detail: "검증 중", level: null, label: "CHECK", title: null, issuedAt: null,
  },
  notices: {
    provider: "원주시청 새소식", sourceUrl: "https://www.wonju.go.kr/www/sub.do?key=209", status: "UNAVAILABLE",
    fetchedAt: null, detail: "연결 중", items: [], providers: [
      { key: "WONJU_CITY", provider: "원주시청 새소식", sourceUrl: "https://www.wonju.go.kr/www/sub.do?key=209", status: "UNAVAILABLE", fetchedAt: null, detail: "연결 중" },
      { key: "NAVER_NEWS", provider: "Naver 뉴스 검색", sourceUrl: "https://api.ncloud-docs.com/docs/naver-api-hub-search-news", status: "UNAVAILABLE", fetchedAt: null, detail: "연결 상태 확인 전" },
    ], coverage: { geolocated: 0, eligible: 0, percentage: null },
  },
  population: {
    provider: "원주통계정보 월별인구현황", sourceUrl: "https://www.wonju.go.kr/stat/selectBbsNttList.do?bbsNo=1229&key=6313", status: "UNAVAILABLE",
    fetchedAt: null, detail: "연결 중", period: null, population: null, households: null, male: null, female: null, populationChange: null, householdChange: null,
  },
  mayor: { provider: "원주시청", sourceUrl: "https://www.wonju.go.kr/www/main.do", status: "UNAVAILABLE", fetchedAt: null, detail: "연결 중", name: null },
  map: { provider: "OpenStreetMap", kind: "OPENSTREETMAP", sourceUrl: "https://www.openstreetmap.org/", status: "LIVE", fetchedAt: null, detail: "OSM 보조 지도", publicAppKey: null },
};

const PAGE_INFO: Record<string, { eyebrow: string; title: string; summary: string; metrics: Array<[string, string]> }> = {
  city: { eyebrow: "CITY DESK", title: "원주를 숫자로 읽는 곳", summary: "인구와 행정 정보, 도시의 변화를 한 화면에서 둘러보세요. 숫자에는 언제 확인했는지도 함께 적어둡니다.", metrics: [["도시 통계", "공식 자료"], ["인구", "기준일 표시"], ["원주의 변화", "확인된 소식"]] },
  history: { eyebrow: "CITY ARCHIVE", title: "시간 위에 세워진 원주", summary: "원주의 시대와 장소, 사람 이야기를 짧고 편하게 만나보세요. 더 궁금할 땐 공식 자료로 바로 이어집니다.", metrics: [["타임라인", "원주시 연혁"], ["인물", "박물관 자료"], ["장소", "원주관광"]] },
  discover: { eyebrow: "WEEKEND DESK", title: "이번 주말, 원주 어디로 갈까", summary: "공식 페이지에서 주소와 방문 정보를 확인할 수 있는 곳만 골랐어요. 마음 가는 곳을 한 번 뽑아봐도 좋아요.", metrics: [["실내", "문화 공간"], ["산책", "원주 명소"], ["아무거나", "한 곳 뽑기"]] },
  transport: { eyebrow: "MOBILITY", title: "원주 이동 현황", summary: "버스와 도로, 주차 정보를 확인할 수 있는 원주시 공식 창구를 모았어요. 실시간 도착 정보는 제공하지 않습니다.", metrics: [["교통", "공식 센터"], ["주차", "공영주차장"], ["여행", "시티투어"]] },
  stats: { eyebrow: "CITY STATISTICS", title: "숫자로 보는 원주", summary: "인구와 세대수를 기준일과 함께 보여드려요. 서로 다른 달의 숫자는 섞지 않습니다.", metrics: [["인구", "기준일 표시"], ["세대", "월별 현황"], ["변화", "전월 비교"]] },
  population: { eyebrow: "POPULATION", title: "원주는 어떻게 움직이는가", summary: "행정동·연령·기간별 인구 변화 모듈입니다. 주민등록 인구 API가 연결되기 전까지 현재 인구를 추정하지 않습니다.", metrics: [["현재 인구", "UNAVAILABLE"], ["월간 변화", "UNAVAILABLE"], ["비교", "SCHEMA READY"]] },
  projects: { eyebrow: "WONJU NEXT", title: "도시의 다음 장면", summary: "공식 발표와 예산·사업 문서를 근거로 미래 변화를 추적합니다. 계획과 확정을 명확히 구분합니다.", metrics: [["계획", "LABELLED"], ["착공", "EVIDENCE"], ["완료", "VERIFIED"]] },
  air: { eyebrow: "AIR DESK", title: "원주의 공기", summary: "PM10·PM2.5를 제공자 시각과 함께 표시합니다. 관측 실패를 0으로 처리하지 않습니다.", metrics: [["PM10", "LIVE WHEN VALID"], ["PM2.5", "LIVE WHEN VALID"], ["권고", "GRADE-BASED"]] },
  lost: { eyebrow: "LOST IN WONJU", title: "무작위로 만나는 원주", summary: "검증된 장소 데이터가 충분할 때 시작되는 우연 기반 탐색 모드입니다. 아직은 정확한 위치·운영시간을 보장할 수 없어 대기 중입니다.", metrics: [["장소 풀", "NOT CERTIFIED"], ["운영시간", "NOT CERTIFIED"], ["상태", "WAITING"]] },
};

function weatherLabel(code: number | null) {
  if (code === null) return "—";
  if (code === 0) return "맑음";
  if (code <= 3) return "구름 많음";
  if (code <= 48) return "안개";
  if (code <= 67) return "비";
  if (code <= 77) return "눈";
  if (code <= 82) return "소나기";
  return "뇌우 가능";
}

function formatValue(value: number | null, suffix = "") {
  return value === null ? "—" : `${Math.round(value * 10) / 10}${suffix}`;
}

function formatTime(value: string | null, options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", ...options }).format(new Date(value));
}

function FreshnessBadge({ status }: { status: Freshness }) {
  return <span className={`freshness freshness--${status.toLowerCase()}`}>{status}</span>;
}

function ProviderLine({ label, status, time, href }: { label: string; status: Freshness; time: string | null; href: string }) {
  return (
    <div className="provider-line">
      <a href={href} target="_blank" rel="noreferrer">{label} ↗</a>
      <span>{time ? formatTime(time) : "업데이트 없음"}</span>
      <FreshnessBadge status={status} />
    </div>
  );
}

function SectionHead({ index, kicker, title, link }: { index?: string; kicker?: string; title: string; link?: string }) {
  return (
    <div className={`section-head ${index ? "" : "section-head--simple"}`}>
      {index ? <span className="section-index">{index}</span> : null}
      <div>{kicker ? <span className="kicker">{kicker}</span> : null}<h2>{title}</h2></div>
      {link ? <a className="arrow-link" href={link} aria-label={`${title} 더 보기`}>전체 보기 <span>→</span></a> : null}
    </div>
  );
}

function MapPanel({ map, news = [], compact = false }: { map: CitySnapshot["map"]; news?: CitySnapshot["notices"]["items"]; compact?: boolean }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [kakaoFailed, setKakaoFailed] = useState(false);
  useEffect(() => {
    if (map.kind !== "KAKAO_MAPS" || !map.publicAppKey || !canvasRef.current) return;
    setKakaoFailed(false);
    let cancelled = false;
    const timeout = window.setTimeout(() => { if (!cancelled) setKakaoFailed(true); }, 7_000);
    const initialize = () => {
      if (cancelled) return;
      const kakao = (window as unknown as { kakao?: { maps?: { load: (callback: () => void) => void; Map: new (element: HTMLElement, options: unknown) => unknown; LatLng: new (lat: number, lon: number) => unknown; Marker: new (options: unknown) => { setMap: (map: unknown) => void } } } }).kakao;
      if (!kakao?.maps || !canvasRef.current) { setKakaoFailed(true); return; }
      const maps = kakao.maps;
      maps.load(() => {
        window.clearTimeout(timeout);
        if (cancelled) return;
        if (!canvasRef.current) return;
        const mapInstance = new maps.Map(canvasRef.current, { center: new maps.LatLng(37.3422, 127.9202), level: 7 });
        news.filter((item) => item.location).forEach((item) => {
          const marker = new maps.Marker({ position: new maps.LatLng(item.location!.latitude, item.location!.longitude), title: item.title });
          marker.setMap(mapInstance);
        });
      });
    };
    const existing = document.querySelector<HTMLScriptElement>("script[data-wonju-kakao-map]");
    if (existing) {
      existing.addEventListener("load", initialize, { once: true });
      if ((window as unknown as { kakao?: unknown }).kakao) initialize();
      return () => { cancelled = true; window.clearTimeout(timeout); existing.removeEventListener("load", initialize); };
    }
    const script = document.createElement("script");
    script.dataset.wonjuKakaoMap = "true";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(map.publicAppKey)}&autoload=false`;
    script.addEventListener("load", initialize, { once: true });
    const fail = () => { window.clearTimeout(timeout); if (!cancelled) setKakaoFailed(true); };
    script.addEventListener("error", fail, { once: true });
    document.head.appendChild(script);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      script.removeEventListener("load", initialize);
      script.removeEventListener("error", fail);
    };
  }, [map.kind, map.publicAppKey, news]);
  const useKakao = map.kind === "KAKAO_MAPS" && Boolean(map.publicAppKey) && !kakaoFailed;
  return (
    <div className={`map-panel ${compact ? "map-panel--compact" : ""}`}>
      {useKakao ? <div className="kakao-map-canvas" ref={canvasRef} role="img" aria-label="Kakao 원주 지도" /> : <iframe
        title="OpenStreetMap 원주 지도"
        src="https://www.openstreetmap.org/export/embed.html?bbox=127.78%2C37.22%2C128.08%2C37.46&layer=mapnik&marker=37.3422%2C127.9202"
        loading="lazy"
      />}
      <div className="map-hud map-hud--top"><span>원주 지도</span><span>{useKakao ? "KAKAO" : "OSM"} · 날씨 · 대기</span></div>
      <div className="map-hud map-hud--bottom">검증된 위치 정보만 표시합니다 · {useKakao ? "Kakao Maps" : "© OpenStreetMap contributors"}</div>
    </div>
  );
}

let warmCitySnapshot: CitySnapshot | null = null;
let pendingCitySnapshot: Promise<CitySnapshot> | null = null;

function requestCitySnapshot(): Promise<CitySnapshot> {
  if (pendingCitySnapshot) return pendingCitySnapshot;
  pendingCitySnapshot = fetch("/api/city", { headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) throw new Error("city feed unavailable");
      return response.json() as Promise<CitySnapshot>;
    })
    .then((data) => {
      warmCitySnapshot = data;
      try { window.sessionStorage.setItem(CITY_SNAPSHOT_STORAGE_KEY, serializeCitySnapshot(data)); } catch { /* storage may be disabled */ }
      return data;
    })
    .finally(() => { pendingCitySnapshot = null; });
  return pendingCitySnapshot;
}

type StationBoardItem = { label: string; value: string; detail: string; href?: string };

function StationBoard({ items, urgent }: { items: StationBoardItem[]; urgent: StationBoardItem | null }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const visibleItems = urgent ? [urgent] : items;
  const item = visibleItems[index % Math.max(visibleItems.length, 1)];
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setHidden(document.hidden);
    updateMotion();
    updateVisibility();
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => { media.removeEventListener("change", updateMotion); document.removeEventListener("visibilitychange", updateVisibility); };
  }, []);
  useEffect(() => {
    if (urgent || paused || hidden || reducedMotion || visibleItems.length < 2) return;
    const timer = window.setInterval(() => setIndex((value) => nextRotatingIndex(value, visibleItems.length)), 10_000);
    return () => window.clearInterval(timer);
  }, [hidden, paused, reducedMotion, urgent, visibleItems.length]);
  if (!item) return null;
  const body = <><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></>;
  return (
    <section className={`station-board ${urgent ? "station-board--urgent" : ""}`} aria-label="지금 원주 안내판" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
      <div className="station-board-copy" aria-live="off">{item.href ? <a href={item.href}>{body}</a> : body}</div>
      {!urgent && visibleItems.length > 1 ? <div className="station-board-controls"><button type="button" onClick={() => setIndex((value) => nextRotatingIndex(value, visibleItems.length, -1))} aria-label="이전 원주 정보">←</button><span>{index % visibleItems.length + 1} / {visibleItems.length}</span><button type="button" onClick={() => setIndex((value) => nextRotatingIndex(value, visibleItems.length))} aria-label="다음 원주 정보">→</button></div> : null}
    </section>
  );
}

export function StationApp({ route }: { route: string }) {
  const [snapshot, setSnapshot] = useState<CitySnapshot>(() => {
    if (warmCitySnapshot) return warmCitySnapshot;
    if (typeof window === "undefined") return UNAVAILABLE_SNAPSHOT;
    try {
      const stored = parseStoredCitySnapshot(window.sessionStorage.getItem(CITY_SNAPSHOT_STORAGE_KEY));
      if (stored) warmCitySnapshot = stored;
      return stored ?? UNAVAILABLE_SNAPSHOT;
    } catch {
      return UNAVAILABLE_SNAPSHOT;
    }
  });
  const [hydrating, setHydrating] = useState(snapshot === UNAVAILABLE_SNAPSHOT);
  const [currentRoute, setCurrentRoute] = useState(route);
  const [now, setNow] = useState<Date | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [tmiIndex, setTmiIndex] = useState(0);
  const [randomPlaceIndex, setRandomPlaceIndex] = useState<number | null>(null);
  const [populationView, setPopulationView] = useState<"population" | "households" | "change" | "split">("population");

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const controlledAlert = process.env.NODE_ENV === "development" ? new URLSearchParams(window.location.search).get("testAlert") : null;
    const withControlledAlert = (data: CitySnapshot): CitySnapshot => {
      if (controlledAlert !== "warning" && controlledAlert !== "emergency" && controlledAlert !== "normal") return data;
      const fixture = controlledAlert === "emergency" ? { level: 4 as const, label: "EMERGENCY" as const, title: "통제된 비상 UI 시험" } : controlledAlert === "warning" ? { level: 3 as const, label: "WARNING" as const, title: "통제된 경고 UI 시험" } : { level: 0 as const, label: "NORMAL" as const, title: null };
      return { ...data, alerts: { ...data.alerts, ...fixture, provider: "CONTROLLED TEST FIXTURE", status: "FRESH", fetchedAt: new Date().toISOString(), detail: "개발 환경에서만 활성화되는 시각 검증 상태" } };
    };
    const refresh = () => requestCitySnapshot()
      .then((data) => { if (active) setSnapshot(withControlledAlert(data)); })
      .catch(() => { /* keep the most recent verified snapshot */ })
      .finally(() => { if (active) setHydrating(false); });
    void refresh();
    const interval = window.setInterval(refresh, CITY_REFRESH_INTERVAL_MS);
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { active = false; window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  useEffect(() => {
    const onPopState = () => setCurrentRoute(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const routePath = currentRoute.split(/[?#]/)[0];
  const routeKey = routePath.split("/").filter(Boolean)[0] ?? "now";
  const selectedDistrict = decodeURIComponent(routePath.split("/").filter(Boolean)[1] ?? "무실동");
  const pulse = pulseScore({
    activeNotices: snapshot.notices.items.length,
    precipitationProbability: snapshot.weather.precipitationProbability,
    pm25: snapshot.air.pm25,
  });
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    if (!normalized) return [];
    return [
      ...DISTRICTS.map((name) => ({ title: name, meta: "읍면동", href: `/place/${encodeURIComponent(name)}` })),
      ...snapshot.notices.items.map((item) => ({ title: item.title, meta: item.department, href: item.canonicalUrl })),
      ...NAV.map(([href, title]) => ({ title, meta: "WONJU STATION", href })),
    ].filter((item) => `${item.title} ${item.meta}`.toLocaleLowerCase("ko-KR").includes(normalized)).slice(0, 8);
  }, [query, snapshot.notices.items]);

  function handleInternalNavigation(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    const path = internalStationPath(anchor.href, window.location.origin);
    if (!path) return;
    event.preventDefault();
    if (path !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.pushState({}, "", path);
    setCurrentRoute(path);
    setMenuOpen(false);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  const currentTmi = WONJU_TMI[tmiIndex % WONJU_TMI.length];
  const boardItems = useMemo<StationBoardItem[]>(() => [
    ...(snapshot.weather.temperature === null ? [] : [{ label: "지금 원주", value: `${formatValue(snapshot.weather.temperature, "°")} · ${weatherLabel(snapshot.weather.weatherCode)}`, detail: `체감 ${formatValue(snapshot.weather.apparentTemperature, "°")}`, href: "/weather" }]),
    ...(snapshot.air.grade === null ? [] : [{ label: "오늘의 공기", value: snapshot.air.grade, detail: `PM2.5 ${formatValue(snapshot.air.pm25)}㎍/㎥`, href: "/air" }]),
    ...(snapshot.notices.items.length ? [{ label: "새로 올라온 소식", value: `${snapshot.notices.items.length}건`, detail: snapshot.notices.items[0]?.title ?? "원주 소식", href: "/news" }] : []),
    { label: "이번 주 행사", value: `${VERIFIED_EVENTS.length}건`, detail: "공식 링크로 확인한 일정", href: "/events" },
    ...(snapshot.population.population === null ? [] : [{ label: "원주 인구", value: `${snapshot.population.population.toLocaleString("ko-KR")}명`, detail: snapshot.population.period ?? "최근 확인값", href: "/stats" }]),
    { label: "원주 TMI", value: "알고 보면 더 재밌는 원주", detail: currentTmi.text, href: currentTmi.relatedRoute ?? "/history" },
  ], [currentTmi, snapshot]);
  const urgentBoardItem = snapshot.alerts.level !== null && snapshot.alerts.level >= 3
    ? { label: `원주 ${snapshot.alerts.label}`, value: snapshot.alerts.title ?? "기상특보", detail: "다른 정보보다 먼저 확인해 주세요", href: snapshot.alerts.sourceUrl }
    : null;

  function renderHome() {
    return (
      <>
        <section className="home-welcome">
          <div>
            <span className="home-eyebrow">오늘의 원주</span>
            <h1>오늘도 원주답게<br />시작해요.</h1>
            <p>{now ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(now) : "원주의 오늘을 불러오고 있어요"}</p>
          </div>
          <div className="compact-clock" aria-live="polite">
            <strong>{now ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(now) : "--:--"}</strong>
            <span>KST</span>
          </div>
        </section>

        <StationBoard items={boardItems} urgent={urgentBoardItem} />

        <section className="home-metrics" aria-label="오늘의 원주 요약">
          <article className="weather-summary">
            <div className="metric-label"><span>날씨</span><FreshnessBadge status={snapshot.weather.status} /></div>
            <div className="weather-now"><strong>{formatValue(snapshot.weather.temperature, "°")}</strong><div><b>{weatherLabel(snapshot.weather.weatherCode)}</b><span>체감 {formatValue(snapshot.weather.apparentTemperature, "°")}</span></div></div>
            <p>{snapshot.weather.status === "UNAVAILABLE" ? "현재 날씨를 확인할 수 없어요." : `최고 ${formatValue(snapshot.weather.high, "°")} · 최저 ${formatValue(snapshot.weather.low, "°")} · 강수 ${formatValue(snapshot.weather.precipitationProbability, "%")}`}</p>
          </article>
          <article className={`metric-card metric-card--${snapshot.alerts.label.toLowerCase()}`}>
            <div className="metric-label"><span>원주 상태</span><i className="metric-dot" /></div>
            <strong>{snapshot.alerts.label}</strong>
            <p>{snapshot.alerts.label === "CHECK" ? "특보 직접 확인" : "공식 특보 기준"}</p>
            <a href={snapshot.alerts.sourceUrl} target="_blank" rel="noreferrer">기상청 열기 →</a>
          </article>
          <article className="metric-card">
            <div className="metric-label"><span>오늘의 공기</span><small>PM2.5</small></div>
            <strong>{snapshot.air.grade ?? "—"}</strong>
            <p>{snapshot.air.pm25 === null ? (hydrating ? "첫 정보를 확인하고 있어요" : "현재 측정값이 없어요") : `${formatValue(snapshot.air.pm25)}㎍/㎥`}</p>
            <a href="/air">자세히 보기 →</a>
          </article>
          <article className="metric-card metric-card--news">
            <div className="metric-label"><span>새로운 소식</span><small>공식</small></div>
            <strong>{snapshot.notices.items.length || "—"}<em>건</em></strong>
            <p>공식·지역 뉴스 통합</p>
            <a href="/news">모두 보기 →</a>
          </article>
          <article className="metric-card">
            <div className="metric-label"><span>이번 주 행사</span><small>검증됨</small></div>
            <strong>{VERIFIED_EVENTS.length}<em>건</em></strong>
            <p>공식 출처 확인 일정</p>
            <a href="/events">일정 보기 →</a>
          </article>
        </section>

        <section className="home-primary-grid">
          <div className="home-panel local-feed">
            <SectionHead kicker="NOW IN WONJU" title="지금 원주에서" link="/news" />
            <div className="news-list">
              {snapshot.notices.items.length ? snapshot.notices.items.slice(0, 5).map((item) => (
                <a className="news-row" href={item.canonicalUrl} target="_blank" rel="noreferrer" key={item.id}>
                  <div><strong>{item.title}</strong><small>{item.sources?.map((source) => source.label).join(" + ") ?? item.department} · {item.publishedAt}</small></div>
                  <span>↗</span>
                </a>
              )) : <Unavailable title="검증된 새소식을 불러오지 못했습니다" detail="원주시청 공식 목록은 그대로 연결해 두었습니다." href={snapshot.notices.sourceUrl} />}
            </div>
          </div>
          <div className="home-panel week-panel">
            <SectionHead kicker="THIS WEEK" title="이번 주 원주" link="/events" />
            <div className="weekly-cards">
              {VERIFIED_EVENTS.map((event, index) => <a className="weekly-card" href={event.source} target="_blank" rel="noreferrer" key={event.title}>
                <div className={`weekly-card-visual weekly-card-visual--${index}`}><span>{index === 0 ? "공연" : "전시"}</span><b>{event.date}</b></div>
                <div><small>{event.place}</small><h3>{event.title}</h3><p>{event.time}</p></div>
              </a>)}
            </div>
          </div>
        </section>

        <section className="neighborhood-panel">
          <SectionHead kicker="MY NEIGHBORHOOD" title="우리 동네" link="/weather" />
          <p>원주 25개 읍면동에서 내 동네를 바로 찾아보세요.</p>
          <div className="district-shortcuts">{FEATURED_DISTRICTS.map((district) => <a href={`/place/${encodeURIComponent(district)}`} key={district}>{district}<span>→</span></a>)}</div>
        </section>

        <section className="tmi-card" aria-label="원주 TMI">
          <div><span className="kicker">WONJU TMI · {currentTmi.topic.toUpperCase()}</span><h2>원주 TMI</h2><p>{currentTmi.text}</p><a href={currentTmi.sourceUrl} target="_blank" rel="noreferrer">{currentTmi.sourceLabel} ↗</a></div>
          <button type="button" onClick={() => setTmiIndex((value) => nextRotatingIndex(value, WONJU_TMI.length))}>다른 이야기 →</button>
        </section>

        <section className="home-lower-grid">
          <div className="home-panel map-card"><SectionHead kicker="AROUND WONJU" title="원주 지도" link="/map" /><MapPanel map={snapshot.map} compact /></div>
          <div className="home-side-stack">
            <article className="soft-card changelog-card">
              <SectionHead kicker="WONJU CHANGELOG" title="오늘 달라진 원주" link="/projects" />
              <p>확인된 사업·개통·정책 변화만 시점과 출처를 함께 기록해요.</p>
              <div className="change-lines"><span>+</span><b>새로운 모집 공고</b><small>공식 새소식에서 확인</small></div>
            </article>
            <article className="soft-card pulse-card">
              <div><span className="kicker">WONJU PULSE · EXPERIMENTAL</span><h2>원주 활력</h2></div>
              <strong className="pulse-score">{pulse ?? "—"}<small>/ 100</small></strong>
              <div className="pulse-bar"><span style={{ width: `${pulse ?? 0}%` }} /></div>
              <p>날씨·공기·공식 업데이트를 조합한 비공식 실험 지표예요.</p>
              <details><summary>무엇이 반영됐나요?</summary><p>최근 공식 소식 수, 비 올 확률, PM2.5 값을 같은 규칙으로 조합했어요. 도시의 좋고 나쁨을 평가하는 점수는 아니에요.</p></details>
            </article>
          </div>
        </section>

        <details className="provider-board">
          <summary>데이터 출처와 업데이트 상태 <span>자세히 보기</span></summary>
          <div className="provider-list">
            <ProviderLine label={snapshot.weather.provider} status={snapshot.weather.status} time={snapshot.weather.fetchedAt} href={snapshot.weather.sourceUrl} />
            <ProviderLine label={snapshot.air.provider} status={snapshot.air.status} time={snapshot.air.fetchedAt} href={snapshot.air.sourceUrl} />
            <ProviderLine label={snapshot.notices.provider} status={snapshot.notices.status} time={snapshot.notices.fetchedAt} href={snapshot.notices.sourceUrl} />
            <ProviderLine label={snapshot.alerts.provider} status={snapshot.alerts.status} time={snapshot.alerts.fetchedAt} href={snapshot.alerts.sourceUrl} />
            <ProviderLine label={snapshot.population.provider} status={snapshot.population.status} time={snapshot.population.fetchedAt} href={snapshot.population.sourceUrl} />
            <ProviderLine label={`${snapshot.mayor.provider} · 시장 표기`} status={snapshot.mayor.status} time={snapshot.mayor.fetchedAt} href={snapshot.mayor.sourceUrl} />
          </div>
        </details>
      </>
    );
  }

  function renderWeather() {
    return (
      <PageShell eyebrow="WONJU WEATHER" title="지금 원주의 하늘" intro="오늘 기온과 비 올 확률, 습도와 바람을 한눈에 보세요. 동네별 예보가 없는 곳에는 원주 전체 값을 억지로 복사하지 않아요.">
        <div className="weather-dashboard">
          <article className="weather-primary"><span>NOW · WONJU</span><strong>{formatValue(snapshot.weather.temperature, "°")}</strong><h2>{weatherLabel(snapshot.weather.weatherCode)}</h2><p>체감 {formatValue(snapshot.weather.apparentTemperature, "°")} · 습도 {formatValue(snapshot.weather.humidity, "%")} · 바람 {formatValue(snapshot.weather.windSpeed, " km/h")}</p></article>
          <article className="sun-card"><span>SUN CYCLE</span><div><b>{formatTime(snapshot.weather.sunrise)}</b><small>일출</small></div><div><b>{formatTime(snapshot.weather.sunset)}</b><small>일몰</small></div></article>
          <div className="hourly-chart">
            {snapshot.weather.hourly.length ? snapshot.weather.hourly.map((hour) => (
              <div key={hour.time}><span>{formatTime(hour.time)}</span><i style={{ height: `${Math.max(20, hour.precipitationProbability)}%` }} /><strong>{formatValue(hour.temperature, "°")}</strong><small>{hour.precipitationProbability}%</small></div>
            )) : <Unavailable title="시간별 예보를 볼 수 없어요" detail="현재 확인된 오늘 날씨는 위에서 볼 수 있어요." />}
          </div>
        </div>
        <SectionHead index="W" kicker="DISTRICT MATRIX" title="25개 읍면동" />
        <div className="district-grid">{DISTRICTS.map((district) => <a href={`/place/${encodeURIComponent(district)}`} key={district}><strong>{district}</strong><span>공식 격자 미연결</span><FreshnessBadge status="UNAVAILABLE" /></a>)}</div>
      </PageShell>
    );
  }

  function renderNews() {
    return (
      <PageShell eyebrow="WONJU NEWS" title="원주에서 새로 올라온 소식" intro="원주시 새소식과 지역 뉴스를 함께 모았어요. 같은 내용은 한곳에 묶고, 자세한 내용은 원문에서 확인할 수 있어요.">
        <div className="filter-rail"><button className="active">전체</button><button>행정</button><button>생활</button><button>문화</button><button>교통</button><span>{snapshot.notices.items.length} CLUSTERS · MAP {snapshot.notices.coverage.geolocated}/{snapshot.notices.coverage.eligible}</span></div>
        <div className="news-provider-strip">{snapshot.notices.providers.map((provider) => <div key={provider.key}><FreshnessBadge status={provider.status} /><strong>{provider.provider}</strong><span>{provider.detail}</span></div>)}</div>
        <div className="news-board">
          {snapshot.notices.items.length ? snapshot.notices.items.map((item, index) => (
            <article key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{item.sources?.map((source) => source.label).join(" + ") ?? item.department}{item.location ? ` · ${item.location.label}${item.location.approximate ? " (근사)" : ""}` : ""}</small><h2>{item.title}</h2><p>{item.summary ?? "원문에서 세부 내용과 첨부자료를 확인하세요."}</p><div className="news-source-links">{(item.sources ?? [{ label: item.department, url: item.canonicalUrl, provider: item.provider ?? "WONJU_CITY" }]).map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.label} ↗</a>)}</div></div><time>{item.publishedAt}</time></article>
          )) : <Unavailable title="새소식을 가져오지 못했어요" detail="원주시 공식 새소식은 바로 열어볼 수 있어요." href={snapshot.notices.sourceUrl} />}
        </div>
      </PageShell>
    );
  }

  function renderMap() {
    return (
      <PageShell eyebrow="WONJU LIVE MAP" title="지도에서 만나는 원주" intro="동네 이름이 분명한 소식만 지도에 표시해요. 위치가 불확실한 소식은 뉴스에는 남겨두되 지도에 억지로 찍지 않습니다.">
        <div className="map-tools"><button className="active">BASE</button><button>NEWS · {snapshot.notices.coverage.geolocated}</button><button>EVENTS · 0</button><button>AIR · 1</button><button>WEATHER · 1</button><span>NEWS COVERAGE: {snapshot.notices.coverage.percentage ?? "—"}%</span></div>
        <MapPanel map={snapshot.map} news={snapshot.notices.items} />
        <div className="map-legend"><div><i className="legend-dot legend-dot--lime" /><b>대기 관측</b><span>원주 중심 또는 공식 측정소</span></div><div><i className="legend-dot legend-dot--blue" /><b>날씨</b><span>도시 대표 격자</span></div><div><i className="legend-dot" /><b>뉴스</b><span>{snapshot.notices.coverage.geolocated ? "기사에 명시된 읍면동의 근사 위치" : "검증 가능한 위치 없음"}</span></div></div>
        {snapshot.notices.coverage.geolocated ? <div className="news-map-locations" aria-label="지도에 표시된 뉴스 위치">{snapshot.notices.items.filter((item) => item.location).map((item) => <a href={item.canonicalUrl} target="_blank" rel="noreferrer" key={item.id}><span>{item.location!.confidence}</span><strong>{item.location!.label}</strong><small>{item.title}</small></a>)}</div> : null}
      </PageShell>
    );
  }

  function renderEvents() {
    const eventDays = Array.from({ length: 7 }, (_, index) => {
      if (!now) return { date: "--", label: index === 0 ? "오늘" : "--" };
      const date = new Date(now.getTime() + index * 86_400_000);
      return {
        date: new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", day: "numeric" }).format(date),
        label: index === 0
          ? "오늘"
          : new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" }).format(date),
      };
    });

    return (
      <PageShell eyebrow="EVENTS & CALENDAR" title="오늘 원주에서 뭐 하지?" intro="날짜와 장소, 공식 안내를 확인할 수 있는 행사만 모았어요. 방문 전 원문에서 변동 사항을 한 번 더 확인해 주세요.">
        <div className="date-strip">{eventDays.map((day, index) => <div className={index === 0 ? "active" : ""} key={`${index}-${day.date}-${day.label}`}><strong>{day.date}</strong><span>{day.label}</span></div>)}</div>
        <div className="event-list">{VERIFIED_EVENTS.map((event, index) => <a href={event.source} target="_blank" rel="noreferrer" key={event.title}><span>{String(index + 1).padStart(2, "0")}</span><time>{event.date}<small>{event.time}</small></time><div><small>{event.place}</small><h2>{event.title}</h2></div><b>VERIFIED ↗</b></a>)}</div>
        <div className="link-cards"><a href="https://www.wonju.go.kr/www/sub.do?key=213" target="_blank" rel="noreferrer"><span>01</span><strong>원주시 문화행사</strong><small>공식 일정 열기 ↗</small></a><a href="https://www.wonju.go.kr/tour/index.do" target="_blank" rel="noreferrer"><span>02</span><strong>원주관광</strong><small>공식 관광 정보 ↗</small></a></div>
      </PageShell>
    );
  }

  function renderDistrict() {
    const valid = DISTRICTS.includes(selectedDistrict);
    return (
      <PageShell eyebrow="NEIGHBORHOOD DESK" title={valid ? selectedDistrict : "동네를 찾을 수 없습니다"} intro="우리 동네 이름이 분명하게 담긴 소식과 정보를 모아요. 원주 전체 값을 동네의 값인 것처럼 보여주지는 않습니다.">
        <div className="district-hero"><div><span>WEATHER</span><strong>—</strong><small>도시값을 동네값으로 복제하지 않음</small></div><div><span>NEWS MAP</span><strong>{snapshot.notices.items.filter((item) => item.location?.district === selectedDistrict).length}</strong><small>명시 위치 기사</small></div><div><span>EVENTS</span><strong>0</strong><small>검증 일정</small></div><div><span>STATUS</span><strong>{snapshot.alerts.label}</strong><small>기상청 특보 기준</small></div></div>
        <div className="district-switcher">{DISTRICTS.map((district) => <a className={district === selectedDistrict ? "active" : ""} href={`/place/${encodeURIComponent(district)}`} key={district}>{district}</a>)}</div>
      </PageShell>
    );
  }

  function renderGeneric() {
    if (routeKey === "air") {
      return <PageShell eyebrow="AIR DESK" title="원주의 공기" intro="실패를 0㎍/㎥로 바꾸지 않는 대기질 화면입니다."><div className="air-hero"><div><span>AIR GRADE</span><strong>{snapshot.air.grade ?? "—"}</strong></div><div><span>PM10</span><strong>{formatValue(snapshot.air.pm10)}</strong><small>㎍/㎥</small></div><div><span>PM2.5</span><strong>{formatValue(snapshot.air.pm25)}</strong><small>㎍/㎥</small></div></div><ProviderLine label={snapshot.air.provider} status={snapshot.air.status} time={snapshot.air.fetchedAt} href={snapshot.air.sourceUrl} /></PageShell>;
    }
    if (routeKey === "city" || routeKey === "mayor") {
      return <PageShell eyebrow="CITY DESK" title="원주를 숫자와 책임으로 읽다" intro="현재 행정 정보는 원주시 공식 페이지에서 매번 확인해 표시합니다. 시장 이름이나 인구를 소스 코드에 고정하지 않습니다."><div className="city-facts"><article><span>CURRENT MAYOR</span><strong>{snapshot.mayor.name ?? "—"}</strong><small>원주시청 공식 표기</small><FreshnessBadge status={snapshot.mayor.status} /></article><article><span>REGISTERED POPULATION</span><strong>{snapshot.population.population?.toLocaleString("ko-KR") ?? "—"}</strong><small>{snapshot.population.period ?? "기준일 없음"} · 외국인 제외</small><FreshnessBadge status={snapshot.population.status} /></article><article><span>HOUSEHOLDS</span><strong>{snapshot.population.households?.toLocaleString("ko-KR") ?? "—"}</strong><small>전월 대비 {snapshot.population.householdChange === null ? "—" : `${snapshot.population.householdChange > 0 ? "+" : ""}${snapshot.population.householdChange.toLocaleString("ko-KR")}`}</small></article></div><div className="official-links"><a href={snapshot.mayor.sourceUrl} target="_blank" rel="noreferrer">원주시청 ↗</a><a href={snapshot.population.sourceUrl} target="_blank" rel="noreferrer">월별 인구현황 ↗</a><a href="https://www.wonju.go.kr/stat/index.do" target="_blank" rel="noreferrer">원주통계정보 ↗</a></div></PageShell>;
    }
    if (routeKey === "population" || routeKey === "stats") {
      const population = snapshot.population.population;
      const maleShare = population && snapshot.population.male ? snapshot.population.male / population * 100 : 0;
      const femaleShare = population && snapshot.population.female ? snapshot.population.female / population * 100 : 0;
      const views = {
        population: { value: population?.toLocaleString("ko-KR") ?? "—", suffix: "명 · 외국인 제외", detail: `전월 대비 ${snapshot.population.populationChange === null ? "—" : `${snapshot.population.populationChange > 0 ? "+" : ""}${snapshot.population.populationChange.toLocaleString("ko-KR")}명`}` },
        households: { value: snapshot.population.households?.toLocaleString("ko-KR") ?? "—", suffix: "세대", detail: `전월 대비 ${snapshot.population.householdChange === null ? "—" : `${snapshot.population.householdChange > 0 ? "+" : ""}${snapshot.population.householdChange.toLocaleString("ko-KR")}세대`}` },
        change: { value: snapshot.population.populationChange === null ? "—" : `${snapshot.population.populationChange > 0 ? "+" : ""}${snapshot.population.populationChange.toLocaleString("ko-KR")}`, suffix: "명 · 전월 대비", detail: snapshot.population.period ?? "최근 월별 현황" },
        split: { value: maleShare ? `${maleShare.toFixed(1)} / ${femaleShare.toFixed(1)}` : "—", suffix: "% · 남 / 여", detail: "주민등록 인구 기준" },
      } as const;
      const view = views[populationView];
      return <PageShell eyebrow={routeKey === "population" ? "POPULATION" : "CITY STATISTICS"} title="숫자로 보는 원주" intro="원주통계정보의 최근 월별 현황을 기준일과 함께 보여드려요. 궁금한 항목을 눌러 바꿔볼 수 있어요."><div className="population-tabs" role="group" aria-label="인구 통계 항목">{([['population','인구'],['households','세대'],['change','월 변화'],['split','남녀 비율']] as const).map(([key,label]) => <button type="button" className={populationView === key ? "active" : ""} onClick={() => setPopulationView(key)} key={key}>{label}</button>)}</div><div className="population-hero"><span>{snapshot.population.period ?? "최근 확인값"}</span><strong>{view.value}<small>{view.suffix}</small></strong><p>{view.detail}</p></div><div className="population-bars"><div><span>남성 {snapshot.population.male?.toLocaleString("ko-KR") ?? "—"}</span><i><b style={{ width: `${maleShare}%` }} /></i><strong>{maleShare ? `${maleShare.toFixed(1)}%` : "—"}</strong></div><div><span>여성 {snapshot.population.female?.toLocaleString("ko-KR") ?? "—"}</span><i><b style={{ width: `${femaleShare}%` }} /></i><strong>{femaleShare ? `${femaleShare.toFixed(1)}%` : "—"}</strong></div></div><ProviderLine label={snapshot.population.provider} status={snapshot.population.status} time={snapshot.population.fetchedAt} href={snapshot.population.sourceUrl} /></PageShell>;
    }
    if (routeKey === "history" || routeKey === "timeline" || routeKey === "people") {
      return <PageShell eyebrow="CITY ARCHIVE" title="시간 위에 세워진 원주" intro="원주시 연혁과 원주시역사박물관의 공식 설명을 짧게 재구성했습니다. 해석을 덧붙이기보다 출처로 돌아갈 수 있게 합니다."><div className="timeline">{HISTORY_TIMELINE.map((item) => <article key={item.year}><strong>{item.year}</strong><div><h2>{item.title}</h2><p>{item.text}</p></div></article>)}</div><a className="source-block" href="https://www.wonju.go.kr/www/contents.do?key=231" target="_blank" rel="noreferrer"><span>PRIMARY SOURCE</span><strong>원주시 공식 연혁 전체 보기 ↗</strong></a><SectionHead index="P" kicker="PEOPLE OF WONJU" title="도시를 만든 사람들" /><div className="people-grid">{HISTORICAL_PEOPLE.map((person) => <a href={person.source} target="_blank" rel="noreferrer" key={person.name}><span>{person.label}</span><h2>{person.name}</h2><p>{person.text}</p><b>공식 자료 ↗</b></a>)}</div></PageShell>;
    }
    if (routeKey === "transport") {
      return <PageShell eyebrow="MOBILITY" title="원주 이동의 공식 출발점" intro="실시간 도착 시간을 추정하지 않습니다. 원주시 교통정보센터와 원주관광의 공식 운행 정보로 바로 연결합니다."><div className="transport-grid"><a href="https://its.wonju.go.kr/" target="_blank" rel="noreferrer"><span>01 · LIVE TRAFFIC</span><h2>원주시 교통정보센터</h2><p>도로 소통, 버스 정보와 주차장 현황</p><b>OPEN ↗</b></a><a href="https://its.wonju.go.kr/parking/comm.do" target="_blank" rel="noreferrer"><span>02 · PARKING</span><h2>공영주차장</h2><p>주소와 주차면을 확인하는 공식 목록</p><b>OPEN ↗</b></a><a href="https://www.wonju.go.kr/tour/contents.do?key=6509" target="_blank" rel="noreferrer"><span>03 · CITY TOUR</span><h2>순환형 시티투어</h2><p>운행일, 요금과 정류장 시간표</p><b>OPEN ↗</b></a></div></PageShell>;
    }
    if (routeKey === "discover" || routeKey === "lost") {
      const randomPlace = randomPlaceIndex === null ? null : VERIFIED_PLACES[randomPlaceIndex];
      return <PageShell eyebrow={routeKey === "lost" ? "LOST IN WONJU" : "WEEKEND DESK"} title="이번 주말, 원주 어디로 갈까" intro="주소와 방문 정보를 공식 페이지에서 확인할 수 있는 곳만 골랐어요. 결정을 못 하겠다면 한 곳을 가볍게 뽑아보세요."><div className="random-wonju"><div><span className="kicker">RANDOM WONJU</span><h2>{randomPlace ? randomPlace.name : "오늘은 어디로 가볼까요?"}</h2><p>{randomPlace ? `${randomPlace.address} · ${randomPlace.note}` : "버튼을 누를 때만 검증된 장소 중 한 곳을 골라드려요."}</p>{randomPlace ? <a href={randomPlace.source} target="_blank" rel="noreferrer">공식 정보 열기 ↗</a> : null}</div><button type="button" onClick={() => setRandomPlaceIndex((value) => nextRotatingIndex(value ?? -1, VERIFIED_PLACES.length))}>원주 한 곳 뽑기</button></div><div className="place-grid">{VERIFIED_PLACES.map((place, index) => <a href={place.source} target="_blank" rel="noreferrer" key={place.name}><span>{String(index + 1).padStart(2, "0")} · {place.district}</span><h2>{place.name}</h2><p>{place.note}</p><small>{place.address}</small><b>공식 정보 ↗</b></a>)}</div><aside className="related-tmi"><span>이 근처 이야기</span><p>{WONJU_TMI.find((item) => item.topic === "place")?.text}</p></aside></PageShell>;
    }
    if (routeKey === "projects") {
      return <PageShell eyebrow="WONJU NEXT" title="도시의 다음 장면" intro="계획과 완료를 구분해 공식 발표만 기록합니다. 현재는 검증 가능한 대표 사업 하나를 시작점으로 제공합니다."><div className="project-feature"><span>PLAN · 2026</span><h2>공영주차장 1,042면 조성 추진</h2><p>원주시는 2026년 구도심과 주거 밀집 지역을 중심으로 공영주차장 조성을 계속 추진한다고 발표했습니다. ‘계획’ 상태이며 완료로 표시하지 않습니다.</p><a href="https://www.wonju.go.kr/media/selectBbsNttView.do?bbsNo=145&key=3450&nttNo=475645" target="_blank" rel="noreferrer">원주시 공식 보도자료 ↗</a></div></PageShell>;
    }
    const info = PAGE_INFO[routeKey] ?? PAGE_INFO.city;
    return <PageShell eyebrow={info.eyebrow} title={info.title} intro={info.summary}><div className="metric-panels">{info.metrics.map(([label, value], index) => <article key={label}><span>{String(index + 1).padStart(2, "0")}</span><h2>{label}</h2><strong>{value}</strong></article>)}</div><div className="system-note"><span>DATA INTEGRITY</span><h2>빈 상태도 도시의 상태입니다.</h2><p>공식 제공자가 연결되지 않은 현재값은 추정하지 않습니다. 이 화면의 구조와 실패 경계는 준비되어 있으며, 검증 가능한 소스가 들어오는 순간 같은 인터페이스에서 표시됩니다.</p></div></PageShell>;
  }

  const content = routeKey === "now" ? renderHome() : routeKey === "weather" ? renderWeather() : routeKey === "news" ? renderNews() : routeKey === "map" ? renderMap() : routeKey === "events" ? renderEvents() : routeKey === "place" ? renderDistrict() : renderGeneric();
  const routeTitle = ({ now: "오늘의 원주", news: "원주 뉴스", weather: "원주 날씨", map: "원주 지도", events: "원주 행사", city: "도시 정보", history: "원주 이야기", discover: "원주 탐방", transport: "원주 교통", stats: "원주 통계", population: "원주 인구", air: "원주 대기질", projects: "오늘 달라진 원주", place: selectedDistrict } as Record<string, string>)[routeKey] ?? "WONJU STATION";

  return (
    <div className="station-shell" onClick={handleInternalNavigation}>
      <aside id="station-sidebar" className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
        <a className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span><strong>WONJU<br />STATION</strong><small>원주 시민의 생활 홈</small></span></a>
        <div className="sidebar-today">
          <span>오늘의 원주</span>
          <strong>{formatValue(snapshot.weather.temperature, "°")} <small>{weatherLabel(snapshot.weather.weatherCode)}</small></strong>
          <p>{snapshot.weather.status === "UNAVAILABLE" ? "오늘 날씨는 잠시 비워둘게요" : `최고 ${formatValue(snapshot.weather.high, "°")} · 최저 ${formatValue(snapshot.weather.low, "°")}`}</p>
        </div>
        <nav className="side-nav" aria-label="주요 메뉴">
          {NAV_GROUPS.map((group) => <div className="nav-group" key={group.label}><span>{group.label}</span>{group.items.map(([href, label, icon]) => <a className={(href === "/" ? routeKey === "now" : routePath.startsWith(href)) ? "active" : ""} href={href} key={href}><i aria-hidden="true">{icon}</i>{label}</a>)}</div>)}
        </nav>
        <div className="sidebar-neighborhood"><span>원주 25개 읍면동</span><strong>우리 동네 찾기</strong><a href="/weather">동네 전체 보기 →</a></div>
        <div className={`sidebar-status network-state--${snapshot.weather.status.toLowerCase()}`}><span className="live-dot" /><div><strong>{snapshot.weather.status === "UNAVAILABLE" ? "원주 생활 정보" : "원주 정보 연결됨"}</strong><small>{snapshot.weather.status === "UNAVAILABLE" ? "확인되는 값부터 보여드려요" : "출처와 업데이트 시간 공개"}</small></div></div>
      </aside>

      <div className="app-column">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"} aria-controls="station-sidebar" aria-expanded={menuOpen}>☰</button>
          <div className="page-heading"><strong>{routeTitle}</strong><span>{now ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "long" }).format(now) : "원주의 오늘"}</span></div>
          <div className="header-actions"><button onClick={() => setQuery(query ? "" : "원주")} aria-label="검색 열기">⌕</button><button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="색상 모드 전환">{theme === "dark" ? "☀" : "☾"}</button></div>
        </header>

        <div className={`search-drawer ${query ? "search-drawer--open" : ""}`}>
          <label htmlFor="station-search">통합 검색</label>
          <input id="station-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="동네, 뉴스, 메뉴를 검색해보세요" autoComplete="off" />
          <button onClick={() => setQuery("")} aria-label="검색 닫기">×</button>
          {query ? <div className="search-results">{searchResults.length ? searchResults.map((item) => item.href.startsWith("/") ? <a href={item.href} key={`${item.href}-${item.title}`}><span>{item.meta}</span><strong>{item.title}</strong></a> : <a href={item.href} target="_blank" rel="noreferrer" key={`${item.href}-${item.title}`}><span>{item.meta}</span><strong>{item.title}</strong></a>) : <p>일치하는 결과가 없습니다.</p>}</div> : null}
        </div>

        <main>
          {snapshot.alerts.level !== null && snapshot.alerts.level >= 3 ? <section className={`alert-banner alert-banner--${snapshot.alerts.label.toLowerCase()}`} role="alert"><span>원주 {snapshot.alerts.label}</span><div><strong>{snapshot.alerts.title}</strong><p>{snapshot.alerts.detail}</p></div><a href={snapshot.alerts.sourceUrl} target="_blank" rel="noreferrer">공식 출처 →</a></section> : null}
          {content}
        </main>
        <footer>
          <div className="footer-brand"><strong>WONJU STATION</strong><span>도시를 한눈에, 동네를 더 가까이.</span></div>
          <div><span>데이터 안내</span><a href="/city">출처와 최신성</a><a href="/map">위치 신뢰도</a></div>
          <div><span>둘러보기</span><a href="/weather">날씨</a><a href="/news">뉴스</a><a href="/history">원주 이야기</a></div>
          <div className="footer-status"><small>© {now?.getFullYear() ?? 2026} WONJU STATION</small></div>
        </footer>
      </div>
      {menuOpen ? <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기" /> : null}
      {chatOpen ? <Suspense fallback={<div className="chat-loading" role="status">AI 챗봇을 여는 중…</div>}><ChatAssistant onClose={() => setChatOpen(false)} /></Suspense> : <button className="chat-launcher" onClick={() => setChatOpen(true)} aria-label="원주시 AI 챗봇 열기"><span>AI</span><strong>원주에 물어보기</strong></button>}
    </div>
  );
}

function PageShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return <><section className="page-intro"><span>{eyebrow}</span><h1>{title}</h1><p>{intro}</p></section><section className="page-content">{children}</section></>;
}

function Unavailable({ title, detail, href }: { title: string; detail: string; href?: string }) {
  return <div className="unavailable"><span>잠시 안내</span><h3>{title}</h3><p>{detail}</p>{href ? <a href={href} target="_blank" rel="noreferrer">공식 페이지 열기 →</a> : null}</div>;
}
