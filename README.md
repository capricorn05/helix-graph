# Helix Graph Prototype (v0.1-v0.2 MVP + Phase 2)

This workspace contains a runnable TypeScript prototype of the Helix framework described in `Tech Specs.md`.

## Phase 0.1 (Core Framework)

- unified graph-backed primitives (`cell`, `derived`, `resource`, `action`, `view`)
- patch-first DOM runtime (`setText`, `setAttr`, `toggleClass`, `setValue`, `setChecked`, `setStyle`)
- scheduler lanes (`input`, `animation`, `viewport`, `network`, `idle`) with time-sliced batches
- keyed list reconciliation (`reconcileKeyed`)
- streaming SSR with embedded `GraphSnapshot` + `BindingMap`
- resumable/lazy activation via one event delegator and dynamic `import()` of action chunks

## Phase 2 (Virtualization + Devtools + Forms)

- **Virtualization** (`VirtualList`, `VirtualGrid`) — windowed rendering for large tables/lists
- **DevTools** — in-page graph inspector + causality trace viewer (press `Ctrl+M` to toggle)
- **Form Enhancement** — client-side validation, error patching, optimistic updates with rollback
- example users app with paging, sorting, form validation, and real-time devtools traces

## Run

```bash
npm install
npm run dev
```

Open: `http://localhost:4173`

Health check: `http://localhost:4173/health`

## Validation workflow

- One command before push/PR: `npm run verify`
- Regenerate bindings only when binding ids or client handler exports change: `npm run gen:bindings`
- Optional pre-commit automation: `npm run hooks:install`

The installed pre-commit hook runs `npm run verify` automatically.

## Project layout

- `src/helix/*` — framework primitives/runtime/SSR helpers
- `src/helix/resume.ts` — reusable resumability bootstrap + delegated event activation
- `src/helix/node-http.ts` — Node adapter helpers (`sendJson`, `readJsonBody`, static file serving)
- `src/helix/html.ts` — generic HTML escaping + document shell start/end helpers
- `src/helix/theme.ts` — first-class theme tokens + headless UI base styles
- `src/helix/ui.ts` — framework-native headless HTML helpers (`uiButton`, `uiCard`, `uiInput`, `uiSelect`, `uiTable`)
- `src/helix/components/*` — reusable higher-level UI components built on top of `ui.ts`
- `src/example/server.ts` — streaming SSR server + API/action endpoints
- `src/example/client/bootstrap.ts` — tiny client delegator bootstrap
- `src/example/client/actions.ts` — lazy-loaded handlers (paging/sort/form)
- `src/example/domain.ts` — in-memory users domain model
- `src/example/utils/query.ts` — URL/query parsing for users paging/sorting
- `src/example/utils/layout.ts` — app chrome + app-level layout CSS using Helix theme API

## Headless UI helpers

`src/helix/ui.ts` exposes HTML-first building blocks used by the example app.

### `uiTable` API (short reference)

- Escaped text mode: `headers`, `rows`
- Pre-rendered HTML mode: `headersHtml`, `rowsHtml`
- Per-element attrs: `headerCellAttrs`, `rowAttrs`, `cellAttrs`
- Section attrs: `headAttrs`, `bodyAttrs`
- Table attrs: `className`, `attrs`

This lets pages preserve framework bindings/ids (`data-hx-*`) while still using one shared table helper.

### `uiDataTable` API (column defs + data)

`src/helix/components/table.ts` adds a composable table layer inspired by TanStack-style definitions:

- `columns`: declarative column defs (`id`, `header`, `accessorKey`, `cell`, attrs)
- `data`: typed row array
- row/cell attrs can be generated per row to preserve stable `data-hx-*` targeting

This keeps advanced table composition reusable while still rendering through the same Helix `uiTable` primitive.

## Phase 2 Features in Action

### DevTools Inspector

Press `Ctrl+M` in the browser to toggle the in-page inspector panel:

- **Graph tab**: View all reactive nodes (cells, derived, resources, actions) with names, types, and current state
- **Trace tab**: Real-time causality traces showing which scheduler lane triggered each patch, with execution times and affected DOM operations

### Virtualization (VirtualList / VirtualGrid)

For large lists/tables, use `VirtualList` to window the DOM:

```ts
import { VirtualList } from "./helix/virtualization.js";

const vlist = new VirtualList({
  container: tableBody,
  itemHeight: 40,
  bufferSize: 5,
  onScroll: (window) => {
    const visibleRows = allRows.slice(window.startIndex, window.endIndex);
    // render visibleRows into container
  },
});

vlist.setTotalCount(10000); // tells VirtualList how many items there are
```

### Form Validation

Use `HelixForm` for client-side field validation with error patching:

```ts
import { HelixForm, commonValidators } from "./helix/form.js";

const form = new HelixForm(document.getElementById("user-form"), {
  fields: {
    email: [commonValidators.required, commonValidators.email],
    password: [commonValidators.required, commonValidators.minLength(8)],
  },
  onSubmit: async (data) => {
    const result = await fetch("/api/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return result.json();
  },
});
```

## Example usage of framework primitives

```ts
import { cell, derived, resource, action } from "./helix/index.js";

const page = cell(1, { scope: "view", name: "page" });
const sort = cell<"asc" | "desc">("asc", { scope: "view", name: "sort" });

const label = derived(() => `Page ${page.get()} (${sort.get()})`, {
  name: "pager-label",
});

const usersPage = resource(
  "users-page",
  (ctx: { page: number; sort: "asc" | "desc" }) => [
    "users",
    ctx.page,
    ctx.sort,
  ],
  async (ctx) =>
    fetch(`/api/users?page=${ctx.page}&sortDir=${ctx.sort}`).then((res) =>
      res.json(),
    ),
  {
    where: "server",
    cache: "memory",
    dedupe: "inflight",
    tags: ["users"],
  },
);

const createUser = action(
  "create-user",
  async (input: { name: string; email: string }) => {
    const response = await fetch("/actions/create-user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return response.json();
  },
  {
    where: "server",
    invalidates: ["users"],
    capabilities: ["users:write"],
  },
);
```

## Notes

- This is a focused MVP, not a full TSX compiler yet.
- The architecture is structured so TSX compilation, deeper graph extraction, and chunk planning can be layered in incrementally.
- React/shadcn component islands are an optional adapter path, not a core Helix requirement.
