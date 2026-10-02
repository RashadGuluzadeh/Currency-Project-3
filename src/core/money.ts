/** Max digits the user may type after the decimal point. */
export const MAX_DECIMALS = 6;
/** Keeps numbers inside the range where IEEE-754 doubles stay exact for integers. */
export const MAX_INTEGER_DIGITS = 15;

const GROUP_SEPARATOR = " ";

export type Rates = Readonly<Record<string, number>>;

/**
 * Turns arbitrary user input into a canonical "1234.56" string.
 * - Accepts both "," and "." as decimal separator (if both appear, "," is a thousands separator).
 * - Drops every other character, extra dots and leading zeros.
 * - Never returns a negative or exponent form.
 */
export function sanitizeAmount(raw: string, maxDecimals = MAX_DECIMALS): string {
  let s = raw.includes(".") ? raw.replace(/,/g, "") : raw.replace(/,/g, ".");
  s = s.replace(/[^\d.]/g, "");

  const dot = s.indexOf(".");
  let int = dot === -1 ? s : s.slice(0, dot);
  const frac = dot === -1 ? null : s.slice(dot + 1).replace(/\./g, "").slice(0, maxDecimals);

  int = int.replace(/^0+(?=\d)/, "").slice(0, MAX_INTEGER_DIGITS);
  if (frac === null || maxDecimals === 0) return int;
  return `${int || "0"}.${frac}`;
}

/** Adds group separators to a sanitized amount: "1234567.5" -> "1 234 567.5". */
export function formatAmount(clean: string): string {
  const [int = "", frac] = clean.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}

/** Parses a formatted/sanitized amount. Returns null for empty or incomplete input. */
export function parseAmount(text: string): number | null {
  const clean = sanitizeAmount(text);
  if (clean === "" || clean === "0." || !/\d/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

/** Cross rate between two currencies, given rates relative to any common base. */
export function crossRate(from: string, to: string, rates: Rates): number | null {
  if (from === to) return 1;
  const f = rates[from];
  const t = rates[to];
  if (f === undefined || t === undefined || !(f > 0) || !(t > 0)) return null;
  return t / f;
}

export function convert(amount: number, from: string, to: string, rates: Rates): number | null {
  const rate = crossRate(from, to, rates);
  return rate === null ? null : amount * rate;
}

/**
 * Renders a converted value for an input field: 2 decimals for normal amounts,
 * up to MAX_DECIMALS for tiny ones (so 1 IRR -> USD doesn't show as 0.00).
 */
export function amountToInputString(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value >= 1e21) return "";
  const decimals = value >= 1 || value === 0 ? 2 : MAX_DECIMALS;
  const fixed = value.toFixed(decimals);
  const trimmed = fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
  return formatAmount(trimmed);
}

const rateFormatter = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 });

export function formatRate(rate: number): string {
  return rateFormatter.format(rate);
}

/** Counts characters that survive sanitizing (digits and separators) before `pos`. */
export function significantCharsBefore(text: string, pos: number): number {
  return text.slice(0, pos).replace(/[^\d.,]/g, "").length;
}

/** Finds the caret position in `formatted` after `count` significant characters. */
export function caretFromSignificantCount(formatted: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/[\d.]/.test(formatted[i] ?? "") && ++seen === count) return i + 1;
  }
  return formatted.length;
}
