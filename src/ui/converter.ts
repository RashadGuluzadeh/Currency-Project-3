import { store } from "../app/store";
import { refreshRates } from "../app/sync";
import { POPULAR_CURRENCIES, QUICK_CURRENCIES, currencyName, currencySymbol } from "../core/currencies";
import { amountToInputString, convert, crossRate, formatAmount, formatRate, parseAmount, sanitizeAmount } from "../core/money";
import { bindAmountInput, copyText, el, must, symbolBubble, symbolSize } from "./dom";
import { shareUrl, type Side } from "./state";
import { toast } from "./toast";

const SIDES: readonly Side[] = ["from", "to"];
const other = (side: Side): Side => (side === "from" ? "to" : "from");

interface PanelEls {
  picker: HTMLElement;
  input: HTMLInputElement;
  rateLine: HTMLElement;
  symbol: HTMLElement;
  name: HTMLElement;
}

export function mountConverter(root: HTMLElement): void {
  const converter = must<HTMLElement>(root, ".converter");
  const panels = Object.fromEntries(
    SIDES.map((side) => {
      const panel = must<HTMLElement>(root, `.panel[data-side="${side}"]`);
      return [
        side,
        {
          picker: must(panel, ".picker"),
          input: must(panel, "input"),
          rateLine: must(panel, ".rate-line"),
          symbol: must(panel, ".symbol"),
          name: must(panel, ".currency-name"),
        },
      ];
    }),
  ) as Record<Side, PanelEls>;
  const status = must<HTMLElement>(root, ".status");
  const statusText = must<HTMLElement>(status, ".status-text");
  const swapBtn = must<HTMLButtonElement>(root, ".swap");
  const refreshBtn = must<HTMLButtonElement>(root, ".refresh");
  const shareBtn = must<HTMLButtonElement>(root, ".share");
  const popularList = must<HTMLUListElement>(root, ".popular");
  const popularBase = must<HTMLElement>(root, ".popular-base");
  const providerLink = document.querySelector<HTMLAnchorElement>(".provider-link");

  // ---------------------------------------------------------------- rendering

  function renderPicker(side: Side): void {
    const { picker } = panels[side];
    const selected = store.state[side];
    const snapshot = store.snapshot;
    const frag = document.createDocumentFragment();

    for (const code of QUICK_CURRENCIES) {
      const btn = el("button", "chip", code);
      btn.type = "button";
      btn.title = currencyName(code);
      btn.dataset.code = code;
      btn.setAttribute("aria-pressed", String(code === selected));
      btn.disabled = snapshot !== null && !(code in snapshot.rates);
      frag.append(btn);
    }

    const select = el("select", "chip chip-select");
    select.setAttribute("aria-label", side === "from" ? "Other currency you have" : "Other currency to buy");
    const isQuick = (QUICK_CURRENCIES as readonly string[]).includes(selected);
    select.classList.toggle("is-active", !isQuick);

    const placeholder = new Option("More…", "");
    placeholder.disabled = true;
    select.append(placeholder);
    const codes = snapshot ? Object.keys(snapshot.rates).sort() : isQuick ? [] : [selected];
    for (const code of codes) {
      const isSelected = code === selected && !isQuick;
      // The closed select shows only the code so it fits next to the quick buttons.
      const label = isSelected ? code : `${code} — ${currencyName(code)}`;
      select.append(new Option(label, code, false, isSelected));
    }
    if (isQuick) select.value = "";
    select.disabled = !snapshot;
    frag.append(select);

    picker.replaceChildren(frag);
  }

  function renderCurrencyInfo(): void {
    for (const side of SIDES) {
      const { symbol, name } = panels[side];
      const sym = currencySymbol(store.state[side]);
      symbol.textContent = sym;
      symbol.classList.remove("text-lg", "text-sm", "text-[10px]");
      symbol.classList.add(symbolSize(sym));
      name.textContent = currencyName(store.state[side]);
    }
  }

  function renderAmounts(): void {
    const state = store.state;
    const snapshot = store.snapshot;
    const active = panels[state.side].input;
    const passive = panels[other(state.side)].input;

    if (sanitizeAmount(active.value) !== state.amount) active.value = formatAmount(state.amount);

    const amount = parseAmount(state.amount);
    const [from, to] = state.side === "from" ? [state.from, state.to] : [state.to, state.from];
    const result = amount !== null && snapshot ? convert(amount, from, to, snapshot.rates) : null;
    passive.value = result === null ? "" : amountToInputString(result);
  }

  function renderRateLines(): void {
    const snapshot = store.snapshot;
    for (const side of SIDES) {
      const a = store.state[side];
      const b = store.state[other(side)];
      const rate = snapshot ? crossRate(a, b, snapshot.rates) : null;
      panels[side].rateLine.textContent = rate === null ? "" : `1 ${a} = ${formatRate(rate)} ${b}`;
    }
  }

  function renderPopular(): void {
    const { from: base, to } = store.state;
    const snapshot = store.snapshot;
    popularBase.textContent = `Value of 1 ${base} · ${currencyName(base)}`;
    if (!snapshot) return;

    const frag = document.createDocumentFragment();
    const codes = POPULAR_CURRENCIES.filter((c) => c !== base && c in snapshot.rates).slice(0, 6);
    for (const code of codes) {
      const rate = crossRate(base, code, snapshot.rates);
      if (rate === null) continue;
      const selected = code === to;

      const btn = el(
        "button",
        "group flex w-full items-center gap-3 rounded-2xl border bg-white/70 p-4 text-left backdrop-blur transition duration-200 " +
          "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-900/5 dark:bg-white/[0.03] " +
          (selected
            ? "border-brand-400 ring-2 ring-brand-500/30 dark:border-brand-400/60"
            : "border-slate-200/70 hover:border-brand-200 dark:border-white/10 dark:hover:border-brand-400/30"),
      );
      btn.type = "button";
      btn.dataset.code = code;
      btn.setAttribute("aria-pressed", String(selected));
      btn.setAttribute("aria-label", `Convert ${base} to ${currencyName(code)}`);

      const bubble = symbolBubble(
        code,
        "size-10 rounded-xl transition " +
          (selected
            ? "bg-brand-600 text-white"
            : "bg-slate-100 text-slate-700 group-hover:bg-brand-100 group-hover:text-brand-700 dark:bg-white/10 dark:text-slate-200"),
      );
      const text = el("span", "min-w-0 flex-1");
      text.append(
        el("span", "block text-sm font-semibold", code),
        el("span", "block truncate text-xs text-slate-500 dark:text-slate-400", currencyName(code)),
      );
      btn.append(bubble, text, el("span", "text-right font-semibold tabular-nums", formatRate(rate)));
      const li = el("li");
      li.append(btn);
      frag.append(li);
    }
    popularList.replaceChildren(frag);
  }

  function renderStatus(): void {
    statusText.textContent = store.status.text;
    status.dataset.tone = store.status.tone;
    refreshBtn.disabled = store.loading;
    if (store.snapshot) converter.setAttribute("aria-busy", "false");
    if (providerLink && store.snapshot) {
      providerLink.textContent = store.snapshot.provider.name;
      providerLink.href = store.snapshot.provider.url;
    }
  }

  function renderAll(): void {
    for (const side of SIDES) renderPicker(side);
    renderCurrencyInfo();
    renderAmounts();
    renderRateLines();
    renderPopular();
  }

  let shown = { from: store.state.from, to: store.state.to };
  store.subscribe((change) => {
    if (change.status) renderStatus();
    if (!change.state && !change.rates) return;
    const { from, to } = store.state;
    if (change.rates || from !== shown.from || to !== shown.to) {
      shown = { from, to };
      renderAll();
    } else {
      renderAmounts();
    }
  });

  // ------------------------------------------------------------------ events

  for (const side of SIDES) {
    const { picker, input } = panels[side];

    picker.addEventListener("click", (e) => {
      const code = e.target instanceof Element ? e.target.closest<HTMLButtonElement>("button[data-code]")?.dataset.code : undefined;
      if (code) store.update({ [side]: code });
    });

    picker.addEventListener("change", (e) => {
      const select = e.target;
      if (!(select instanceof HTMLSelectElement) || !store.supports(select.value)) return;
      store.update({ [side]: select.value });
      panels[side].picker.querySelector<HTMLSelectElement>("select")?.focus();
    });

    bindAmountInput(input, (clean) => store.update({ amount: clean, side }));
  }

  popularList.addEventListener("click", (e) => {
    const code = e.target instanceof Element ? e.target.closest<HTMLButtonElement>("button[data-code]")?.dataset.code : undefined;
    if (!code) return;
    store.update({ to: code });
    converter.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const swapIcon = swapBtn.querySelector("svg");
  swapBtn.addEventListener("click", () => {
    swapIcon?.classList.remove("animate-swap");
    void swapBtn.offsetWidth; // restart the animation
    swapIcon?.classList.add("animate-swap");
    store.update({ from: store.state.to, to: store.state.from });
  });

  refreshBtn.addEventListener("click", () => void refreshRates(true));

  shareBtn.addEventListener("click", async () => {
    toast((await copyText(shareUrl(store.state))) ? "Link copied to clipboard" : "Couldn't copy the link");
  });

  renderAll();
  renderStatus();
}
