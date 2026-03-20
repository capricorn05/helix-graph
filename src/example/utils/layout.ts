import { helixShadcnTheme, renderThemeHeadContent } from "../../helix/index.js";

const APP_LAYOUT_CSS = `body {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  margin: 0;
  min-height: 100vh;
  line-height: 1.45;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

a { color: hsl(var(--foreground)); }

h1, h2, h3 { margin: 0 0 0.75rem; letter-spacing: -0.01em; }
p { margin: 0.25rem 0 1rem; color: hsl(var(--muted-foreground)); }

.admin-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.admin-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--card));
}

.admin-brand {
  margin-right: 0.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.admin-topnav,
.admin-sidenav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.admin-body {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 1rem;
  padding: 1rem;
}

.admin-sidebar {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background: hsl(var(--card));
  padding: 0.85rem;
  height: fit-content;
}

.admin-sidebar-title {
  margin: 0 0 0.75rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.86rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.admin-sidenav {
  flex-direction: column;
  align-items: stretch;
}

.admin-core-shell {
  min-width: 0;
}

.admin-core-header {
  margin-bottom: 0.8rem;
}

.admin-core {
  display: grid;
  gap: 0.8rem;
}

.admin-nav-link {
  display: inline-flex;
  align-items: center;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--secondary));
  color: hsl(var(--foreground));
  text-decoration: none;
  font-weight: 500;
  padding: 0.4rem 0.64rem;
  transition: background 120ms ease, border-color 120ms ease;
}

.admin-nav-link:hover { background: hsl(var(--accent)); }

.admin-nav-link.is-active,
.admin-nav-link[aria-current="page"] {
  border-color: hsl(var(--ring));
  background: hsl(var(--accent));
}

.toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }

.primitive-demo-root {
  display: grid;
  gap: 0.8rem;
}

.primitive-surface {
  width: min(360px, 100%);
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  padding: 0.6rem 0.72rem;
}

.primitive-tooltip {
  max-width: 280px;
}

.primitive-listbox {
  width: min(280px, 100%);
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--popover, var(--card)));
  color: hsl(var(--popover-foreground, var(--card-foreground)));
  padding: 0.25rem;
}

.primitive-option {
  display: block;
  width: 100%;
  border: 0;
  border-radius: calc(var(--radius) - 4px);
  background: transparent;
  color: hsl(var(--foreground));
  padding: 0.4rem 0.5rem;
  text-align: left;
  cursor: pointer;
}

.primitive-option:hover,
.primitive-option[data-hx-highlighted="true"] {
  background: hsl(var(--accent));
}

.primitive-option[data-hx-selected="true"] {
  font-weight: 600;
}

.primitive-tabs [data-hx-panel] {
  margin-top: 0.45rem;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  padding: 0.55rem;
}

.primitive-accordion {
  margin-top: 0.75rem;
  display: grid;
  gap: 0.45rem;
}

.primitive-accordion [data-hx-accordion-trigger] {
  width: 100%;
  text-align: left;
}

.primitive-accordion [data-hx-accordion-content] {
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  padding: 0.5rem;
}

.primitive-form-row {
  margin-top: 0.8rem;
  display: grid;
  gap: 0.45rem;
  max-width: 360px;
}

.primitive-select-wrap {
  display: grid;
  gap: 0.35rem;
  max-width: 180px;
}

section {
  margin-bottom: 0.1rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background: hsl(var(--card));
  padding: 1rem;
}

/* Keep generic element styling for non-headless templates while migration is in progress. */
table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  overflow: hidden;
}

th, td {
  border-bottom: 1px solid hsl(var(--border));
  text-align: left;
  padding: 0.55rem;
}

th { background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); font-weight: 600; }
td a { color: hsl(var(--foreground)); text-decoration: none; font-weight: 500; }
td a:hover { text-decoration: underline; }

.excel-grid {
  table-layout: fixed;
}

.excel-grid th,
.excel-grid td {
  min-width: 120px;
}

.grid-sort-btn {
  all: unset;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.grid-sort-indicator {
  color: hsl(var(--muted-foreground));
  font-size: 0.82rem;
}

.grid-sort-btn.is-active .grid-sort-indicator {
  color: hsl(var(--foreground));
}

.excel-grid td[contenteditable="true"] {
  background: hsl(var(--background));
  cursor: text;
}

.excel-grid td[contenteditable="true"]:focus {
  outline: none;
  box-shadow: inset 0 0 0 2px hsl(var(--ring) / 0.35);
  background: hsl(var(--accent));
}

.pager { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin: 0.35rem 0 0; }

form { display: grid; gap: 0.5rem; max-width: 460px; }
label { display: grid; gap: 0.35rem; color: hsl(var(--foreground)); font-weight: 500; }

input, select, textarea {
  width: 100%;
  border: 1px solid hsl(var(--input));
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 0.48rem 0.62rem;
  outline: none;
}

input:focus, select:focus, textarea:focus {
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.25);
  border-color: hsl(var(--ring));
}

button {
  width: fit-content;
  border: 1px solid hsl(var(--primary));
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  padding: 0.48rem 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 120ms ease;
}

button:hover { opacity: 0.92; }
button[disabled] { opacity: 0.45; cursor: not-allowed; }

.error { min-height: 1.25rem; color: hsl(var(--destructive)); margin: 0; }

dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.5rem 1.25rem; }
dt { font-weight: 600; color: hsl(var(--muted-foreground)); }

.status-active  { color: hsl(142 71% 45%); font-weight: 600; }
.status-pending { color: hsl(38 92% 50%); font-weight: 600; }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1rem 0; }
.stat-card { text-align: center; }
.stat-card .hx-card__title,
.stat-card h3 { margin: 0 0 0.5rem; font-size: 0.9rem; color: hsl(var(--muted-foreground)); }
.stat-value { margin: 0; font-size: 2rem; font-weight: 700; color: hsl(var(--foreground)); }

.host-listings-hero p {
  margin-bottom: 0.4rem;
}

.host-listings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.host-listing-card {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background: hsl(var(--card));
  overflow: hidden;
}

.host-listing-card__image {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
  background: hsl(var(--muted));
}

.host-listing-card__image--empty {
  display: grid;
  place-items: center;
  color: hsl(var(--muted-foreground));
  font-weight: 600;
}

.host-listing-card__content {
  display: grid;
  gap: 0.35rem;
  padding: 0.8rem;
}

.host-listing-card__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.6rem;
}

.host-listing-card__title {
  margin: 0;
  font-size: 1rem;
  line-height: 1.25;
}

.host-listing-card__rating {
  white-space: nowrap;
  color: hsl(var(--foreground));
  font-weight: 600;
}

.host-listing-card__meta,
.host-listing-card__description,
.host-listing-card__location,
.host-listing-card__stock {
  margin: 0;
  color: hsl(var(--muted-foreground));
}

.host-listing-card__description {
  min-height: 2.9em;
}

.host-listing-card__price {
  margin: 0;
  color: hsl(var(--foreground));
}

.host-listings-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.host-listings-pager__link.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.host-listings-pager__label,
.host-listings-pager__total {
  color: hsl(var(--muted-foreground));
}

.airbnb-mongo-root {
  display: grid;
  gap: 1rem;
}

.airbnb-mongo-hero {
  position: relative;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  padding: 1.2rem;
  background:
    radial-gradient(circle at 12% 20%, rgb(248 194 145 / 0.46), transparent 46%),
    radial-gradient(circle at 78% 0%, rgb(132 227 224 / 0.32), transparent 42%),
    linear-gradient(125deg, rgb(20 24 33 / 0.96), rgb(38 44 58 / 0.94));
  color: hsl(var(--primary-foreground));
}

.airbnb-mongo-hero::after {
  content: "";
  position: absolute;
  right: -18%;
  bottom: -68%;
  width: 62%;
  aspect-ratio: 1 / 1;
  border-radius: 999px;
  background: linear-gradient(145deg, rgb(255 166 125 / 0.36), rgb(114 206 255 / 0.18));
  pointer-events: none;
}

.airbnb-mongo-hero h2,
.airbnb-mongo-hero p {
  position: relative;
  z-index: 1;
}

.airbnb-mongo-hero h2 {
  font-size: clamp(1.35rem, 2.4vw, 2rem);
  letter-spacing: -0.02em;
  margin-bottom: 0.6rem;
}

.airbnb-mongo-hero p {
  color: rgb(241 246 255 / 0.92);
  max-width: 75ch;
}

.airbnb-mongo-hero strong {
  color: rgb(255 226 180);
}

.airbnb-mongo-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  margin: 0 0 0.7rem;
  border: 1px solid rgb(255 238 216 / 0.38);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.1);
  padding: 0.22rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgb(255 243 218);
}

.airbnb-mongo-panel {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background: hsl(var(--card));
  padding: 0.9rem;
}

.airbnb-mongo-panel--grid {
  background:
    linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%);
}

.airbnb-mongo-controls {
  display: grid;
  gap: 0.7rem;
}

.airbnb-mongo-controls__group {
  display: grid;
  gap: 0.36rem;
}

.airbnb-mongo-controls__group--sort {
  grid-template-columns: minmax(0, 1fr);
}

.airbnb-mongo-controls__label {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: hsl(var(--muted-foreground));
}

.airbnb-mongo-controls__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.44rem;
}

.airbnb-mongo-chip {
  display: inline-flex;
  align-items: center;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background: hsl(var(--secondary));
  color: hsl(var(--foreground));
  text-decoration: none;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.28rem 0.62rem;
  transition:
    transform 150ms ease,
    box-shadow 150ms ease,
    border-color 150ms ease,
    background 150ms ease;
}

.airbnb-mongo-chip:hover {
  transform: translateY(-1px);
  border-color: hsl(var(--ring));
  background: hsl(var(--accent));
  box-shadow: 0 6px 14px rgb(16 20 34 / 0.08);
}

.airbnb-mongo-chip.is-active {
  border-color: hsl(var(--ring));
  background: hsl(var(--accent));
  color: hsl(var(--foreground));
}

.airbnb-mongo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(265px, 1fr));
  gap: 0.95rem;
}

.airbnb-mongo-card {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) + 2px);
  background: hsl(var(--card));
  box-shadow: 0 10px 26px rgb(20 24 34 / 0.06);
  animation: airbnbMongoCardEnter 340ms ease both;
}

.airbnb-mongo-card:nth-child(2n) {
  animation-delay: 40ms;
}

.airbnb-mongo-card:nth-child(3n) {
  animation-delay: 80ms;
}

.airbnb-mongo-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 36px rgb(20 24 34 / 0.12);
}

.airbnb-mongo-card__media {
  position: relative;
  background: hsl(var(--muted));
}

.airbnb-mongo-card__image {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  display: block;
}

.airbnb-mongo-card__image--empty {
  display: grid;
  place-items: center;
  color: hsl(var(--muted-foreground));
  font-weight: 700;
}

.airbnb-mongo-card__market {
  position: absolute;
  left: 0.55rem;
  bottom: 0.55rem;
  border: 1px solid rgb(255 255 255 / 0.45);
  border-radius: 999px;
  background: rgb(15 18 28 / 0.7);
  color: rgb(243 247 255);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.16rem 0.48rem;
  backdrop-filter: blur(3px);
}

.airbnb-mongo-card__content {
  display: grid;
  gap: 0.45rem;
  padding: 0.8rem;
}

.airbnb-mongo-card__header {
  display: grid;
  gap: 0.2rem;
}

.airbnb-mongo-card__title {
  margin: 0;
  font-size: 1.04rem;
  line-height: 1.24;
}

.airbnb-mongo-card__price {
  color: hsl(var(--foreground));
  font-weight: 700;
  font-size: 0.9rem;
}

.airbnb-mongo-card__meta,
.airbnb-mongo-card__summary {
  margin: 0;
  color: hsl(var(--muted-foreground));
}

.airbnb-mongo-card__summary {
  min-height: 3em;
}

.airbnb-mongo-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.36rem;
}

.airbnb-mongo-card__stat {
  display: inline-flex;
  align-items: center;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.12rem 0.46rem;
}

.airbnb-mongo-empty {
  border: 1px dashed hsl(var(--border));
  border-radius: var(--radius);
  background: hsl(var(--background));
  padding: 1.2rem;
  text-align: center;
}

.airbnb-mongo-empty h3 {
  margin-bottom: 0.34rem;
}

.airbnb-mongo-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.airbnb-mongo-pager__link.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.airbnb-mongo-pager__label,
.airbnb-mongo-pager__total,
.airbnb-mongo-pager__source {
  color: hsl(var(--muted-foreground));
}

.airbnb-mongo-pager__source {
  margin-left: auto;
  font-size: 0.78rem;
}

@keyframes airbnbMongoCardEnter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.external-media-table {
  table-layout: fixed;
}

.external-media-table td {
  vertical-align: top;
}

.external-media-table th:nth-child(1),
.external-media-table td:nth-child(1) {
  width: 64px;
}

.external-media-table th:nth-child(2),
.external-media-table td:nth-child(2) {
  width: 126px;
}

.external-media-table th:nth-child(6),
.external-media-table td:nth-child(6),
.external-media-table th:nth-child(7),
.external-media-table td:nth-child(7),
.external-media-table th:nth-child(8),
.external-media-table td:nth-child(8) {
  width: 120px;
}

.external-media-row td {
  transition: background-color 120ms ease;
}

.external-media-row--stock-empty td {
  background: hsl(var(--destructive) / 0.08);
}

.external-media-row--stock-low td {
  background: hsl(var(--secondary) / 0.9);
}

.external-media-row--stock-healthy td {
  background: hsl(var(--background));
}

.external-media-row--price-budget td:nth-child(6) {
  box-shadow: inset 2px 0 0 hsl(var(--primary) / 0.45);
}

.external-media-row--price-premium td:nth-child(6) {
  box-shadow: inset 2px 0 0 hsl(var(--ring));
}

.external-media-row--rating-high td:nth-child(8) {
  box-shadow: inset 2px 0 0 hsl(var(--ring) / 0.6);
}

.external-media-row--rating-low td:nth-child(8) {
  box-shadow: inset 2px 0 0 hsl(var(--destructive) / 0.65);
}

.external-media-row--missing-thumb .external-media-thumb {
  opacity: 0.26;
  filter: grayscale(1);
}

.external-media-preview-cell {
  padding-top: 0.4rem;
}

.external-media-thumb-wrap {
  position: relative;
  width: 96px;
  height: 64px;
}

.external-media-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: calc(var(--radius) - 3px);
  border: 1px solid hsl(var(--border));
  background: hsl(var(--muted));
}

.external-media-thumb-chip {
  position: absolute;
  left: 0.25rem;
  bottom: 0.25rem;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background: hsl(var(--card) / 0.92);
  color: hsl(var(--card-foreground));
  padding: 0.08rem 0.4rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.external-media-thumb-chip--empty {
  border-color: hsl(var(--destructive) / 0.55);
  color: hsl(var(--destructive));
}

.external-media-thumb-chip--low {
  border-color: hsl(var(--ring) / 0.55);
  color: hsl(var(--ring));
}

.external-media-thumb-chip--healthy {
  border-color: hsl(var(--primary) / 0.5);
  color: hsl(var(--primary));
}

.external-media-cell-stack {
  display: grid;
  gap: 0.22rem;
}

.external-media-main {
  font-weight: 600;
  color: hsl(var(--foreground));
}

.external-media-stars {
  color: hsl(var(--muted-foreground));
  font-size: 0.77rem;
  letter-spacing: 0.04em;
}

.external-media-pill {
  width: fit-content;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  padding: 0.08rem 0.42rem;
  font-size: 0.69rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.external-media-pill--budget,
.external-media-pill--healthy,
.external-media-pill--rating-high {
  border-color: hsl(var(--primary) / 0.55);
  color: hsl(var(--primary));
}

.external-media-pill--premium,
.external-media-pill--low,
.external-media-pill--rating-mid {
  border-color: hsl(var(--ring) / 0.55);
  color: hsl(var(--ring));
}

.external-media-pill--empty,
.external-media-pill--rating-low {
  border-color: hsl(var(--destructive) / 0.55);
  color: hsl(var(--destructive));
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.55);
  display: none;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}

.modal-card {
  width: min(760px, 100%);
  max-height: 90vh;
  overflow: auto;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  padding: 1rem;
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
}

.modal-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.modal-grid { display: grid; grid-template-columns: max-content 1fr; gap: 0.4rem 1rem; margin: 1rem 0; }
.modal-thumb { width: 100%; max-height: 260px; object-fit: contain; border: 1px solid hsl(var(--border)); border-radius: var(--radius); }

/* ── Drawer (right-side slide-out panel) ─────────────────── */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.45);
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
  z-index: 1000;
}

.drawer-panel {
  width: 30vw;
  min-width: 320px;
  height: 100%;
  overflow-y: auto;
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border-left: 1px solid hsl(var(--border));
  padding: 1.25rem;
  animation: drawerSlideIn 0.22s ease-out;
}

.drawer-overlay[data-hx-closing="true"] .drawer-panel {
  animation: drawerSlideOut 0.2s ease-in forwards;
}

.drawer-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.drawer-grid { display: grid; grid-template-columns: max-content 1fr; gap: 0.4rem 1rem; margin: 1rem 0; }
.drawer-thumb { width: 100%; max-height: 200px; object-fit: contain; border: 1px solid hsl(var(--border)); border-radius: var(--radius); }

@keyframes drawerSlideIn {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

@keyframes drawerSlideOut {
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
}

@media (max-width: 900px) {
  .admin-body {
    grid-template-columns: 1fr;
  }

  .airbnb-mongo-pager__source {
    width: 100%;
    margin-left: 0;
  }

  .admin-sidebar {
    order: 2;
  }

  .admin-core-shell {
    order: 1;
  }

  .admin-topbar {
    position: static;
  }
}

@media (prefers-reduced-motion: reduce) {
  .airbnb-mongo-chip,
  .airbnb-mongo-card {
    animation: none;
    transition: none;
  }
}`;

const APP_RUNTIME_DIAGNOSTICS_HEAD = `<script>
  window.addEventListener('error', (e) => console.error('Global error:', e.error));
  window.addEventListener('unhandledrejection', (e) => console.error('Unhandled rejection:', e.reason));
</script>`;

export function renderExampleHeadContent(): string {
  return `${renderThemeHeadContent(helixShadcnTheme, { includeHeadlessUi: true })}
<style>
${APP_LAYOUT_CSS}
</style>
${APP_RUNTIME_DIAGNOSTICS_HEAD}`;
}
