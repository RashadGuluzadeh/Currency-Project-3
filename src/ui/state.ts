import { DEFAULT_FROM, DEFAULT_TO, isCurrencyCode } from "../core/currencies";
import { sanitizeAmount } from "../core/money";
import { isRecord, readJson, writeJson } from "../core/storage";

export type Side = "from" | "to";

export interface ConverterState {
  from: string;
  to: string;
  /** Sanitized amount typed by the user, e.g. "1250.5". */
  amount: string;
  /** Which field the user typed into; the other one is computed. */
  side: Side;
}

const PREFS_KEY = "cc:prefs:v1";

export const DEFAULT_STATE: ConverterState = { from: DEFAULT_FROM, to: DEFAULT_TO, amount: "100", side: "from" };

/** Builds a valid state from untrusted input (URL params, localStorage), field by field. */
export function coerceState(input: Partial<Record<keyof ConverterState, unknown>>, fallback = DEFAULT_STATE): ConverterState {
  const code = (v: unknown, def: string) => {
    const upper = typeof v === "string" ? v.trim().toUpperCase() : v;
    return isCurrencyCode(upper) ? upper : def;
  };
  return {
    from: code(input.from, fallback.from),
    to: code(input.to, fallback.to),
    amount: typeof input.amount === "string" ? sanitizeAmount(input.amount.slice(0, 40)) : fallback.amount,
    side: input.side === "to" || input.side === "from" ? input.side : fallback.side,
  };
}

export function readInitialState(search = window.location.search): ConverterState {
  const stored = readJson(PREFS_KEY, isRecord);
  const base = stored ? coerceState(stored) : DEFAULT_STATE;

  const params = new URLSearchParams(search);
  if (![...params.keys()].some((k) => ["from", "to", "amount", "side"].includes(k))) return base;
  return coerceState(
    {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      amount: params.get("amount") ?? undefined,
      side: params.get("side") ?? undefined,
    },
    base,
  );
}

export function toSearchParams(state: ConverterState): URLSearchParams {
  const params = new URLSearchParams({ from: state.from, to: state.to });
  if (state.amount) params.set("amount", state.amount);
  if (state.side === "to") params.set("side", "to");
  return params;
}

export function shareUrl(state: ConverterState): string {
  const url = new URL(window.location.href);
  url.search = toSearchParams(state).toString();
  url.hash = "";
  return url.toString();
}

export function persistState(state: ConverterState): void {
  writeJson(PREFS_KEY, state);
  try {
    window.history.replaceState(null, "", `?${toSearchParams(state).toString()}${window.location.hash}`);
  } catch {
    /* sandboxed iframes may block history access */
  }
}
