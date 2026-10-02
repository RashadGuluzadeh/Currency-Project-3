import type { Point } from "../api/history";
import { el, svgEl } from "./dom";

interface ChartOptions {
  formatValue: (v: number) => string;
  formatDate: (date: string, long: boolean) => string;
}

const PAD = { top: 16, right: 64, bottom: 30, left: 8 };

/** 1-2-5 "nice" step for roughly `count` intervals. */
export function niceStep(span: number, count = 4): number {
  if (!(span > 0)) return 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
}

const dayMs = (date: string) => Date.parse(`${date}T00:00:00Z`);

/**
 * Single-series line chart (no legend needed — the heading names the pair).
 * Thin 2px line, faint area, recessive grid, crosshair + tooltip on hover/keyboard.
 */
export function createLineChart(container: HTMLElement, opts: ChartOptions) {
  let points: Point[] = [];
  let active = -1;
  let animate = false;

  const svg = svgEl("svg", { class: "block size-full overflow-visible", role: "img" });
  const tooltip = el(
    "div",
    "pointer-events-none absolute top-0 left-0 z-10 hidden min-w-28 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-xl dark:bg-white dark:text-slate-900",
  );
  const tipDate = el("p", "text-slate-300 dark:text-slate-500");
  const tipValue = el("p", "mt-0.5 text-sm font-semibold tabular-nums");
  tooltip.append(tipDate, tipValue);
  container.append(svg, tooltip);

  container.tabIndex = 0;
  container.classList.add("focus-visible:rounded-xl");

  // Geometry of the last render, used by hover handling.
  let xs: number[] = [];
  let ys: number[] = [];

  function render(): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    if (points.length < 2 || w === 0) return;

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min || max * 0.01) * 0.12;
    const step = niceStep(max - min + pad * 2);
    const lo = Math.floor((min - pad) / step) * step;
    const hi = Math.ceil((max + pad) / step) * step;

    const t0 = dayMs(points[0]!.date);
    const t1 = dayMs(points[points.length - 1]!.date);
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;
    const x = (date: string) => PAD.left + ((dayMs(date) - t0) / (t1 - t0 || 1)) * plotW;
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * plotH;

    xs = points.map((p) => x(p.date));
    ys = points.map((p) => y(p.value));

    // Grid + y labels (recessive).
    const grid = svgEl("g", { class: "text-slate-200 dark:text-white/[0.08]" });
    const yLabels = svgEl("g", { class: "fill-slate-400 text-[11px] tabular-nums dark:fill-slate-500" });
    for (let v = lo; v <= hi + step / 2; v += step) {
      const gy = y(v);
      grid.append(svgEl("line", { x1: PAD.left, x2: w - PAD.right, y1: gy, y2: gy, stroke: "currentColor", "stroke-width": 1 }));
      const label = svgEl("text", { x: w - PAD.right + 10, y: gy, "dominant-baseline": "middle" });
      label.textContent = opts.formatValue(v);
      yLabels.append(label);
    }

    // X labels: first, last and up to 3 in between.
    const xLabels = svgEl("g", { class: "fill-slate-400 text-[11px] dark:fill-slate-500" });
    const ticks = 4;
    const used = new Set<number>();
    for (let i = 0; i <= ticks; i++) {
      const idx = Math.round((i / ticks) * (points.length - 1));
      if (used.has(idx)) continue;
      used.add(idx);
      const anchor = i === 0 ? "start" : i === ticks ? "end" : "middle";
      const label = svgEl("text", { x: xs[idx]!, y: h - 8, "text-anchor": anchor });
      label.textContent = opts.formatDate(points[idx]!.date, false);
      xLabels.append(label);
    }

    // Line + area.
    const series = svgEl("g", { class: "text-brand-600 dark:text-brand-400" });
    const gradId = "chart-area-gradient";
    const defs = svgEl("defs");
    const grad = svgEl("linearGradient", { id: gradId, x1: 0, x2: 0, y1: 0, y2: 1 });
    grad.append(
      svgEl("stop", { offset: "0%", "stop-color": "currentColor", "stop-opacity": 0.22 }),
      svgEl("stop", { offset: "100%", "stop-color": "currentColor", "stop-opacity": 0 }),
    );
    defs.append(grad);
    series.append(defs);

    const line = xs.map((px, i) => `${i ? "L" : "M"}${px.toFixed(1)},${ys[i]!.toFixed(1)}`).join("");
    const baseY = PAD.top + plotH;
    series.append(svgEl("path", { d: `${line}L${xs.at(-1)!.toFixed(1)},${baseY}L${xs[0]!.toFixed(1)},${baseY}Z`, fill: `url(#${gradId})` }));
    const path = svgEl("path", {
      d: line,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
      pathLength: 1,
    });
    series.append(path);

    // Last-value marker with a surface ring.
    series.append(
      svgEl("circle", {
        cx: xs.at(-1)!,
        cy: ys.at(-1)!,
        r: 4.5,
        fill: "currentColor",
        class: "stroke-white dark:stroke-slate-900",
        "stroke-width": 2,
      }),
    );

    // Hover layer.
    const hover = svgEl("g", { class: "chart-hover", visibility: "hidden" });
    hover.append(
      svgEl("line", { class: "chart-cross text-slate-300 dark:text-white/20", y1: PAD.top, y2: baseY, stroke: "currentColor", "stroke-dasharray": "3 3" }),
      svgEl("circle", { class: "chart-dot text-brand-600 stroke-white dark:text-brand-400 dark:stroke-slate-900", r: 5.5, fill: "currentColor", "stroke-width": 2 }),
    );

    svg.append(grid, xLabels, yLabels, series, hover);

    if (animate) {
      animate = false;
      path.style.strokeDasharray = "1";
      path.style.strokeDashoffset = "1";
      requestAnimationFrame(() => {
        path.style.transition = "stroke-dashoffset 0.9s cubic-bezier(0.2, 0.8, 0.2, 1)";
        path.style.strokeDashoffset = "0";
      });
    }
    if (active >= 0) show(active);
  }

  function show(i: number): void {
    const hover = svg.querySelector<SVGGElement>(".chart-hover");
    const p = points[i];
    if (!hover || !p || xs[i] === undefined) return;
    active = i;
    const px = xs[i]!;
    const py = ys[i]!;
    hover.setAttribute("visibility", "visible");
    hover.querySelector(".chart-cross")?.setAttribute("x1", String(px));
    hover.querySelector(".chart-cross")?.setAttribute("x2", String(px));
    hover.querySelector(".chart-dot")?.setAttribute("cx", String(px));
    hover.querySelector(".chart-dot")?.setAttribute("cy", String(py));

    tipDate.textContent = opts.formatDate(p.date, true);
    tipValue.textContent = opts.formatValue(p.value);
    tooltip.classList.remove("hidden");
    const tw = tooltip.offsetWidth;
    const left = Math.min(Math.max(px - tw / 2, 0), container.clientWidth - tw);
    const top = Math.max(py - tooltip.offsetHeight - 14, 0);
    tooltip.style.transform = `translate(${left}px, ${top}px)`;
  }

  function hide(): void {
    active = -1;
    svg.querySelector(".chart-hover")?.setAttribute("visibility", "hidden");
    tooltip.classList.add("hidden");
  }

  function nearest(clientX: number): number {
    const rect = svg.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i]! - px) < Math.abs(xs[best]! - px)) best = i;
    return best;
  }

  svg.addEventListener("pointermove", (e) => points.length && show(nearest(e.clientX)));
  svg.addEventListener("pointerdown", (e) => points.length && show(nearest(e.clientX)));
  svg.addEventListener("pointerleave", hide);
  container.addEventListener("focus", () => points.length && show(points.length - 1));
  container.addEventListener("blur", hide);
  container.addEventListener("keydown", (e) => {
    if (!points.length) return;
    const last = points.length - 1;
    const map: Record<string, number> = {
      ArrowLeft: Math.max((active < 0 ? last : active) - 1, 0),
      ArrowRight: Math.min((active < 0 ? last : active) + 1, last),
      Home: 0,
      End: last,
    };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    show(next);
  });

  new ResizeObserver(() => render()).observe(container);

  return {
    setData(next: Point[], label: string): void {
      points = next;
      active = -1;
      animate = true;
      svg.setAttribute("aria-label", label);
      hide();
      render();
    },
  };
}
