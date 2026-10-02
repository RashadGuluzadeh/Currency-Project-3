/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

/** Only hosts the app is allowed to talk to. Keep in sync with src/api/rates.ts. */
const API_ORIGINS = ["https://open.er-api.com", "https://cdn.jsdelivr.net", "https://*.currency-api.pages.dev"];

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  `connect-src 'self' ${API_ORIGINS.join(" ")}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Injects a strict Content-Security-Policy into the production HTML.
 * Not applied in dev, because Vite's HMR relies on inline styles and websockets.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: "inject-csp",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" },
    ],
  };
}

export default defineConfig({
  // Relative base so the build works on GitHub Pages sub-paths and any static host.
  base: "./",
  plugins: [tailwindcss(), contentSecurityPolicy()],
  build: {
    target: "es2022",
    sourcemap: false,
    // Keep assets as files so CSP 'self' covers them.
    assetsInlineLimit: 0,
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
