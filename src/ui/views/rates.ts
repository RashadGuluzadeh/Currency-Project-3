import { navigate, onViewChange } from "../../app/router";
import { store } from "../../app/store";
import { currencyName } from "../../core/currencies";
import { favoriteCount, isFavorite, toggleFavorite } from "../../core/favorites";
import { crossRate, formatRate } from "../../core/money";
import { ICONS, el, fillCurrencySelect, icon, must, symbolBubble } from "../dom";

type Filter = "all" | "favorites";

export function mountRatesView(root: HTMLElement): void {
  const baseSelect = must<HTMLSelectElement>(root, ".rates-base");
  const search = must<HTMLInputElement>(root, ".rates-search");
  const filterGroup = must<HTMLElement>(root, ".rates-filter");
  const favCount = must<HTMLElement>(root, ".fav-count");
  const list = must<HTMLUListElement>(root, ".rates-list");
  const empty = must<HTMLElement>(root, ".rates-empty");
  const subtitle = must<HTMLElement>(root, ".rates-subtitle");

  let filter: Filter = "all";
  let visible = false;
  let dirty = true;

  function row(code: string, base: string, rates: Record<string, number>): HTMLLIElement | null {
    const rate = crossRate(base, code, rates);
    const inverse = crossRate(code, base, rates);
    if (rate === null || inverse === null) return null;
    const name = currencyName(code);
    const fav = isFavorite(code);

    const li = el(
      "li",
      "grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50 sm:px-3 dark:hover:bg-white/[0.04]",
    );

    const star = el(
      "button",
      "grid size-9 place-items-center rounded-lg transition hover:bg-amber-50 dark:hover:bg-amber-400/10 " +
        (fav ? "text-amber-500" : "text-slate-300 hover:text-amber-500 dark:text-slate-600"),
    );
    star.type = "button";
    star.dataset.fav = code;
    star.setAttribute("aria-pressed", String(fav));
    star.setAttribute("aria-label", `${fav ? "Remove" : "Add"} ${code} ${fav ? "from" : "to"} favorites`);
    const starIcon = icon(ICONS.star, "size-[18px]");
    if (fav) starIcon.setAttribute("fill", "currentColor");
    star.append(starIcon);

    const info = el("div", "min-w-0");
    info.append(el("p", "text-sm font-semibold", code), el("p", "truncate text-xs text-slate-500 dark:text-slate-400", name));

    const value = el("div", "text-right");
    value.append(
      el("p", "font-semibold tabular-nums", formatRate(rate)),
      el("p", "hidden text-xs text-slate-400 tabular-nums sm:block", `1 ${code} = ${formatRate(inverse)} ${base}`),
    );

    const go = el(
      "button",
      "grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-white/10 dark:hover:text-brand-300",
    );
    go.type = "button";
    go.dataset.convert = code;
    go.title = `Convert ${base} to ${code}`;
    go.setAttribute("aria-label", `Convert ${base} to ${name}`);
    go.append(icon(ICONS.arrowRight, "size-4"));

    li.append(star, symbolBubble(code, "size-10 rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200"), info, value, go);
    return li;
  }

  function render(): void {
    const snapshot = store.snapshot;
    favCount.textContent = String(favoriteCount());
    if (!snapshot) return;
    dirty = false;

    const base = store.state.from;
    const codes = Object.keys(snapshot.rates).sort();
    fillCurrencySelect(baseSelect, codes, base);
    subtitle.textContent = `How much 1 ${base} (${currencyName(base)}) is worth in ${codes.length - 1} currencies.`;

    const q = search.value.trim().toLowerCase();
    const matches = codes.filter((code) => {
      if (code === base) return false;
      if (filter === "favorites" && !isFavorite(code)) return false;
      return !q || code.toLowerCase().includes(q) || currencyName(code).toLowerCase().includes(q);
    });
    // Favorites first, then alphabetical.
    matches.sort((a, b) => Number(isFavorite(b)) - Number(isFavorite(a)) || a.localeCompare(b));

    const frag = document.createDocumentFragment();
    for (const code of matches) {
      const li = row(code, base, snapshot.rates);
      if (li) frag.append(li);
    }
    list.replaceChildren(frag);

    empty.hidden = matches.length > 0;
    empty.textContent =
      filter === "favorites" && !q ? "No favorites yet — tap the ☆ next to a currency to pin it here." : `No currencies match “${search.value.trim()}”.`;
  }

  /** Only re-render while the view is on screen; mark dirty otherwise. */
  const requestRender = () => (visible ? render() : (dirty = true));

  store.subscribe((change) => {
    if (change.rates || change.state) requestRender();
  });
  onViewChange((view) => {
    visible = view === "rates";
    if (visible && dirty) render();
  });

  baseSelect.addEventListener("change", () => {
    if (store.supports(baseSelect.value)) store.update({ from: baseSelect.value });
  });

  search.addEventListener("input", () => render());

  filterGroup.addEventListener("click", (e) => {
    const btn = e.target instanceof Element ? e.target.closest<HTMLButtonElement>("button[data-filter]") : null;
    if (!btn) return;
    filter = btn.dataset.filter === "favorites" ? "favorites" : "all";
    for (const b of filterGroup.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b === btn));
    render();
  });

  list.addEventListener("click", (e) => {
    if (!(e.target instanceof Element)) return;
    const favBtn = e.target.closest<HTMLButtonElement>("button[data-fav]");
    if (favBtn?.dataset.fav) {
      const code = favBtn.dataset.fav;
      toggleFavorite(code);
      render();
      list.querySelector<HTMLButtonElement>(`button[data-fav="${code}"]`)?.focus();
      return;
    }
    const code = e.target.closest<HTMLButtonElement>("button[data-convert]")?.dataset.convert;
    if (code) {
      store.update({ to: code, side: "from" });
      navigate("convert");
    }
  });
}
