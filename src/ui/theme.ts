import { readJson, writeJson } from "../core/storage";

type Theme = "light" | "dark";

const THEME_KEY = "cc:theme";
const isTheme = (v: unknown): v is Theme => v === "light" || v === "dark";
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

const current = (): Theme => readJson(THEME_KEY, isTheme) ?? (systemDark.matches ? "dark" : "light");

function apply(button: HTMLButtonElement | null): void {
  const theme = current();
  document.documentElement.dataset.theme = theme;
  button?.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
}

/** Applies the saved (or system) theme as early as possible to avoid a flash. */
export function initTheme(): void {
  apply(null);
}

export function mountThemeToggle(button: HTMLButtonElement): void {
  apply(button);
  button.addEventListener("click", () => {
    writeJson(THEME_KEY, current() === "dark" ? "light" : "dark");
    apply(button);
  });
  systemDark.addEventListener("change", () => apply(button));
}
