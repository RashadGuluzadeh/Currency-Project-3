import "@fontsource-variable/inter/wght.css";
import "./styles/main.css";

import { startRouter } from "./app/router";
import { startSync } from "./app/sync";
import { mountConverter } from "./ui/converter";
import { mountMenu } from "./ui/menu";
import { initTheme, mountThemeToggle } from "./ui/theme";
import { mountChartsView } from "./ui/views/charts";
import { mountMultiView } from "./ui/views/multi";
import { mountRatesView } from "./ui/views/rates";

initTheme();

const view = (name: string) => document.querySelector<HTMLElement>(`[data-view="${name}"]`);

const convertView = view("convert");
const ratesView = view("rates");
const chartsView = view("charts");
const multiView = view("multi");
const header = document.querySelector<HTMLElement>(".site-header");
const themeToggle = document.querySelector<HTMLButtonElement>(".theme-toggle");

if (themeToggle) mountThemeToggle(themeToggle);
if (convertView) mountConverter(convertView);
if (ratesView) mountRatesView(ratesView);
if (chartsView) mountChartsView(chartsView);
if (multiView) mountMultiView(multiView);
if (header) mountMenu(header);

startRouter();
startSync();
