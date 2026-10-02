import { CACHE_TTL_MS, loadRates } from "../api/rates";
import { DEFAULT_STATE } from "../ui/state";
import { toast } from "../ui/toast";
import { store } from "./store";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

function showFreshness(stale: boolean): void {
  const snap = store.snapshot;
  if (!snap) return;
  const when = dateFormatter.format(snap.updatedAt);
  if (stale || !navigator.onLine) store.setStatus(`Offline · saved rates from ${when}`, "warn");
  else store.setStatus(`Live · updated ${when}`);
}

/** Drops currencies the provider doesn't know (e.g. from an old shared link). */
function ensureSupported(): void {
  const { from, to } = store.state;
  const nextFrom = store.supports(from) ? from : DEFAULT_STATE.from;
  const nextTo = store.supports(to) ? to : DEFAULT_STATE.to;
  if (nextFrom !== from || nextTo !== to) store.update({ from: nextFrom, to: nextTo });
}

export async function refreshRates(force = false): Promise<void> {
  store.setLoading(true);
  if (!store.snapshot) store.setStatus("Loading exchange rates…");
  try {
    const result = await loadRates({ force });
    store.setRates(result.snapshot);
    ensureSupported();
    showFreshness(result.stale);
    if (force) toast(result.stale ? "You're offline — using saved rates" : "Rates refreshed");
  } catch {
    if (store.snapshot) store.setStatus("Couldn't refresh rates · showing last known values", "warn");
    else store.setStatus("Couldn't load exchange rates · check your connection", "error");
  } finally {
    store.setLoading(false);
  }
}

/** Loads rates now and keeps them fresh while the app is open. */
export function startSync(): void {
  void refreshRates();

  window.addEventListener("online", () => void refreshRates());
  window.addEventListener("offline", () => showFreshness(true));

  // Refresh long-lived tabs, but only while visible.
  const tick = () => {
    const snap = store.snapshot;
    if (document.visibilityState === "visible" && snap && Date.now() - snap.fetchedAt >= CACHE_TTL_MS) {
      void refreshRates();
    }
  };
  document.addEventListener("visibilitychange", tick);
  window.setInterval(tick, 5 * 60 * 1000);
}
