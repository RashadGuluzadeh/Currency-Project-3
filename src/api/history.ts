import { crossRate } from "../core/money";
import { isRecord } from "../core/storage";
import { cleanRates, fetchJson } from "./rates";

export const RANGES = {
  "7D": { days: 7, step: 1 },
  "1M": { days: 30, step: 2 },
  "3M": { days: 91, step: 7 },
  "6M": { days: 182, step: 14 },
  "1Y": { days: 364, step: 14 },
} as const;

export type Range = keyof typeof RANGES;

export interface Point {
  /** YYYY-MM-DD (UTC) */
  date: string;
  value: number;
}

const DAY_MS = 86_400_000;
const CONCURRENCY = 6;

/** Historical snapshots never change, so one in-memory copy per date is enough. */
const cache = new Map<string, Promise<Record<string, number> | null>>();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function mirrors(date: string): string[] {
  return [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/usd.min.json`,
    `https://${date}.currency-api.pages.dev/v1/currencies/usd.min.json`,
  ];
}

async function fetchDay(date: string): Promise<Record<string, number> | null> {
  if (!DATE_RE.test(date)) return null;
  for (const url of mirrors(date)) {
    try {
      const data = await fetchJson(url);
      if (!isRecord(data)) continue;
      const rates = cleanRates(data.usd, true);
      if (Object.keys(rates).length > 20) return { ...rates, USD: 1 };
    } catch {
      /* try next mirror */
    }
  }
  return null;
}

function ratesOn(date: string): Promise<Record<string, number> | null> {
  let pending = cache.get(date);
  if (!pending) {
    pending = fetchDay(date);
    cache.set(date, pending);
    // Don't cache failures forever — allow a retry later.
    void pending.then((r) => r ?? cache.delete(date));
  }
  return pending;
}

/** Sample dates for a range, oldest first, ending yesterday (today's file may not exist yet). */
export function sampleDates(range: Range, now = Date.now()): string[] {
  const { days, step } = RANGES[range];
  const end = Math.floor(now / DAY_MS) * DAY_MS - DAY_MS;
  const dates: string[] = [];
  for (let offset = days; offset >= 0; offset -= step) {
    dates.push(new Date(end - offset * DAY_MS).toISOString().slice(0, 10));
  }
  return dates;
}

async function mapLimited<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Rate history for 1 `from` in `to`. Missing days are skipped. */
export async function loadHistory(from: string, to: string, range: Range): Promise<Point[]> {
  const dates = sampleDates(range);
  const days = await mapLimited(dates, CONCURRENCY, ratesOn);
  const points: Point[] = [];
  days.forEach((rates, i) => {
    const value = rates ? crossRate(from, to, rates) : null;
    const date = dates[i];
    if (value !== null && date) points.push({ date, value });
  });
  return points;
}
