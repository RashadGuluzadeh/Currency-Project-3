import { isCurrencyCode } from "./currencies";
import { readJson, writeJson } from "./storage";

const KEY = "cc:favorites:v1";
const MAX = 50;

const isCodeList = (v: unknown): v is string[] => Array.isArray(v) && v.length <= MAX && v.every(isCurrencyCode);

let favorites = new Set(readJson(KEY, isCodeList) ?? ["USD", "EUR"]);

export function isFavorite(code: string): boolean {
  return favorites.has(code);
}

export function favoriteCount(): number {
  return favorites.size;
}

/** Toggles a favorite and returns the new state. */
export function toggleFavorite(code: string): boolean {
  if (!isCurrencyCode(code)) return false;
  const next = new Set(favorites);
  if (next.has(code)) next.delete(code);
  else if (next.size < MAX) next.add(code);
  favorites = next;
  writeJson(KEY, [...favorites]);
  return favorites.has(code);
}
