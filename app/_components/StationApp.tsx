"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CitySnapshot, Freshness } from "../../lib/city";
import { pulseScore } from "../../lib/city";
import "./station.css";

const DISTRICTS = [
  "문막읍", "소초면", "호저면", "지정면", "부론면", "귀래면", "흥업면", "판부면", "신림면",
  "중앙동", "원인동", "개운동", "명륜1동", "명륜2동", "단구동", "일산동", "학성동", "단계동",
  "우산동", "태장1동", "태장2동", "봉산동", "행구동", "무실동", "반곡관설동",
];

const NAV = [
  ["/", "NOW"], ["/news", "NEWS"], ["/weather", "WEATHER"], ["/map", "MAP"],
  ["/events", "EVENTS"], ["/city", "CITY"], ["/history", "HISTORY"], ["/discover", "DISCOVER"],
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
    fetchedAt: null, detail: "연결 중", items: [],
  },
};

const PAGE_INFO: Record<string, { eyebrow: string; title: string; summary: string; metrics: Array<[string, string]> }> = {
  city: { eyebrow: "CITY DESK", title: "원주를 숫자로 읽는 곳", summary: "인구, 도시 구조, 행정 정보와 변화 기록을 한 화면에서 탐색합니다. 현재값은 검증된 제공자가 연결된 항목만 공개합니다.", metrics: [["도시 통계", "PROVIDER READY"], ["인구", "SOURCE REQUIRED"], ["WONJU NEXT", "CURATED ONLY"]] },
  history: { eyebrow: "CITY ARCHIVE", title: "시간 위에 세워진 원주", summary: "시대·장소·인물을 연결하는 출처 중심의 도시 아카이브입니다. 역사 항목은 검증 가능한 공식 자료가 있을 때만 발행합니다.", metrics: [["타임라인", "SOURCE-LED"], ["인물", "NO UNSOURCED BIO"], ["지도 연결", "PLACE CONFIDENCE"]] },
  discover: { eyebrow: "WEEKEND DESK", title: "이번 주말, 원주 어디로 갈까", summary: "날씨와 운영 정보를 확인해 장소를 추천하는 결정형 탐색 화면입니다. 확인되지 않은 영업시간과 행사는 추천하지 않습니다.", metrics: [["실내", "WEATHER-SAFE"], ["야외", "FORECAST-LED"], ["가족", "ACCESS CHECK"]] },
  transport: { eyebrow: "MOBILITY", title: "원주 이동 현황", summary: "철도, 시외·고속버스, 도로와 주차 정보를 연결할 준비가 되어 있습니다. 실시간 도착 정보는 공식 계약이 확인된 뒤 표시합니다.", metrics: [["철도", "LINKED"], ["버스", "PROVIDER NEEDED"], ["도로", "PROVIDER NEEDED"]] },
  stats: { eyebrow: "CITY STATISTICS", title: "통계는 출처와 시점을 함께", summary: "서로 다른 기준일의 숫자를 섞지 않고, 비교 가능한 지표만 시각화합니다.", metrics: [["출처", "VISIBLE"], ["기준일", "REQUIRED"], ["수치 실패", "FAIL CLOSED"]] },
  population: { eyebrow: "POPULATION", title: "원주는 어떻게 움직이는가", summary: "행정동·연령·기간별 인구 변화 모듈입니다. 주민등록 인구 API가 연결되기 전까지 현재 인구를 추정하지 않습니다.", metrics: [["현재 인구", "UNAVAILABLE"], ["월간 변화", "UNAVAILABLE"], ["비교", "SCHEMA READY"]] },
  projects: { eyebrow: "WONJU NEXT", title: "도시의 다음 장면", summary: "공식 발표와 예산·사업 문서를 근거로 미래 변화를 추적합니다. 계획과 확정을 명확히 구분합니다.", metrics: [["계획", "LABELLED"], ["착공", "EVIDENCE"], ["완료", "VERIFIED"]] },
  air: { eyebrow: "AIR DESK", title: "원주의 공기", summary: "PM10·PM2.5를 제공자 시각과 함께 표시합니다. 관측 실패를 0으로 처리하지 않습니다.", metrics: [["PM10", "LIVE WHEN VALID"], ["PM2.5", "LIVE WHEN VALID"], ["권고", "GRADE-BASED"]] },
  lost: { eyebrow: "LOST IN WONJU", title: "무작위로 만나는 원주", summary: "검증된 장소 데이터가 충분할 때 시작되는 우연 기반 탐색 모드입니다. 아직은 정확한 위치·운영시간을 보장할 수 없어 대기 중입니다.", metrics: [["장소 풀", "NOT CERTIFIED"], ["운영시간", "NOT CERTIFIED"], ["상태", "WAITING"]] },
};

