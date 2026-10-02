import { afterEach, describe, expect, it, vi } from "vitest";
import { loadHistory, sampleDates } from "../src/api/history";
import { niceStep } from "../src/ui/chart";

afterEach(() => vi.unstubAllGlobals());

describe("sampleDates", () => {
  const now = Date.parse("2026-10-02T15:00:00Z");

  it("ends yesterday and is oldest-first", () => {
    const dates = sampleDates("7D", now);
    expect(dates).toHaveLength(8);
    expect(dates.at(-1)).toBe("2026-10-01");
    expect(dates[0]).toBe("2026-09-24");
  });

  it("samples longer ranges sparsely", () => {
    expect(sampleDates("1Y", now).length).toBeLessThanOrEqual(30);
    expect(sampleDates("3M", now).every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);
  });
});

describe("niceStep", () => {
  it.each([
    [1, 0.2],
    [0.04, 0.01],
    [130, 50],
    [7, 2],
  ])("span %d -> %d", (span, step) => {
    expect(niceStep(span)).toBeCloseTo(step);
  });
});

describe("loadHistory", () => {
  const day = (usdToAzn: number) => ({
    date: "x",
    usd: Object.fromEntries(
      ["eur", "gbp", "azn", "rub", "jpy", "cny", "try", "chf", "cad", "aud", "sek", "nok", "dkk", "pln", "czk", "huf", "gel", "kzt", "uah", "inr", "sgd", "hkd", "nzd", "btc"].map((c) => [
        c,
        c === "azn" ? usdToAzn : 2,
      ]),
    ),
  });

  it("computes cross rates per day and skips days that fail", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        call++;
        // Every request for one specific day fails on both mirrors.
        if (url.includes("2026-09-28")) return Promise.reject(new TypeError("offline"));
        return Promise.resolve(new Response(JSON.stringify(day(1.7))));
      }),
    );
    vi.useFakeTimers({ now: Date.parse("2026-10-02T12:00:00Z"), toFake: ["Date"] });
    const points = await loadHistory("USD", "AZN", "7D");
    vi.useRealTimers();

    expect(call).toBeGreaterThan(0);
    expect(points).toHaveLength(7);
    expect(points.every((p) => p.value === 1.7)).toBe(true);
    expect(points.map((p) => p.date)).not.toContain("2026-09-28");
  });
});
