/** Currencies shown as one-click buttons. Everything else is in the "More" list. */
export const QUICK_CURRENCIES = ["AZN", "USD", "EUR", "GBP", "RUB"] as const;

export const DEFAULT_FROM = "USD";
export const DEFAULT_TO = "AZN";

const CODE_RE = /^[A-Z]{3}$/;

export function isCurrencyCode(value: unknown): value is string {
  return typeof value === "string" && CODE_RE.test(value);
}

let displayNames: Intl.DisplayNames | null = null;
try {
  displayNames = new Intl.DisplayNames(["en"], { type: "currency" });
} catch {
  displayNames = null;
}

export function currencyName(code: string): string {
  try {
    return displayNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** ISO-4217 codes known to the runtime, used to filter out crypto/junk from APIs. */
export const knownIsoCodes: ReadonlySet<string> | null = (() => {
  try {
    const list = Intl.supportedValuesOf?.("currency");
    return list && list.length > 0 ? new Set(list) : null;
  } catch {
    return null;
  }
})();

/** Shown on the "Popular rates" cards, in this order (the selected base is skipped). */
export const POPULAR_CURRENCIES = ["USD", "EUR", "GBP", "AZN", "TRY", "RUB", "GEL", "AED", "CNY"] as const;

/** Short symbol for a currency ("$", "₼", "€"), falling back to the code. */
export function currencySymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value;
    return part && part.length <= 3 ? part : code;
  } catch {
    return code;
  }
}
