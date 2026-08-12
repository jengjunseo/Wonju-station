# WONJU STATION

원주의 날씨, 공식 새소식, 도시 상태, 지도, 행사·통계·역사 탐색을 하나의 정보 보드로 묶는 독립 시티 대시보드입니다.

## Local development

Node.js 22.13 이상이 필요합니다.

```bash
npm install
npm run dev
```

검증 명령은 `npm test`, `npm run lint`, `npm run build`, `npm run test:render`입니다.

## Data providers

| Domain | Primary | Current fallback | Failure behavior |
| --- | --- | --- | --- |
| Weather | KMA public-data API | Open-Meteo, clearly labelled | `UNAVAILABLE` |
| Alerts | KMA weather warnings | none | `CHECK`, never fake `NORMAL` |
| Air | AirKorea | Open-Meteo Air Quality, clearly labelled | `UNAVAILABLE` |
| Notices | Wonju City official notices | none | empty verified list |
| Map | Kakao Maps when a public key is configured | OpenStreetMap embed | overlays omitted unless location is verified |

The server adapter lives in `lib/providers.ts`; presentation never fetches provider HTML directly. External records preserve provider, source URL, fetch time, and freshness state. Current provider requests use timeouts and the city endpoint is cached for five minutes with stale-while-revalidate.

## Environment

Copy `.env.example` to `.env.local`. Keys are optional for rendering, but required for primary Korean provider certification. Never expose KMA, AirKorea, or public-data service keys to the browser. The Kakao JavaScript key is the only browser-key slot.

## Data integrity

- Production never falls back to test fixtures.
- A failed measurement is not converted to zero.
- Alert severity is an explicit 0–4 mapping; unavailable alert data becomes `CHECK`.
- News is reduced to title, department, date, and canonical official link.
- Map overlays require verified coordinates; neighborhood-centroid approximations must be labelled.
- `WONJU PULSE` is experimental and is not a congestion or emergency score.

## Deployment

The app uses the bundled vinext + Cloudflare Worker-compatible Sites build. `.openai/hosting.json` is the deployment contract. Runtime values belong in Sites environment settings rather than source control.

