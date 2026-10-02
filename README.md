# Currency Converter

Fast, secure currency converter with live exchange rates for 150+ currencies.
Built with **Vite**, **TypeScript** (strict) and **Tailwind CSS v4** — no runtime dependencies.

## Features

- Live rates with automatic fallback across 3 providers (ExchangeRate-API → fawazahmed0 via jsDelivr → Cloudflare mirror)
- Works offline: rates are cached for 1 hour and the last known rates are used when the network is down
- Two-way conversion — type in either field
- Quick picks (AZN, USD, EUR, GBP, RUB) plus a full list of every supported currency
- Swap button, shareable links (`?from=USD&to=AZN&amount=100`), remembers your last choice
- **Four sections** (hash-routed, no page reloads):
  - **Converter** — two-way conversion, quick picks, popular rates
  - **Rates** — every currency against your base, instant search, ★ favorites pinned to the top
  - **Charts** — rate history for any pair (7D / 1M / 3M / 6M / 1Y) with low/high/average, hover tooltip, keyboard support and a data table
  - **Multi-convert** — one amount into many currencies at once, tap to copy, "Copy all"
- Light / dark theme (follows the system by default), glassmorphism UI with Inter font
- Animated navigation with sliding active indicator and icon mobile menu
- "Popular rates" cards — one tap to switch the target currency
- Responsive, keyboard-accessible, screen-reader friendly, respects reduced motion

## Getting started

```bash
npm install
npm run dev        # dev server with hot reload
npm test           # unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

Requires Node.js 20+.

## Project structure

```
├── index.html            # page markup (entry point)
├── public/               # copied as-is: logo, favicon, _headers (security headers)
├── src/
│   ├── main.ts           # bootstraps the app
│   ├── app/              # store (shared state), router (#views), sync (rate refresh)
│   ├── api/rates.ts      # live rate providers, validation, caching, fallback
│   ├── api/history.ts    # daily historical rates for charts
│   ├── core/             # pure logic, no DOM
│   │   ├── money.ts      # parsing, formatting, conversion
│   │   ├── currencies.ts # quick picks, names, ISO code checks
│   │   └── storage.ts    # safe localStorage wrapper
│   ├── ui/               # DOM code
│   │   ├── views/        # rates, charts, multi-convert sections
│   │   ├── chart.ts      # SVG line chart with tooltip
│   │   ├── dom.ts        # safe DOM helpers (no innerHTML)
│   │   ├── converter.ts  # converter widget
│   │   ├── state.ts      # state <-> URL / localStorage
│   │   ├── menu.ts       # nav with sliding indicator + mobile menu
│   │   ├── theme.ts      # dark mode
│   │   └── toast.ts      # toast notifications
│   └── styles/main.css   # Tailwind entry: theme tokens, dark mode, components
├── tests/                # Vitest unit tests
└── vite.config.ts        # build config + CSP injection
```

## Security

- Strict **Content-Security-Policy** injected at build time — only same-origin scripts/styles/fonts; network access limited to the three rate APIs.
- `public/_headers` adds HSTS, `X-Frame-Options`, `frame-ancestors`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` on Netlify / Cloudflare Pages.
- No `innerHTML` anywhere; all text is set through `textContent`.
- Every external input (API responses, URL params, localStorage) is validated before use; API responses are size-limited and requests time out after 8 s.
- Requests are sent without cookies or referrer; fonts are self-hosted (no Google Fonts tracking).
- No runtime npm dependencies; Dependabot and `npm audit` run in CI.

## Deploying

`npm run build` produces a static site in `dist/` that works on any static host (GitHub Pages, Netlify, Cloudflare Pages, Vercel).
On hosts that don't read `_headers`, configure the same headers in the host's settings.

Rates by [ExchangeRate-API](https://www.exchangerate-api.com) and [fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api).
