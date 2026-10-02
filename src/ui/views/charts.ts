import { RANGES, loadHistory, type Point, type Range } from "../../api/history";
import { onViewChange } from "../../app/router";
import { store } from "../../app/store";
import { currencyName } from "../../core/currencies";
import { crossRate, formatRate } from "../../core/money";
import { readJson, writeJson } from "../../core/storage";
import { createLineChart } from "../chart";
import { el, fillCurrencySelect, icon, must } from "../dom";

const RANGE_KEY = "cc:chart-range";
const RANGE_LABEL: Record<Range, string> = {
  "7D": "past week",
  "1M": "past month",
  "3M": "past 3 months",
  "6M": "past 6 months",
  "1Y": "past year",
};
const isRange = (v: unknown): v is Range => typeof v === "string" && v in RANGES;

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });
const pct = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2, signDisplay: "exceptZero" });

export function mountChartsView(root: HTMLElement): void {
  const fromSelect = must<HTMLSelectElement>(root, ".chart-from");
  const toSelect = must<HTMLSelectElement>(root, ".chart-to");
  const swapBtn = must<HTMLButtonElement>(root, ".chart-swap");
  const rangeGroup = must<HTMLElement>(root, ".chart-ranges");
  const pairLabel = must<HTMLElement>(root, ".chart-pair");
  const current = must<HTMLElement>(root, ".chart-current");
  const change = must<HTMLElement>(root, ".chart-change");
  const stats = must<HTMLElement>(root, ".chart-stats");
  const box = must<HTMLElement>(root, ".chart-box");
  const canvas = must<HTMLElement>(root, ".chart-canvas");
  const overlay = must<HTMLElement>(root, ".chart-overlay");
  const tableBody = must<HTMLTableSectionElement>(root, ".chart-table tbody");

  let range: Range = readJson(RANGE_KEY, isRange) ?? "1M";
  let visible = false;
  let loadedKey = "";
  let requestId = 0;

  const chart = createLineChart(canvas, {
    formatValue: formatRate,
    formatDate: (d, long) => (long ? longDate : range === "1Y" || range === "6M" ? monthYear : shortDate).format(new Date(`${d}T00:00:00Z`)),
  });

  function renderControls(): void {
    const snapshot = store.snapshot;
    const { from, to } = store.state;
    if (snapshot) {
      const codes = Object.keys(snapshot.rates).sort();
      fillCurrencySelect(fromSelect, codes, from);
      fillCurrencySelect(toSelect, codes, to);
    }
    for (const b of rangeGroup.querySelectorAll<HTMLButtonElement>("button[data-range]")) {
      b.setAttribute("aria-pressed", String(b.dataset.range === range));
    }
    pairLabel.textContent = `${currencyName(from)} → ${currencyName(to)}`;
    const live = snapshot ? crossRate(from, to, snapshot.rates) : null;
    current.textContent = live === null ? "—" : `1 ${from} = ${formatRate(live)} ${to}`;
  }

  function setOverlay(text: string | null, retry = false): void {
    overlay.hidden = text === null;
    box.classList.toggle("opacity-40", text !== null && !retry);
    overlay.replaceChildren();
    if (text === null) return;
    overlay.append(el("p", "text-sm text-slate-500 dark:text-slate-400", text));
    if (retry) {
      const btn = el("button", "mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700", "Try again");
      btn.type = "button";
      btn.addEventListener("click", () => {
        loadedKey = "";
        void load();
      });
      overlay.append(btn);
    }
  }

  function stat(label: string, value: string): HTMLDivElement {
    const tile = el("div", "rounded-2xl bg-slate-50/90 px-4 py-3 ring-1 ring-slate-200/70 dark:bg-white/[0.04] dark:ring-white/10");
    tile.append(
      el("p", "text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400", label),
      el("p", "mt-1 text-lg font-semibold tabular-nums", value),
    );
    return tile;
  }

  function renderSummary(points: Point[]): void {
    const values = points.map((p) => p.value);
    const first = values[0]!;
    const last = values.at(-1)!;
    const diff = ((last - first) / first) * 100;
    const up = diff > 0;
    const flat = Math.abs(diff) < 0.005;

    change.className =
      "chart-change mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold " +
      (flat
        ? "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
        : up
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300");
    change.replaceChildren(
      icon(flat ? "M5 12h14" : up ? "M7 17 17 7M9 7h8v8" : "M7 7l10 10M17 9v8H9", "size-4"),
      document.createTextNode(`${pct.format(diff)}% ${flat ? "unchanged" : up ? "up" : "down"} · ${RANGE_LABEL[range]}`),
    );

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    stats.replaceChildren(
      stat("Low", formatRate(Math.min(...values))),
      stat("High", formatRate(Math.max(...values))),
      stat("Average", formatRate(avg)),
    );

    const frag = document.createDocumentFragment();
    for (const p of [...points].reverse()) {
      const tr = el("tr", "border-t border-slate-100 dark:border-white/5");
      tr.append(el("td", "py-1.5 pr-4", longDate.format(new Date(`${p.date}T00:00:00Z`))), el("td", "py-1.5 text-right tabular-nums", formatRate(p.value)));
      frag.append(tr);
    }
    tableBody.replaceChildren(frag);
  }

  async function load(): Promise<void> {
    const { from, to } = store.state;
    const key = `${from}:${to}:${range}`;
    if (key === loadedKey) return;
    loadedKey = key;
    const id = ++requestId;

    if (from === to) {
      setOverlay("Pick two different currencies to see a chart.");
      return;
    }
    setOverlay("Loading history…");
    try {
      const points = await loadHistory(from, to, range);
      if (id !== requestId) return; // a newer request superseded this one
      if (points.length < 2) throw new Error("not enough data");
      setOverlay(null);
      chart.setData(points, `${from} to ${to} exchange rate, ${RANGE_LABEL[range]}`);
      renderSummary(points);
    } catch {
      if (id !== requestId) return;
      loadedKey = "";
      setOverlay("Couldn't load rate history. Check your connection.", true);
    }
  }

  store.subscribe((c) => {
    if (!c.rates && !c.state) return;
    if (visible) {
      renderControls();
      void load();
    }
  });
  onViewChange((view) => {
    visible = view === "charts";
    if (visible) {
      renderControls();
      void load();
    }
  });

  fromSelect.addEventListener("change", () => store.supports(fromSelect.value) && store.update({ from: fromSelect.value }));
  toSelect.addEventListener("change", () => store.supports(toSelect.value) && store.update({ to: toSelect.value }));

  const swapIcon = swapBtn.querySelector("svg");
  swapBtn.addEventListener("click", () => {
    swapIcon?.classList.remove("animate-swap");
    void swapBtn.offsetWidth;
    swapIcon?.classList.add("animate-swap");
    store.update({ from: store.state.to, to: store.state.from });
  });

  rangeGroup.addEventListener("click", (e) => {
    const value = e.target instanceof Element ? e.target.closest<HTMLButtonElement>("button[data-range]")?.dataset.range : undefined;
    if (!isRange(value) || value === range) return;
    range = value;
    writeJson(RANGE_KEY, range);
    renderControls();
    void load();
  });
}
