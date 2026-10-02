import type { RatesSnapshot } from "../api/rates";
import { persistState, readInitialState, type ConverterState } from "../ui/state";

export type StatusTone = "info" | "warn" | "error";

export interface Change {
  /** from / to / amount / side changed */
  state: boolean;
  /** a new rates snapshot arrived */
  rates: boolean;
  /** loading / status text changed */
  status: boolean;
}

type Listener = (change: Change) => void;

let state: ConverterState = readInitialState();
let snapshot: RatesSnapshot | null = null;
let status: { text: string; tone: StatusTone } = { text: "Loading exchange rates…", tone: "info" };
let loading = false;
const listeners = new Set<Listener>();
let persistTimer: number | undefined;

function emit(change: Partial<Change>): void {
  const full: Change = { state: false, rates: false, status: false, ...change };
  for (const fn of listeners) fn(full);
}

/**
 * Single source of truth shared by every view (converter, rates, charts, multi-convert),
 * so picking a currency in one section is reflected everywhere.
 */
export const store = {
  get state(): ConverterState {
    return state;
  },
  get snapshot(): RatesSnapshot | null {
    return snapshot;
  },
  get status() {
    return status;
  },
  get loading(): boolean {
    return loading;
  },

  /** True when `code` can be converted with the current rates. */
  supports(code: string): boolean {
    return snapshot !== null && code in snapshot.rates;
  },

  update(patch: Partial<ConverterState>): void {
    state = { ...state, ...patch };
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => persistState(state), 300);
    emit({ state: true });
  },

  setRates(next: RatesSnapshot): void {
    snapshot = next;
    emit({ rates: true });
  },

  setStatus(text: string, tone: StatusTone = "info"): void {
    status = { text, tone };
    emit({ status: true });
  },

  setLoading(value: boolean): void {
    loading = value;
    emit({ status: true });
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
