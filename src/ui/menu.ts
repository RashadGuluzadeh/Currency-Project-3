import { onViewChange, type View } from "../app/router";
import { ICONS, el, icon } from "./dom";

interface NavItem {
  id: View;
  label: string;
  description: string;
  /** SVG path data, 24x24 stroke icon. */
  icon: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "convert", label: "Converter", description: "Convert between two currencies", icon: ICONS.swap },
  { id: "rates", label: "Rates", description: "All currencies, search & favorites", icon: "M4 6h16M4 12h16M4 18h10" },
  { id: "charts", label: "Charts", description: "Rate history up to one year", icon: "M3 3v18h18M7 15l4-4 3 3 5-6" },
  { id: "multi", label: "Multi-convert", description: "One amount, many currencies", icon: "M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" },
];

export function mountMenu(header: HTMLElement): void {
  const desktopList = header.querySelector<HTMLUListElement>(".desktop-nav ul");
  const indicator = header.querySelector<HTMLElement>(".nav-indicator");
  const mobileNav = header.querySelector<HTMLElement>("#mobile-nav");
  const mobileList = mobileNav?.querySelector<HTMLUListElement>("ul");
  const overlay = header.querySelector<HTMLElement>(".menu-overlay");
  const button = header.querySelector<HTMLButtonElement>(".hamburger");
  if (!desktopList || !indicator || !mobileNav || !mobileList || !overlay || !button) return;

  let active: View = "convert";
  const desktopLinks: HTMLAnchorElement[] = [];
  const mobileLinks: HTMLAnchorElement[] = [];

  // ------------------------------------------------------------- build links

  for (const item of NAV_ITEMS) {
    const li = el("li", "relative");
    const a = el(
      "a",
      "relative z-10 flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-slate-500 transition-colors duration-200 " +
        "hover:text-slate-900 aria-[current=page]:text-brand-700 dark:text-slate-400 dark:hover:text-white dark:aria-[current=page]:text-white",
    );
    a.href = `#${item.id}`;
    a.dataset.id = item.id;
    a.append(icon(item.icon, "size-4 opacity-80"), document.createTextNode(item.label));
    li.append(a);
    desktopList.append(li);
    desktopLinks.push(a);
  }

  NAV_ITEMS.forEach((item, i) => {
    const li = el(
      "li",
      "translate-y-1 opacity-0 transition duration-300 group-data-[open=true]:translate-y-0 group-data-[open=true]:opacity-100",
    );
    li.style.transitionDelay = `${60 + i * 40}ms`;
    const a = el(
      "a",
      "group/link flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-slate-100 aria-[current=page]:bg-brand-50 dark:hover:bg-white/5 dark:aria-[current=page]:bg-brand-500/15",
    );
    a.href = `#${item.id}`;
    a.dataset.id = item.id;

    const tile = el(
      "span",
      "grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 transition group-hover/link:bg-white group-hover/link:text-brand-600 " +
        "group-aria-[current=page]/link:bg-brand-600 group-aria-[current=page]/link:text-white dark:bg-white/5 dark:text-slate-300",
    );
    tile.append(icon(item.icon, "size-5"));

    const text = el("span", "min-w-0 flex-1");
    text.append(
      el("span", "block text-sm font-semibold text-slate-900 dark:text-white", item.label),
      el("span", "block truncate text-xs text-slate-500 dark:text-slate-400", item.description),
    );

    a.append(tile, text, icon(ICONS.chevronRight, "size-4 text-slate-300 transition group-hover/link:translate-x-0.5 group-hover/link:text-brand-500"));
    li.append(a);
    mobileList.append(li);
    mobileLinks.push(a);
  });

  // -------------------------------------------------------- sliding indicator

  const linkFor = (id: string) => desktopLinks.find((a) => a.dataset.id === id) ?? null;

  function moveIndicator(target: HTMLElement | null): void {
    // Measure the <li>: links sit inside position:relative items, so their own offsetLeft is always 0.
    const item = target?.parentElement;
    if (!item || !indicator) return;
    indicator.style.width = `${item.offsetWidth}px`;
    indicator.style.transform = `translateX(${item.offsetLeft}px)`;
    indicator.style.opacity = "1";
  }

  function setActive(id: View): void {
    active = id;
    for (const a of [...desktopLinks, ...mobileLinks]) {
      if (a.dataset.id === id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    moveIndicator(linkFor(id));
  }

  desktopList.addEventListener("pointerover", (e) => {
    const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[data-id]") : null;
    if (a) moveIndicator(a);
  });
  desktopList.addEventListener("pointerleave", () => moveIndicator(linkFor(active)));
  desktopList.addEventListener("focusin", (e) => {
    if (e.target instanceof HTMLAnchorElement) moveIndicator(e.target);
  });
  desktopList.addEventListener("focusout", () => moveIndicator(linkFor(active)));

  // -------------------------------------------------------------- mobile menu

  const isOpen = () => button.getAttribute("aria-expanded") === "true";

  function setOpen(open: boolean, { restoreFocus = false } = {}): void {
    button!.setAttribute("aria-expanded", String(open));
    button!.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobileNav!.dataset.open = String(open);
    overlay!.dataset.open = String(open);
    document.documentElement.classList.toggle("overflow-hidden", open);
    if (open) mobileLinks.find((a) => a.dataset.id === active)?.focus({ preventScroll: true });
    else if (restoreFocus) button!.focus();
  }

  button.addEventListener("click", () => setOpen(!isOpen()));
  overlay.addEventListener("click", () => setOpen(false));
  mobileList.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) setOpen(false, { restoreFocus: true });
  });

  window.matchMedia("(min-width: 1024px)").addEventListener("change", (e) => {
    if (e.matches) setOpen(false);
    moveIndicator(linkFor(active));
  });
  window.addEventListener("resize", () => moveIndicator(linkFor(active)));
  // Widths change once the web font loads.
  void document.fonts?.ready.then(() => moveIndicator(linkFor(active)));

  // The router owns navigation; the menu just reflects it.
  onViewChange(setActive);
}
