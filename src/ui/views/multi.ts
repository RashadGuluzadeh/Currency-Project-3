import { onViewChange } from "../../app/router";
import { store } from "../../app/store";
import { currencyName, isCurrencyCode } from "../../core/currencies";
import { amountToInputString, convert, formatAmount, parseAmount, sanitizeAmount } from "../../core/money";
import { isRecord, readJson, writeJson } from "../../core/storage";
import { ICONS, bindAmountInput, copyText, el, fillCurrencySelect, icon, must, symbolBubble } from "../dom";
import { toast } from "../toast";

interface MultiState {
  amount: string;
  codes: string[];
}

const KEY = "cc:multi:v1";
const MAX_TARGETS = 20;
const DEFAULTS: MultiState = { amount: "100", codes: ["USD", "EUR", "GBP", "AZN", "TRY", "RUB"] };

function isMultiState(v: unknown): v is MultiState {
  return (
    isRecord(v) &&
    typeof v.amount === "string" &&
    Array.isArray(v.codes) &&
    v.codes.length <= MAX_TARGETS &&
    v.codes.every(isCurrencyCode)
  );
}

export function mountMultiView(root: HTMLElement): void {
  const amountInput = must<HTMLInputElement>(root, ".multi-amount");
  const baseSelect = must<HTMLSelectElement>(root, ".multi-base");
  const list = must<HTMLUListElement>(root, ".multi-list");
  const addSelect = must<HTMLSelectElement>(root, ".multi-add");
  const copyBtn = must<HTMLButtonElement>(root, ".multi-copy");
  const baseName = must<HTMLElement>(root, ".multi-base-name");

  const saved = readJson(KEY, isMultiState);
  let state: MultiState = saved ? { amount: sanitizeAmount(saved.amount), codes: [...new Set(saved.codes)] } : DEFAULTS;
  amountInput.value = formatAmount(state.amount);

  let visible = false;
  let dirty = true;

  const save = () => writeJson(KEY, state);

  /** Targets shown: everything in the list except the base currency itself. */
  const targets = () => state.codes.filter((c) => c !== store.state.from && store.supports(c));

  function results(): { code: string; value: string }[] {
    const snapshot = store.snapshot;
    const amount = parseAmount(state.amount);
    return targets().map((code) => {
      const v = amount !== null && snapshot ? convert(amount, store.state.from, code, snapshot.rates) : null;
      return { code, value: v === null ? "—" : amountToInputString(v) };
    });
  }

  function render(): void {
    const snapshot = store.snapshot;
    const base = store.state.from;
    baseName.textContent = currencyName(base);
    if (!snapshot) return;
    dirty = false;

    const codes = Object.keys(snapshot.rates).sort();
    fillCurrencySelect(baseSelect, codes, base);

    const frag = document.createDocumentFragment();
    for (const { code, value } of results()) {
      const li = el(
        "li",
        "group flex items-center gap-3 rounded-2xl bg-slate-50/90 p-3 ring-1 ring-slate-200/70 transition hover:ring-brand-300 sm:p-4 dark:bg-white/[0.04] dark:ring-white/10 dark:hover:ring-brand-400/40",
      );
      const info = el("div", "min-w-0 flex-1");
      info.append(el("p", "text-sm font-semibold", code), el("p", "truncate text-xs text-slate-500 dark:text-slate-400", currencyName(code)));

      const valueBtn = el(
        "button",
        "max-w-[55%] truncate rounded-lg px-2 py-1 text-right text-xl font-bold tracking-tight tabular-nums transition hover:bg-white sm:text-2xl dark:hover:bg-white/10",
        value,
      );
      valueBtn.type = "button";
      valueBtn.dataset.copy = `${value} ${code}`;
      valueBtn.title = "Copy";
      valueBtn.setAttribute("aria-label", `${value} ${currencyName(code)}, copy`);

      const remove = el(
        "button",
        "grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:hover:bg-red-500/10",
      );
      remove.type = "button";
      remove.dataset.remove = code;
      remove.setAttribute("aria-label", `Remove ${code}`);
      remove.append(icon(ICONS.close, "size-4"));

      li.append(symbolBubble(code, "size-11 rounded-xl bg-white text-slate-700 shadow-sm dark:bg-white/10 dark:text-slate-200"), info, valueBtn, remove);
      frag.append(li);
    }
    list.replaceChildren(frag);

    // "Add currency" offers everything not already listed.
    const available = codes.filter((c) => c !== base && !state.codes.includes(c));
    const addFrag = document.createDocumentFragment();
    const placeholder = new Option(state.codes.length >= MAX_TARGETS ? `Limit of ${MAX_TARGETS} reached` : "+ Add currency", "");
    placeholder.disabled = true;
    placeholder.selected = true;
    addFrag.append(placeholder);
    for (const c of available) addFrag.append(new Option(`${c} — ${currencyName(c)}`, c));
    addSelect.replaceChildren(addFrag);
    addSelect.disabled = state.codes.length >= MAX_TARGETS;
  }

  const requestRender = () => (visible ? render() : (dirty = true));
  store.subscribe((change) => {
    if (change.rates || change.state) requestRender();
  });
  onViewChange((view) => {
    visible = view === "multi";
    if (visible && dirty) render();
  });

  bindAmountInput(amountInput, (clean) => {
    state = { ...state, amount: clean };
    save();
    render();
  });

  baseSelect.addEventListener("change", () => {
    if (store.supports(baseSelect.value)) store.update({ from: baseSelect.value });
  });

  addSelect.addEventListener("change", () => {
    const code = addSelect.value;
    if (!store.supports(code) || state.codes.includes(code) || state.codes.length >= MAX_TARGETS) return;
    state = { ...state, codes: [...state.codes, code] };
    save();
    render();
    toast(`${code} added`);
  });

  list.addEventListener("click", async (e) => {
    if (!(e.target instanceof Element)) return;
    const removeCode = e.target.closest<HTMLButtonElement>("button[data-remove]")?.dataset.remove;
    if (removeCode) {
      state = { ...state, codes: state.codes.filter((c) => c !== removeCode) };
      save();
      render();
      return;
    }
    const text = e.target.closest<HTMLButtonElement>("button[data-copy]")?.dataset.copy;
    if (text) toast((await copyText(text)) ? `Copied ${text}` : "Couldn't copy");
  });

  copyBtn.addEventListener("click", async () => {
    const amount = parseAmount(state.amount);
    if (amount === null) return toast("Enter an amount first");
    const lines = results().map(({ code, value }) => `${value} ${code}`);
    const text = `${formatAmount(state.amount)} ${store.state.from} =\n${lines.join("\n")}`;
    toast((await copyText(text)) ? "All results copied" : "Couldn't copy");
  });
}
