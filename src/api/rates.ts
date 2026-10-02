import { isCurrencyCode, knownIsoCodes } from "../core/currencies";
import { isRecord, readJson, writeJson } from "../core/storage";

export interface RatesSnapshot {
  /** All rates are relative to this currency. */
  base: string;
  rates: Record<string, number>;
  /** When the provider last updated the rates (ms epoch). */
  updatedAt: number;
  /** When we downloaded them (ms epoch). */
  fetchedAt: number;
  provider: { name: string; url: string };
}

export interface RatesResult {
  snapshot: RatesSnapshot;
  source: "network" | "cache";
  /** True when every provider failed and we fell back to an old cache. */
  stale: boolean;
}

const CACHE_KEY = "cc:rates:v1";
export const CACHE_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 512 * 1024;
const BASE = "USD";

interface Provider {
  name: string;
  homepage: string;
  url: string;
  parse(data: unknown): Pick<RatesSnapshot, "rates" | "updatedAt"> | null;
}

/** Keeps only well-formed ISO codes with finite positive rates. */
export function cleanRates(input: unknown, upperCase = false): Record<string, number> {
  const out: Record<string, number> = Object.create(null) as Record<string, number>;
  if (!isRecord(input)) return out;
  for (const [key, value] of Object.entries(input)) {
    const code = upperCase ? key.toUpperCase() : key;
    if (!isCurrencyCode(code)) continue;
    if (knownIsoCodes && !knownIsoCodes.has(code) && code !== BASE) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    out[code] = value;
  }
  return out;
}

const MIN_CURRENCIES = 20;

function fawazProvider(host: string): Provider {
  return {
    name: "fawazahmed0/exchange-api",
    homepage: "https://github.com/fawazahmed0/exchange-api",
    url: `${host}/v1/currencies/${BASE.toLowerCase()}.min.json`,
    parse(data) {
      if (!isRecord(data) || typeof data.date !== "string") return null;
      const rates = cleanRates(data[BASE.toLowerCase()], true);
      const updatedAt = Date.parse(`${data.date}T00:00:00Z`);
      return Number.isFinite(updatedAt) ? { rates, updatedAt } : null;
    },
  };
}

export const PROVIDERS: readonly Provider[] = [
  {
    name: "ExchangeRate-API",
    homepage: "https://www.exchangerate-api.com",
    url: `https://open.er-api.com/v6/latest/${BASE}`,
    parse(data) {
      if (!isRecord(data) || data.result !== "success") return null;
      const ts = data.time_last_update_unix;
      if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
      return { rates: cleanRates(data.rates), updatedAt: ts * 1000 };
    },
  },
  fawazProvider("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest"),
  fawazProvider("https://latest.currency-api.pages.dev"),
];

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: timeoutSignal(REQUEST_TIMEOUT_MS),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    redirect: "error",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new Error("Response too large");
  return JSON.parse(text) as unknown;
}

function isSnapshot(value: unknown): value is RatesSnapshot {
  if (!isRecord(value)) return false;
  const { base, rates, updatedAt, fetchedAt, provider } = value;
  return (
    base === BASE &&
    typeof updatedAt === "number" &&
    typeof fetchedAt === "number" &&
    isRecord(provider) &&
    typeof provider.name === "string" &&
    typeof provider.url === "string" &&
    /^https:\/\//.test(provider.url) &&
    Object.keys(cleanRates(rates)).length >= MIN_CURRENCIES
  );
}

export function readCache(): RatesSnapshot | null {
  const cached = readJson(CACHE_KEY, isSnapshot);
  return cached ? { ...cached, rates: cleanRates(cached.rates) } : null;
}

export async function fetchFromProviders(): Promise<RatesSnapshot> {
  const errors: string[] = [];
  for (const provider of PROVIDERS) {
    try {
      const parsed = provider.parse(await fetchJson(provider.url));
      if (!parsed || Object.keys(parsed.rates).length < MIN_CURRENCIES) throw new Error("Invalid payload");
      parsed.rates[BASE] = 1;
      return {
        base: BASE,
        rates: parsed.rates,
        updatedAt: parsed.updatedAt,
        fetchedAt: Date.now(),
        provider: { name: provider.name, url: provider.homepage },
      };
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`All rate providers failed (${errors.join("; ")})`);
}

let inFlight: Promise<RatesResult> | null = null;

/**
 * Returns fresh-enough rates, hitting the network at most once per TTL.
 * Concurrent callers share one request; on failure an expired cache is still used.
 */
export function loadRates({ force = false } = {}): Promise<RatesResult> {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return Promise.resolve({ snapshot: cached, source: "cache", stale: false });
  }
  inFlight ??= fetchFromProviders()
    .then((snapshot): RatesResult => {
      writeJson(CACHE_KEY, snapshot);
      return { snapshot, source: "network", stale: false };
    })
    .catch((err: unknown): RatesResult => {
      if (cached) return { snapshot: cached, source: "cache", stale: true };
      throw err;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
