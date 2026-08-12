# WONJU STATION v1.1 status

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
| Kakao Local REST API | Evidence-backed News Map geocoding | PENDING_CREDENTIAL | `KAKAO_REST_API_KEY` | Only explicit Wonju 읍면동 evidence is geocoded; results are labelled approximate. |
| Kakao Maps JavaScript SDK | Base map | PENDING_CREDENTIAL | `NEXT_PUBLIC_KAKAO_MAP_KEY` | Provider-designated public key. Register `https://wonju-station-live.tsiba5021.chatgpt.site` as an allowed web domain. |
| Gemini API | Grounded Wonju assistant | LIVE | `GEMINI_API_KEY` | Google's stable `gemini-3.5-flash-lite` model; deployed availability and grounded response certified on 2026-08-12. |
| Wonju statistics / city site | Population and city attribution | LIVE | — | Local certification returned a 2026년 7월말 population period and live city metadata. |

`PUBLIC_DATA_SERVICE_KEY` remains an optional shared server-secret fallback for KMA and AirKorea.

## Architecture

`lib/providers.ts` owns bounded provider adapters and produces normalized `CitySnapshot` data. Six independent provider lanes fan out in parallel, while short server caches deduplicate snapshot, Naver and district-geocode calls. `lib/city.ts` owns news clustering and location confidence. `/api/chat` selects only relevant public Station facts, bounds turns/input/output, applies per-instance rate limiting, and sends no credentials or internal state to Gemini. The chat UI and Kakao SDK are loaded only when needed.

## Known gaps

- Current credential-free News Map coverage is **0 / 8 eligible clusters (0%)**. This is honest partial coverage: no current official title named an 읍면동 and Kakao geocoding is not configured.
- Naver, KMA, AirKorea and Kakao live-provider certification awaits owner credentials/provider-console setup.
- Gemini live certification passed with the deployed `GEMINI_API_KEY` and stable `gemini-3.5-flash-lite` model.
- Rate limiting is bounded per runtime instance, not distributed, because the MVP intentionally has no persistence service.
- The deployed v1.1 build is public; unauthenticated access and the chatbot provider path were certified after the owner-approved deployment.

## Human next action

Add any remaining provider credential values listed above, register the Sites URL in Kakao Developers, then redeploy.

## Deployment

- Visibility: public
- URL: https://wonju-station-live.tsiba5021.chatgpt.site
- Certification: local safety/correctness and representative desktop/mobile flows passed; hosted v1.1 and Gemini chatbot passed public runtime checks.

## Release state

- Certified implementation commit: `aeb8a2d7be498c43eb5729ea25288449d38fdcd4`
- Handoff document: committed immediately after the certified implementation; the delivery report records the resulting repository HEAD.
- Date: 2026-08-12 (Asia/Seoul)
- v1 → v1.1: added independent Naver news, cross-provider clustering, evidence-labelled News Map support, key-ready KMA/AirKorea/Kakao adapters, a grounded lazy-loaded Wonju assistant, bounded caching/rate controls, and final safety/performance certification while preserving the existing visual system and fallbacks.
