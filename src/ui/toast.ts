let node: HTMLElement | null = null;
let timer: number | undefined;

const HIDDEN = ["opacity-0", "translate-y-3", "pointer-events-none"];

/** Small transient message at the bottom of the screen. */
export function toast(message: string, ms = 2200): void {
  if (!node) {
    node = document.createElement("div");
    node.setAttribute("role", "status");
    node.className =
      "fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white " +
      "shadow-xl shadow-slate-900/20 transition duration-300 dark:bg-white dark:text-slate-900 " +
      HIDDEN.join(" ");
    document.body.append(node);
  }
  const el = node;
  el.textContent = message;
  requestAnimationFrame(() => el.classList.remove(...HIDDEN));
  window.clearTimeout(timer);
  timer = window.setTimeout(() => el.classList.add(...HIDDEN), ms);
}
