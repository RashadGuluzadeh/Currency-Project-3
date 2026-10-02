import { currencyName, currencySymbol } from "../core/currencies";
import { caretFromSignificantCount, formatAmount, sanitizeAmount, significantCharsBefore } from "../core/money";

const SVG_NS = "http://www.w3.org/2000/svg";

export function must<T extends Element>(root: ParentNode, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`Missing element: ${selector}`);
  return node;
}

/** createElement + className + textContent. Never uses innerHTML. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** 24x24 stroke icon from SVG path data. */
export function icon(path: string, className: string): SVGSVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.8,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    class: className,
  });
  svg.append(svgEl("path", { d: path }));
  return svg;
}

export const ICONS = {
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  chevronRight: "m9 6 6 6-6 6",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z",
  close: "M6 6l12 12M18 6 6 18",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
  swap: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
} as const;

/** Font size for a symbol bubble, by glyph count. */
export function symbolSize(symbol: string): string {
  return symbol.length === 1 ? "text-lg" : symbol.length === 2 ? "text-sm" : "text-[10px]";
}

/** Rounded square with the currency symbol ("$", "₼"). */
export function symbolBubble(code: string, className: string): HTMLSpanElement {
  const sym = currencySymbol(code);
  const bubble = el("span", `grid shrink-0 place-items-center font-bold ${symbolSize(sym)} ${className}`, sym);
  bubble.setAttribute("aria-hidden", "true");
  return bubble;
}

export const selectClass =
  "h-11 w-full appearance-none rounded-xl bg-white pr-9 pl-3.5 text-sm font-semibold ring-1 ring-slate-200 transition " +
  "hover:ring-brand-300 focus:ring-2 focus:ring-brand-500 focus:outline-none dark:bg-white/5 dark:ring-white/10 dark:hover:ring-brand-400/40 chip-select";

/** Fills a <select> with every currency in `codes`, keeping `selected` chosen. */
export function fillCurrencySelect(select: HTMLSelectElement, codes: readonly string[], selected: string): void {
  const frag = document.createDocumentFragment();
  const list = codes.includes(selected) ? codes : [selected, ...codes];
  for (const code of list) frag.append(new Option(`${code} — ${currencyName(code)}`, code, false, code === selected));
  select.replaceChildren(frag);
  select.value = selected;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Live-formats a money input ("1234,5" -> "1 234.5") while keeping the caret in place,
 * and reports the sanitized value.
 */
export function bindAmountInput(input: HTMLInputElement, onChange: (clean: string) => void): void {
  input.addEventListener("input", () => {
    const raw = input.value;
    const caretCount = significantCharsBefore(raw, input.selectionStart ?? raw.length);
    const clean = sanitizeAmount(raw);
    const formatted = formatAmount(clean);
    if (formatted !== raw) {
      input.value = formatted;
      const caret = caretFromSignificantCount(formatted, caretCount);
      input.setSelectionRange(caret, caret);
    }
    onChange(clean);
  });
  input.addEventListener("focus", () => input.select());
}
