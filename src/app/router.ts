export const VIEWS = ["convert", "rates", "charts", "multi"] as const;
export type View = (typeof VIEWS)[number];

const TITLES: Record<View, string> = {
  convert: "Currency Converter",
  rates: "Exchange Rates · Currency Converter",
  charts: "Rate Charts · Currency Converter",
  multi: "Multi-convert · Currency Converter",
};

const isView = (v: string): v is View => (VIEWS as readonly string[]).includes(v);

type Listener = (view: View) => void;
const listeners = new Set<Listener>();
let current: View = "convert";

export function currentView(): View {
  return current;
}

export function onViewChange(fn: Listener): void {
  listeners.add(fn);
  fn(current);
}

export function navigate(view: View): void {
  if (window.location.hash !== `#${view}`) window.location.hash = view;
  else show(view, true);
}

function show(view: View, userNavigation: boolean): void {
  current = view;
  for (const section of document.querySelectorAll<HTMLElement>("[data-view]")) {
    section.hidden = section.dataset.view !== view;
  }
  document.title = TITLES[view];

  if (userNavigation) {
    window.scrollTo({ top: 0, behavior: "instant" });
    // Move focus to the new view's heading so screen readers announce the change.
    document.querySelector<HTMLElement>(`[data-view="${view}"] h1`)?.focus({ preventScroll: true });
  }
  for (const fn of listeners) fn(view);
}

/**
 * Tiny hash router: #convert, #rates, #charts, #multi.
 * Unknown hashes (e.g. the skip link) leave the current view alone.
 */
export function startRouter(): void {
  const fromHash = () => window.location.hash.slice(1);
  const initial = fromHash();
  show(isView(initial) ? initial : "convert", false);

  window.addEventListener("hashchange", () => {
    const next = fromHash();
    if (isView(next)) show(next, true);
  });
}
