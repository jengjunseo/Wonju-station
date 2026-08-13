import type { CitySnapshot } from "./city";

export const CITY_SNAPSHOT_STORAGE_KEY = "wonju-station:city-snapshot:v1";
export const CITY_SNAPSHOT_MAX_AGE_MS = 10 * 60_000;
export const CITY_REFRESH_INTERVAL_MS = 5 * 60_000;

export type StoredCitySnapshot = { storedAt: number; snapshot: CitySnapshot };

export function isCitySnapshot(value: unknown): value is CitySnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CitySnapshot>;
  return typeof candidate.generatedAt === "string"
    && Boolean(candidate.weather && typeof candidate.weather === "object")
    && Boolean(candidate.air && typeof candidate.air === "object")
    && Boolean(candidate.alerts && typeof candidate.alerts === "object")
    && Boolean(candidate.notices && typeof candidate.notices === "object")
    && Boolean(candidate.population && typeof candidate.population === "object");
}

export function parseStoredCitySnapshot(raw: string | null, now = Date.now()): CitySnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredCitySnapshot>;
    if (typeof value.storedAt !== "number" || value.storedAt > now || now - value.storedAt > CITY_SNAPSHOT_MAX_AGE_MS) return null;
    return isCitySnapshot(value.snapshot) ? value.snapshot : null;
  } catch {
    return null;
  }
}

export function serializeCitySnapshot(snapshot: CitySnapshot, storedAt = Date.now()): string {
  return JSON.stringify({ storedAt, snapshot } satisfies StoredCitySnapshot);
}

export function internalStationPath(href: string, origin: string): string | null {
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin || url.pathname.startsWith("/api/")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function nextRotatingIndex(current: number, length: number, direction: 1 | -1 = 1): number {
  if (length <= 0) return 0;
  return (current + direction + length) % length;
}
