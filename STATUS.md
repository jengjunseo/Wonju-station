# WONJU STATION v1.4 status

## Product

WONJU STATION is a responsive, evidence-first Wonju life station. The v1.4 experience keeps the accepted visual system while making movement between pages immediate, retaining already verified city data, adding useful living panels, and using ordinary resident-facing Korean.

## Navigation architecture

The deployed vinext framework client-navigation path had historically thrown, so every internal anchor performed a full document request and recreated `StationApp`. v1.4 keeps semantic anchors and deep links but delegates same-origin navigation to one persistent shell using `history.pushState`; `popstate` keeps browser back/forward, URL, and visible route synchronized. External links and modified clicks retain native behavior.

Local browser evidence for `/ → /news → /weather → /map → /events → /discover → /stats → /` showed URL/content synchronization with only the initial document request. Server logs showed no route-document requests during that sequence and no route-triggered `/api/city` request. Direct `/news`, `/weather`, `/stats`, and `/place/무실동` loads remained valid.

## CitySnapshot refresh

The shell owns one warm `CitySnapshot`. A module-level pending promise deduplicates concurrent `/api/city` work, refreshes every five minutes and when a hidden tab becomes visible, and never clears known data while refreshing. A validated/versioned `sessionStorage` copy has a ten-minute maximum age and preserves every original provider status and timestamp. `LOADING/HYDRATING` remains presentation state; provider `UNAVAILABLE` is not rewritten as loading or as live.

## Providers

| Provider | Capability | Current state | Notes |
| --- | --- | --- | --- |
| Open-Meteo | Weather/air fallbacks | LIVE / FALLBACK | Bounded existing fallback behavior is unchanged. |
| KMA | Forecast and explicit alerts | CONFIGURED / FAIL-CLOSED | Sites secrets are present; unsuccessful alert reads remain `CHECK`, never inferred `NORMAL`. |
| AirKorea | PM10/PM2.5 | CONFIGURED / FALLBACK AVAILABLE | Existing adapter and fallback policy are unchanged. |
| Wonju City | Official notices/city facts | LIVE | Independent from Naver. |
| Naver API HUB Search | Local news | API HUB MIGRATION READY | The old Developers endpoint/headers returned hosted `HTTP 401`. v1.4 uses `/search/v1/news` with API HUB headers while retaining the existing env names, normalization, dedupe, cache, timeout and title/summary-only policy. Final hosted smoke is required for the release state below. |
| Kakao Local | Structured Wonju place search/geocoding | LIVE / FREE-ONLY | Existing bounded Wonju validation is unchanged. |
| Kakao Maps / OpenStreetMap | Base map | CONFIGURED / OSM FALLBACK | Map SDK still loads only when a map surface renders. |
| Gemini 3.5 Flash-Lite | Station/persona chat | CONFIGURED | Existing `/api/chat`, prompt boundary, rate limit and provider architecture remain bounded. |
| Gemini 2.5 Flash-Lite + Google Search | `WONJU_WEB` | FAIL-CLOSED / DIAGNOSTIC READY | A 429 is no longer labelled daily exhaustion from status alone. Sanitized `QuotaFailure`/`RetryInfo` evidence is classified into daily, rate, token, grounding, zero-entitlement, model/tool, project, unknown-429, or unavailable states. No paid or ungrounded fallback. |
| Wonju statistics/city site | Population and city attribution | LIVE | Values retain their published period. |

All named provider variables are present in the Sites environment; presence alone is not treated as live certification. Secrets are never returned by diagnostics.

## Google Search diagnosis

Official Gemini documentation confirms `gemini-2.5-flash-lite` and `google_search` support, free Search grounding capacity, and project-level RPM/TPM/RPD quota dimensions. Before v1.4 the code discarded the error body and mapped every HTTP 429 to `QUOTA_EXHAUSTED`, so the exact root cause could not be known and the resident message incorrectly claimed the daily allowance was spent. v1.4 preserves sanitized provider quota evidence and uses an honest generic connection message unless the response proves a narrower class. The release-state section records the final hosted classification.

## TMI source model

`lib/content.ts` contains 24 durable Wonju TMI records spanning city history, Gangwon Gamyeong, literature, people, culture and official sights. Every record has an ID, topic, text, official source label/URL and optional related route. Sources are Wonju City, Wonju Tourism, Wonju History Museum and Wonju UNESCO City of Literature. The same bank powers the homepage TMI, Station Board, Discover/history context and server-supplied chatbot grounding; Gemini may not invent Station TMI.

## Dynamic station features

- Station Board rotates verified weather, air, news, events, population and TMI every ten seconds, with manual controls, hover/focus/hidden-tab pause and reduced-motion support. Warnings override rotation.
- Homepage TMI offers a manual “다른 이야기” action with official provenance.
- Population switches among population, households, month change and gender split without navigation.
- WONJU PULSE explains its deterministic inputs and remains labelled experimental.
- Discover provides user-triggered Random Wonju using only the bounded verified place set.
- Existing weather, air, news, event, district, map and change cards keep useful link behavior.

## Remaining real blockers

- Google Search availability depends on the project quota/entitlement evidence returned by Google; no billing fallback is permitted.
- Provider consoles can still reject configured credentials or domain permissions. Runtime smoke evidence, not secret presence, determines the final state.
- Rate limiting remains per runtime instance because the product intentionally has no database or distributed rate service.

## Deployment

- Branch: `main`
- Public URL: https://wonju-station-live.tsiba5021.chatgpt.site
- Starting SHA: `6418033af6b6ac7698035f413450c12d9fd0ed54`
- Release source/final hosted evidence: recorded after the v1.4 Sites deployment.

## Release state

The final v1.4 candidate must pass targeted tests, full tests, typecheck, lint, production build, rendered-output tests, local desktop/deep-link flows, Sites deployment, hosted desktop/mobile navigation, Naver provider isolation/merge evidence, Google Search diagnostic smoke and chatbot flows before certification.
