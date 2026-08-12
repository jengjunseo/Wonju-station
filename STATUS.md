# WONJU STATION v1.3 status

## Product

WONJU STATION is a responsive Wonju regional-life dashboard. It shows sourced weather, air quality, alerts, official and local news, map context, population, city information, events, districts, transport links, and history. Missing or failed data remains visibly unavailable instead of being guessed.

## Providers

| Provider | Capability | Status | Required env | Notes |
| --- | --- | --- | --- | --- |
| Open-Meteo | Weather/forecast fallback | LIVE / FALLBACK | — | Used until KMA succeeds; bounded and validated. |
| KMA VilageFcstInfoService | Weather/forecast | PENDING_CREDENTIAL | `KMA_SERVICE_KEY` | Apply for the short-range forecast API at data.go.kr. Failure stays isolated behind Open-Meteo. |
| KMA WthrWrnInfoService | Explicit Wonju alerts | PENDING_CREDENTIAL | `KMA_SERVICE_KEY` | Missing or failed feed displays `CHECK`, never inferred `NORMAL`. |
| Open-Meteo Air Quality | Air-quality fallback | LIVE / FALLBACK | — | Used until AirKorea succeeds. |
| AirKorea | Official station PM10/PM2.5 | PENDING_CREDENTIAL | `AIRKOREA_SERVICE_KEY` | Apply for station and real-time pollution APIs at data.go.kr; provider approval may be required. |
| Wonju City | Official notices | LIVE | — | Independent from Naver; current local smoke returned 8 clusters. |
| Naver Search Open API | Local news | PENDING_CREDENTIAL | `NAVER_NEWS_CLIENT_ID`, `NAVER_NEWS_CLIENT_SECRET` | Precision query is `원주시`; stores title, summary, source and original link only. |
| OpenStreetMap | Base map fallback | LIVE / FALLBACK | — | Remains available until Kakao Maps succeeds. |
| Kakao Local REST API | News Map geocoding + structured chatbot place discovery | LIVE / FREE-ONLY | `KAKAO_REST_API_KEY` | `WONJU_PLACE` uses a Wonju-qualified keyword query, 20km bound, and address validation; only provider-supported place fields are returned. |
| Kakao Maps JavaScript SDK | Base map | PENDING_CREDENTIAL | `NEXT_PUBLIC_KAKAO_MAP_KEY` | Provider-designated public key. Register `https://wonju-station-live.tsiba5021.chatgpt.site` as an allowed web domain. |
| Gemini API + Google Search grounding | Five-mode Wonju assistant | LIVE / FREE-SEARCH CAPACITY DEPENDENT | `GEMINI_API_KEY` | `gemini-3.5-flash-lite` presents Station data and powers persona chat; `gemini-2.5-flash-lite` is isolated to the free-only `WONJU_WEB` Search lane. No paid fallback. |
| Wonju statistics / city site | Population and city attribution | LIVE | — | Local certification returned a 2026년 7월말 population period and live city metadata. |

`PUBLIC_DATA_SERVICE_KEY` remains an optional shared server-secret fallback for KMA and AirKorea.

## Architecture

`lib/providers.ts` owns bounded provider adapters and produces normalized domain data. Existing snapshot lanes remain unchanged; Kakao keyword place results are normalized separately and cached for five minutes. Before any provider/model call, `/api/chat` deterministically selects exactly one mode: `STATION` uses only the relevant Station snapshot and `gemini-3.5-flash-lite`; `WONJU_PLACE` calls only Kakao Local and renders structured place cards; `WONJU_WEB` calls only `gemini-2.5-flash-lite` with `google_search`; `CHAT` uses the 3.5 persona without a search tool; `OUT_OF_SCOPE` is declined without a provider or model call. Inputs, history, output, and the existing 5 requests/minute per-instance rate limit remain bounded. Station, Kakao, and web provenance are carried in structured response fields. Web Search quota and transient provider errors fail closed inside `WONJU_WEB` without disabling other modes.

## Known gaps

- Current credential-free News Map coverage is **0 / 8 eligible clusters (0%)**. This is honest partial coverage: no current official title named an 읍면동 and Kakao geocoding is not configured.
- Naver, KMA and AirKorea live-provider certification awaits owner credentials/provider-console setup.
- Station topics that are routed internally but not represented in the current normalized content model, including 조엄 and 장일순, fail closed with an explicit unavailable-grounding response and never fall through to web search.
- Google documents a free Search grounding allowance for Gemini 2.5 Flash/Flash-Lite, shared at 500 requests per day on the free tier. `WONJU_WEB` never upgrades to paid usage; a 429 is an expected machine-readable provider state and is not retried.
- Rate limiting is bounded per runtime instance, not distributed, because the MVP intentionally has no persistence service.
- The deployed v1.2 build is public; unauthenticated access and the chatbot provider path were certified after deployment.

## Human next action

Add any remaining provider credential values listed above, register the Sites URL in Kakao Developers, then redeploy.

## Deployment

- Visibility: public
- URL: https://wonju-station-live.tsiba5021.chatgpt.site
- Certification: full local test/type/lint/build/render checks and hosted five-mode user-flow checks are required for each release. Kakao place and free Search live status are reported separately because both depend on external quota capacity.

## Release state

- Release source: the Sites deployment is built from the repository `main` head recorded by the deployment version.
- Date: 2026-08-12 (Asia/Seoul)
- v1 → v1.1: added independent Naver news, cross-provider clustering, evidence-labelled News Map support, key-ready KMA/AirKorea/Kakao adapters, a grounded lazy-loaded Wonju assistant, bounded caching/rate controls, and final safety/performance certification while preserving the existing visual system and fallbacks.
- v1.1 → v1.2: added the 꽁드리 persona, exact first-open greeting, deterministic four-mode routing, Station-only fail-closed grounding, Wonju-only Google Search grounding, structured provenance, and explicit ambiguous-question clarification without changing UI/CSS, provider adapters, or rate limits.
- v1.2 → v1.3: added `WONJU_PLACE` with bounded Kakao Local keyword search and structured place cards, split `WONJU_WEB` onto `gemini-2.5-flash-lite`, and preserved 3.5-powered non-web modes with no paid search fallback.
