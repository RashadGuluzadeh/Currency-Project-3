import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_STATE, coerceState, readInitialState, toSearchParams } from "../src/ui/state";

beforeEach(() => localStorage.clear());

describe("coerceState", () => {
  it("rejects invalid values field by field", () => {
    expect(coerceState({ from: "<img>", to: "eur", amount: "12abc", side: "sideways" })).toEqual({
      ...DEFAULT_STATE,
      to: "EUR",
      amount: "12",
    });
  });
});

describe("readInitialState", () => {
  it("prefers URL params over saved prefs", () => {
    localStorage.setItem("cc:prefs:v1", JSON.stringify({ from: "GBP", to: "RUB", amount: "5", side: "from" }));
    expect(readInitialState("?from=eur&amount=1,5")).toEqual({ from: "EUR", to: "RUB", amount: "1.5", side: "from" });
  });

  it("uses saved prefs when no URL params", () => {
    localStorage.setItem("cc:prefs:v1", JSON.stringify({ from: "GBP", to: "RUB", amount: "5", side: "to" }));
    expect(readInitialState("")).toEqual({ from: "GBP", to: "RUB", amount: "5", side: "to" });
  });

  it("survives corrupted storage", () => {
    localStorage.setItem("cc:prefs:v1", "{not json");
    expect(readInitialState("")).toEqual(DEFAULT_STATE);
  });
});

describe("toSearchParams", () => {
  it("round-trips", () => {
    const state = { from: "USD", to: "AZN", amount: "250", side: "to" as const };
    expect(readInitialState(`?${toSearchParams(state).toString()}`)).toEqual(state);
  });
});
