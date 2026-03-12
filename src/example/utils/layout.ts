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
