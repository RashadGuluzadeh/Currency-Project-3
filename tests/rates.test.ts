import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanRates, fetchFromProviders, loadRates, PROVIDERS } from "../src/api/rates";

const manyRates = (factory: (code: string, i: number) => [string, unknown]) =>
  Object.fromEntries(["USD", "EUR", "GBP", "AZN", "RUB", "JPY", "CNY", "TRY", "CHF", "CAD", "AUD", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "GEL", "KZT", "UAH", "INR"].map(factory));

const erApiPayload = {
  result: "success",
  time_last_update_unix: 1_790_899_351,
  rates: manyRates((c, i) => [c, c === "USD" ? 1 : i + 0.5]),
};

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("cleanRates", () => {
  it("drops malformed codes, non-numbers, negatives and prototype keys", () => {
    const input = JSON.parse('{"USD":1,"EUR":0.9,"eur":2,"BAD1":3,"GBP":-1,"JPY":"150","__proto__":5}');
    input.AZN = Infinity;
    expect(cleanRates(input)).toEqual({ USD: 1, EUR: 0.9 });
  });
  it("upper-cases when asked (fawazahmed0 format)", () => {
    expect(cleanRates({ usd: 1, azn: 1.7 }, true)).toEqual({ USD: 1, AZN: 1.7 });
  });
  it("handles non-objects", () => {
    expect(cleanRates(null)).toEqual({});
    expect(cleanRates([1, 2])).toEqual({});
  });
});

describe("fetchFromProviders", () => {
  it("uses the first provider when it works", async () => {
    const fetchMock = vi.fn(() => json(erApiPayload));
    vi.stubGlobal("fetch", fetchMock);
    const snap = await fetchFromProviders();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(snap.provider.name).toBe("ExchangeRate-API");
    expect(snap.rates.AZN).toBeGreaterThan(0);
    expect(snap.updatedAt).toBe(1_790_899_351_000);
  });

  it("falls back to the next provider on HTTP or payload errors", async () => {
    const fallback = { date: "2026-10-01", usd: manyRates((c, i) => [c.toLowerCase(), i + 1]) };
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => json({ error: "nope" }, 500))
      .mockImplementationOnce(() => json({ result: "success", rates: "garbage" }))
      .mockImplementationOnce(() => json(fallback));
    vi.stubGlobal("fetch", fetchMock);
    const snap = await fetchFromProviders();
    expect(fetchMock).toHaveBeenCalledTimes(PROVIDERS.length);
    expect(snap.provider.name).toBe("fawazahmed0/exchange-api");
    expect(snap.rates.USD).toBe(1);
  });

  it("throws when every provider fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    await expect(fetchFromProviders()).rejects.toThrow(/All rate providers failed/);
  });
});

describe("loadRates", () => {
  it("caches results and serves them without a second request", async () => {
    const fetchMock = vi.fn(() => json(erApiPayload));
    vi.stubGlobal("fetch", fetchMock);
    expect((await loadRates()).source).toBe("network");
    expect((await loadRates()).source).toBe("cache");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent requests", async () => {
    const fetchMock = vi.fn(() => json(erApiPayload));
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all([loadRates({ force: true }), loadRates({ force: true })]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to stale cache when offline", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(erApiPayload)));
    await loadRates();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    const result = await loadRates({ force: true });
    expect(result).toMatchObject({ source: "cache", stale: true });
  });

  it("ignores tampered cache entries", async () => {
    localStorage.setItem("cc:rates:v1", JSON.stringify({ base: "USD", rates: { USD: 1 }, provider: { url: "javascript:alert(1)" } }));
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    await expect(loadRates()).rejects.toThrow();
  });
});