function weatherLabel(code: number | null) {
  if (code === null) return "날씨 확인 중";
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

function SectionHead({ index, kicker, title, link }: { index: string; kicker: string; title: string; link?: string }) {
  return (
    <div className="section-head">
      <span className="section-index">{index}</span>
      <div><span className="kicker">{kicker}</span><h2>{title}</h2></div>
      {link ? <a className="arrow-link" href={link} aria-label={`${title} 더 보기`}>↗</a> : null}
    </div>
  );
}

function MapPanel({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`map-panel ${compact ? "map-panel--compact" : ""}`}>
      <iframe
        title="OpenStreetMap 원주 지도"
        src="https://www.openstreetmap.org/export/embed.html?bbox=127.78%2C37.22%2C128.08%2C37.46&layer=mapnik&marker=37.3422%2C127.9202"
        loading="lazy"
      />
      <div className="map-hud map-hud--top"><span>LIVE BASEMAP</span><span>NEWS 0 · EVENTS 0 · AIR 1</span></div>
      <div className="map-hud map-hud--bottom">정확한 위치가 검증된 레코드만 오버레이합니다 · © OpenStreetMap contributors</div>
    </div>
  );
}

export function StationApp({ route }: { route: string }) {
  const [snapshot, setSnapshot] = useState<CitySnapshot>(UNAVAILABLE_SNAPSHOT);
  const [now, setNow] = useState<Date | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 1000);
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
    fetch("/api/city")
      .then((response) => {
        if (!response.ok) throw new Error("city feed unavailable");
        return response.json() as Promise<CitySnapshot>;
      })
      .then((data) => { if (active) setSnapshot(withControlledAlert(data)); })
      .catch(() => { /* the explicit unavailable snapshot remains visible */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const routeKey = route.split("/").filter(Boolean)[0] ?? "now";
  const selectedDistrict = decodeURIComponent(route.split("/").filter(Boolean)[1] ?? "무실동");
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

  function renderHome() {
    return (
      <>
        <section className="hero-grid">
          <div className="hero-weather">
            <div className="hero-topline"><span>WONJU / 37.3422°N</span><FreshnessBadge status={snapshot.weather.status} /></div>
            <div className="temperature-row"><strong>{formatValue(snapshot.weather.temperature, "°")}</strong><div><span>{weatherLabel(snapshot.weather.weatherCode)}</span><small>체감 {formatValue(snapshot.weather.apparentTemperature, "°")}</small></div></div>
            <p className="weather-sentence">{snapshot.weather.status === "UNAVAILABLE" ? "현재 기상 정보를 확인할 수 없습니다." : `지금 원주는 ${weatherLabel(snapshot.weather.weatherCode)}. 오늘 강수확률은 ${formatValue(snapshot.weather.precipitationProbability, "%")}입니다.`}</p>
            <div className="weather-metrics">
              <div><span>최고</span><b>{formatValue(snapshot.weather.high, "°")}</b></div>
              <div><span>최저</span><b>{formatValue(snapshot.weather.low, "°")}</b></div>
              <div><span>습도</span><b>{formatValue(snapshot.weather.humidity, "%")}</b></div>
              <div><span>바람</span><b>{formatValue(snapshot.weather.windSpeed, " km/h")}</b></div>
            </div>
          </div>
          <div className="hero-status">
            <span className="kicker">CITY STATUS</span>
            <div className={`status-orb status-orb--${snapshot.alerts.label.toLowerCase()}`} aria-hidden="true" />
            <strong>{snapshot.alerts.label}</strong>
            <p>{snapshot.alerts.label === "CHECK" ? "공식 특보 피드 미연결 · 기상청에서 직접 확인하세요." : "명시적 특보 규칙으로 산출된 상태입니다."}</p>
            <a href={snapshot.alerts.sourceUrl} target="_blank" rel="noreferrer">기상청 특보 확인 ↗</a>
          </div>
          <div className="hero-clock" aria-live="polite">
            <span>{now ? new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "long", month: "long", day: "2-digit" }).format(now).toUpperCase() : "KOREA STANDARD TIME"}</span>
            <strong>{now ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now) : "--:--:--"}</strong>
            <small>ASIA / SEOUL · UTC+09</small>
          </div>
        </section>

        <section className="pulse-strip">
          <div><span className="live-dot" /> WONJU NOW</div>
          <div><span>특보</span><strong>{snapshot.alerts.label}</strong></div>
          <div><span>미세먼지</span><strong>{snapshot.air.grade ?? "—"}</strong></div>
          <div><span>공식 새소식</span><strong>{snapshot.notices.items.length || "—"}</strong></div>
          <div><span>최고 / 최저</span><strong>{formatValue(snapshot.weather.high, "°")} / {formatValue(snapshot.weather.low, "°")}</strong></div>
        </section>

        <section className="content-grid content-grid--news">
          <div>
            <SectionHead index="01" kicker="NOW IN WONJU" title="공식 새소식" link="/news" />
            <div className="news-list">
              {snapshot.notices.items.length ? snapshot.notices.items.slice(0, 5).map((item, index) => (
                <a className="news-row" href={item.canonicalUrl} target="_blank" rel="noreferrer" key={item.id}>
                  <span className="news-number">{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{item.title}</strong><small>{item.department} · {item.publishedAt}</small></div>
                  <span>↗</span>
                </a>
              )) : <Unavailable title="검증된 새소식을 불러오지 못했습니다" detail="원주시청 공식 목록은 그대로 연결해 두었습니다." href={snapshot.notices.sourceUrl} />}
            </div>
          </div>
          <div><SectionHead index="02" kicker="SPATIAL CONTEXT" title="라이브 맵" link="/map" /><MapPanel compact /></div>
        </section>

        <section className="content-grid content-grid--thirds">
          <article className="station-card cobalt-card">
            <SectionHead index="03" kicker="TODAY IN WONJU" title="오늘의 흐름" link="/events" />
            <p>{snapshot.weather.status === "UNAVAILABLE" ? "날씨와 검증된 행사 데이터가 연결되면 오늘의 동선을 제안합니다." : `최고 ${formatValue(snapshot.weather.high, "°")}, 강수확률 ${formatValue(snapshot.weather.precipitationProbability, "%")}. 공식 행사 피드는 현재 검증 대기 중입니다.`}</p>
            <span className="card-footnote">DETERMINISTIC SUMMARY · NO AI REQUIRED</span>
          </article>
          <article className="station-card changelog-card">
            <SectionHead index="04" kicker="WONJU CHANGELOG" title="도시 변경 기록" link="/projects" />
            <div className="empty-lines"><span /><span /><span /></div>
            <p>확인된 공식 사업·개통·정책 변경이 들어오면 시점과 출처를 함께 기록합니다.</p>
          </article>
          <article className="station-card pulse-card">
            <SectionHead index="05" kicker="EXPERIMENTAL" title="WONJU PULSE" />
            <strong className="pulse-score">{pulse ?? "—"}<small>/ 100</small></strong>
            <div className="pulse-bar"><span style={{ width: `${pulse ?? 0}%` }} /></div>
            <p>날씨·공기·공식 업데이트 수를 정규화한 실험 지표. 실제 혼잡도를 의미하지 않습니다.</p>
          </article>
        </section>

        <section className="provider-board">
          <SectionHead index="06" kicker="DATA DESK" title="데이터 상태" />
          <ProviderLine label={snapshot.weather.provider} status={snapshot.weather.status} time={snapshot.weather.fetchedAt} href={snapshot.weather.sourceUrl} />
          <ProviderLine label={snapshot.air.provider} status={snapshot.air.status} time={snapshot.air.fetchedAt} href={snapshot.air.sourceUrl} />
          <ProviderLine label={snapshot.notices.provider} status={snapshot.notices.status} time={snapshot.notices.fetchedAt} href={snapshot.notices.sourceUrl} />
          <ProviderLine label={snapshot.alerts.provider} status={snapshot.alerts.status} time={snapshot.alerts.fetchedAt} href={snapshot.alerts.sourceUrl} />
        </section>
      </>
    );
  }

  function renderWeather() {
    return (
      <PageShell eyebrow="HYPERLOCAL WEATHER" title="원주의 하늘은 하나가 아니다" intro="공식 KMA 키가 연결되면 읍면동 격자 예보를 우선합니다. 현재는 원주 중심 좌표의 명시적 보조 피드를 보여주며, 동네별 값을 복제하지 않습니다.">
        <div className="weather-dashboard">
          <article className="weather-primary"><span>NOW · WONJU</span><strong>{formatValue(snapshot.weather.temperature, "°")}</strong><h2>{weatherLabel(snapshot.weather.weatherCode)}</h2><p>체감 {formatValue(snapshot.weather.apparentTemperature, "°")} · 습도 {formatValue(snapshot.weather.humidity, "%")} · 바람 {formatValue(snapshot.weather.windSpeed, " km/h")}</p></article>
          <article className="sun-card"><span>SUN CYCLE</span><div><b>{formatTime(snapshot.weather.sunrise)}</b><small>일출</small></div><div><b>{formatTime(snapshot.weather.sunset)}</b><small>일몰</small></div></article>
          <div className="hourly-chart">
            {snapshot.weather.hourly.length ? snapshot.weather.hourly.map((hour) => (
              <div key={hour.time}><span>{formatTime(hour.time)}</span><i style={{ height: `${Math.max(20, hour.precipitationProbability)}%` }} /><strong>{formatValue(hour.temperature, "°")}</strong><small>{hour.precipitationProbability}%</small></div>
            )) : <Unavailable title="시간별 예보 없음" detail="제공자 응답을 기다리고 있습니다." />}
          </div>
        </div>
        <SectionHead index="W" kicker="DISTRICT MATRIX" title="25개 읍면동" />
        <div className="district-grid">{DISTRICTS.map((district) => <a href={`/place/${encodeURIComponent(district)}`} key={district}><strong>{district}</strong><span>공식 격자 미연결</span><FreshnessBadge status="UNAVAILABLE" /></a>)}</div>
      </PageShell>
    );
  }

  function renderNews() {
    return (
      <PageShell eyebrow="WONJU NEWS" title="같은 사건은 하나의 이야기로" intro="원주시 공식 새소식을 우선 연결하고, 정규화 제목 기반으로 중복을 제거합니다. 전체 본문은 복제하지 않고 제목·부서·시점·원문 링크만 제공합니다.">
        <div className="filter-rail"><button className="active">전체</button><button>행정</button><button>생활</button><button>문화</button><button>교통</button><span>{snapshot.notices.items.length} VERIFIED ITEMS</span></div>
        <div className="news-board">
          {snapshot.notices.items.length ? snapshot.notices.items.map((item, index) => (
            <article key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><small>OFFICIAL · {item.department}</small><h2>{item.title}</h2><p>원주시청 공식 게시물입니다. 원문에서 세부 내용과 첨부파일을 확인하세요.</p><a href={item.canonicalUrl} target="_blank" rel="noreferrer">원문 보기 ↗</a></div><time>{item.publishedAt}</time></article>
          )) : <Unavailable title="공식 새소식 피드 점검 중" detail="실패를 빈 기사나 가짜 뉴스로 대체하지 않습니다." href={snapshot.notices.sourceUrl} />}
        </div>
      </PageShell>
    );
  }

  function renderMap() {
    return (
      <PageShell eyebrow="WONJU LIVE MAP" title="도시는 지도 위에서 이해된다" intro="베이스맵과 데이터 레이어를 분리했습니다. 정확한 위치가 확인되지 않은 뉴스·행사는 지도에 억지로 찍지 않습니다.">
        <div className="map-tools"><button className="active">BASE</button><button>NEWS · 0</button><button>EVENTS · 0</button><button>AIR · 1</button><button>WEATHER · 1</button><span>MARKER CONFIDENCE: VERIFIED ONLY</span></div>
        <MapPanel />
        <div className="map-legend"><div><i className="legend-dot legend-dot--lime" /><b>대기 관측</b><span>원주 중심 보조 피드</span></div><div><i className="legend-dot legend-dot--blue" /><b>날씨</b><span>도시 대표 좌표</span></div><div><i className="legend-dot" /><b>뉴스 / 행사</b><span>검증 위치 없음</span></div></div>
      </PageShell>
    );
  }

  function renderEvents() {
    return (
      <PageShell eyebrow="EVENTS & CALENDAR" title="오늘 원주에서 무슨 일이 열리나" intro="날짜·장소·주최·공식 링크가 모두 확인된 행사만 표시합니다. 현재 수집 계약이 확인되지 않아 포털 연결 상태로 제공합니다.">
        <div className="date-strip">{["오늘", "목", "금", "토", "일", "월", "화"].map((day, i) => <div className={i === 0 ? "active" : ""} key={day}><strong>{12 + i}</strong><span>{day}</span></div>)}</div>
        <Unavailable title="검증된 행사 일정 없음" detail="날짜가 지난 행사나 출처 없는 이벤트를 채워 넣지 않습니다." href="https://www.wonju.go.kr/www/sub.do?key=213" />
        <div className="link-cards"><a href="https://www.wonju.go.kr/www/sub.do?key=213" target="_blank" rel="noreferrer"><span>01</span><strong>원주시 문화행사</strong><small>공식 일정 열기 ↗</small></a><a href="https://www.wonju.go.kr/tour/index.do" target="_blank" rel="noreferrer"><span>02</span><strong>원주관광</strong><small>공식 관광 정보 ↗</small></a></div>
      </PageShell>
    );
  }

  function renderDistrict() {
    const valid = DISTRICTS.includes(selectedDistrict);
    return (
      <PageShell eyebrow="NEIGHBORHOOD DESK" title={valid ? selectedDistrict : "동네를 찾을 수 없습니다"} intro="날씨·뉴스·행사·시설을 동네 단위로 묶는 대시보드입니다. 도시 대표값을 동네값처럼 복제하지 않습니다.">
        <div className="district-hero"><div><span>WEATHER</span><strong>—</strong><small>KMA 격자 미연결</small></div><div><span>NEWS MAP</span><strong>0</strong><small>검증 위치 기사</small></div><div><span>EVENTS</span><strong>0</strong><small>검증 일정</small></div><div><span>STATUS</span><strong>CHECK</strong><small>특보 피드 미연결</small></div></div>
        <div className="district-switcher">{DISTRICTS.map((district) => <a className={district === selectedDistrict ? "active" : ""} href={`/place/${encodeURIComponent(district)}`} key={district}>{district}</a>)}</div>
      </PageShell>
    );
  }

  function renderGeneric() {
    if (routeKey === "air") {
      return <PageShell eyebrow="AIR DESK" title="원주의 공기" intro="실패를 0㎍/㎥로 바꾸지 않는 대기질 화면입니다."><div className="air-hero"><div><span>AIR GRADE</span><strong>{snapshot.air.grade ?? "—"}</strong></div><div><span>PM10</span><strong>{formatValue(snapshot.air.pm10)}</strong><small>㎍/㎥</small></div><div><span>PM2.5</span><strong>{formatValue(snapshot.air.pm25)}</strong><small>㎍/㎥</small></div></div><ProviderLine label={snapshot.air.provider} status={snapshot.air.status} time={snapshot.air.fetchedAt} href={snapshot.air.sourceUrl} /></PageShell>;
    }
    const info = PAGE_INFO[routeKey] ?? PAGE_INFO.city;
    return <PageShell eyebrow={info.eyebrow} title={info.title} intro={info.summary}><div className="metric-panels">{info.metrics.map(([label, value], index) => <article key={label}><span>{String(index + 1).padStart(2, "0")}</span><h2>{label}</h2><strong>{value}</strong></article>)}</div><div className="system-note"><span>DATA INTEGRITY</span><h2>빈 상태도 도시의 상태입니다.</h2><p>공식 제공자가 연결되지 않은 현재값은 추정하지 않습니다. 이 화면의 구조와 실패 경계는 준비되어 있으며, 검증 가능한 소스가 들어오는 순간 같은 인터페이스에서 표시됩니다.</p></div></PageShell>;
  }

  const content = routeKey === "now" ? renderHome() : routeKey === "weather" ? renderWeather() : routeKey === "news" ? renderNews() : routeKey === "map" ? renderMap() : routeKey === "events" ? renderEvents() : routeKey === "place" ? renderDistrict() : renderGeneric();

  return (
    <div className="station-shell">
      <header className="topbar">
        <Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span><strong>WONJU STATION</strong><small>원주의 모든 것, 지금 여기.</small></span></Link>
        <nav aria-label="주요 메뉴">{NAV.map(([href, label]) => <Link className={(href === "/" ? routeKey === "now" : route.startsWith(href)) ? "active" : ""} href={href} key={href}>{label}</Link>)}</nav>
        <div className="header-actions"><button onClick={() => setQuery(query ? "" : "원주")} aria-label="검색 열기">⌕</button><button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="색상 모드 전환">{theme === "dark" ? "☼" : "◐"}</button><span className={`network-state network-state--${snapshot.weather.status.toLowerCase()}`}>{snapshot.weather.status === "UNAVAILABLE" ? "PARTIAL" : "ONLINE"}</span></div>
      </header>

      <div className={`search-drawer ${query ? "search-drawer--open" : ""}`}>
        <label htmlFor="station-search">통합 검색</label>
        <input id="station-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="동네, 뉴스, 섹션 검색" autoComplete="off" />
        <button onClick={() => setQuery("")} aria-label="검색 닫기">×</button>
        {query ? <div className="search-results">{searchResults.length ? searchResults.map((item) => item.href.startsWith("/") ? <Link href={item.href} key={`${item.href}-${item.title}`}><span>{item.meta}</span><strong>{item.title}</strong></Link> : <a href={item.href} target="_blank" rel="noreferrer" key={`${item.href}-${item.title}`}><span>{item.meta}</span><strong>{item.title}</strong></a>) : <p>일치하는 결과가 없습니다.</p>}</div> : null}
      </div>

      <div className="route-rail"><span>{routeKey.toUpperCase()}</span><span>DATA FIRST · SOURCE VISIBLE · FAIL CLOSED</span></div>
      <main>
        {snapshot.alerts.level !== null && snapshot.alerts.level >= 3 ? <section className={`alert-banner alert-banner--${snapshot.alerts.label.toLowerCase()}`} role="alert"><span>WONJU {snapshot.alerts.label}</span><div><strong>{snapshot.alerts.title}</strong><p>{snapshot.alerts.detail}</p></div><a href={snapshot.alerts.sourceUrl} target="_blank" rel="noreferrer">SOURCE ↗</a></section> : null}
        {content}
      </main>
      <footer>
        <div className="footer-brand"><strong>WONJU STATION</strong><span>도시를 한눈에, 동네를 더 가까이.</span></div>
        <div><span>DATA POLICY</span><Link href="/city">출처와 최신성</Link><Link href="/map">위치 신뢰도</Link></div>
        <div><span>EXPLORE</span><Link href="/weather">날씨</Link><Link href="/news">뉴스</Link><Link href="/history">아카이브</Link></div>
        <div className="footer-status"><span className="live-dot" /> SYSTEM {snapshot.weather.status === "UNAVAILABLE" ? "PARTIAL" : "OPERATIONAL"}<small>© {now?.getFullYear() ?? 2026} WONJU STATION</small></div>
      </footer>
    </div>
  );
}

function PageShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return <><section className="page-intro"><span>{eyebrow}</span><h1>{title}</h1><p>{intro}</p></section><section className="page-content">{children}</section></>;
}

function Unavailable({ title, detail, href }: { title: string; detail: string; href?: string }) {
  return <div className="unavailable"><span>UNAVAILABLE</span><h3>{title}</h3><p>{detail}</p>{href ? <a href={href} target="_blank" rel="noreferrer">공식 페이지 열기 ↗</a> : null}</div>;
}
