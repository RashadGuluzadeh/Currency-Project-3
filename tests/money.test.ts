import { describe, expect, it } from "vitest";
import {
  amountToInputString,
  caretFromSignificantCount,
  convert,
  crossRate,
  formatAmount,
  parseAmount,
  sanitizeAmount,
  significantCharsBefore,
} from "../src/core/money";

describe("sanitizeAmount", () => {
  it.each([
    ["", ""],
    ["123", "123"],
    ["1 234 567", "1234567"],
    ["12,5", "12.5"],
    ["1,234.56", "1234.56"],
    ["1.2.3", "1.23"],
    ["000123", "123"],
    ["0", "0"],
    ["00.5", "0.5"],
    [".5", "0.5"],
    ["-50", "50"],
    ["1e5", "15"],
    ["abc<script>", ""],
    ["1.12345678", "1.123456"],
    ["9999999999999999999", "999999999999999"],
  ])("%j -> %j", (input, expected) => {
    expect(sanitizeAmount(input)).toBe(expected);
  });
});

describe("formatAmount", () => {
  it("groups thousands with spaces", () => {
    expect(formatAmount("1234567.891")).toBe("1 234 567.891");
    expect(formatAmount("999")).toBe("999");
    expect(formatAmount("1000.")).toBe("1 000.");
    expect(formatAmount("")).toBe("");
  });
});

describe("parseAmount", () => {
  it("returns null for empty or incomplete input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(".")).toBeNull();
  });
  it("parses formatted values", () => {
    expect(parseAmount("1 234.5")).toBe(1234.5);
    expect(parseAmount("0")).toBe(0);
  });
});

describe("crossRate / convert", () => {
  const rates = { USD: 1, AZN: 1.7, EUR: 0.85 };

  it("returns 1 for same currency, even if unknown", () => {
    expect(crossRate("XYZ", "XYZ", rates)).toBe(1);
  });
  it("computes cross rates through the base", () => {
    expect(crossRate("USD", "AZN", rates)).toBeCloseTo(1.7);
    expect(crossRate("EUR", "AZN", rates)).toBeCloseTo(2);
  });
  it("returns null for unknown currencies", () => {
    expect(convert(10, "USD", "XXX", rates)).toBeNull();
  });
  it("converts amounts", () => {
    expect(convert(100, "USD", "AZN", rates)).toBeCloseTo(170);
  });
});

describe("amountToInputString", () => {
  it("uses 2 decimals for normal values and trims zeros", () => {
    expect(amountToInputString(170.0000001)).toBe("170");
    expect(amountToInputString(1234.567)).toBe("1 234.57");
  });
  it("keeps precision for tiny values", () => {
    expect(amountToInputString(0.0000238)).toBe("0.000024");
  });
  it("rejects invalid values", () => {
    expect(amountToInputString(Number.NaN)).toBe("");
    expect(amountToInputString(-1)).toBe("");
    expect(amountToInputString(Infinity)).toBe("");
  });
});

describe("caret helpers", () => {
  it("keeps caret after the same digit when separators are inserted", () => {
    const raw = "12345"; // caret after "1234"
    const count = significantCharsBefore(raw, 4);
    const formatted = formatAmount(sanitizeAmount(raw));
    expect(formatted).toBe("12 345");
    expect(caretFromSignificantCount(formatted, count)).toBe(5); // "12 34|5"
  });
});
