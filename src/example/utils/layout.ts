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

@media (max-width: 900px) {
  .admin-body {
    grid-template-columns: 1fr;
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
