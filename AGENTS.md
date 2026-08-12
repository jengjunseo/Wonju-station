# WONJU STATION engineering rules

- Never fabricate live city data, alerts, coordinates, current officeholders, events, or opening hours.
- Provider adapters stay in `lib/providers.ts`; UI components consume normalized domain objects.
- Preserve provider name, source URL, fetch time, and `LIVE | FRESH | STALE | UNAVAILABLE` status.
- A missing alert feed is `CHECK`, not `NORMAL`.
- Keep fixtures in tests only; production code must not import them.
- Reserve red for explicit warning or emergency UI.
- Run `npm test`, `npm run lint`, `npm run build`, and `npm run test:render` before delivery.

