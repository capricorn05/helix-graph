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

- **Virtualization** (`VirtualList`, `VirtualGrid`) — framework primitives for windowed rendering (implemented, not yet integrated in example app)
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
- Regenerate compiled TSX views when view source files change: `npm run gen:views`
- Optional pre-commit automation: `npm run hooks:install`

The installed pre-commit hook runs `npm run verify` automatically.

## VS Code TypeScript navigation

If `Ctrl+Click` / `Go to Definition` shows **No definition found**:

1. Open Command Palette and run `TypeScript: Select TypeScript Version` → **Use Workspace Version**.
2. Run `TypeScript: Restart TS Server`.
3. Confirm the active file language mode is **TypeScript** (bottom-right status bar).
4. In Extensions, make sure built-in **TypeScript and JavaScript Language Features** is enabled.

Workspace defaults in this repo now pin the TS SDK (`.vscode/settings.json`) and include
an editor-only TS project for `src/example/views-tsx/*.tsx` (`src/example/views-tsx/tsconfig.json`) so
symbol navigation works consistently in both `.ts` and `.tsx` authoring files.

## Recommended rendering pattern

For new pages, use this default split:

1. **TSX source for shell/layout** (`src/example/views-tsx/*.view.tsx`)
2. **Generated compiled artifact** (`src/example/views/compiled/*.compiled.ts`)
3. **Thin server wrapper** (`src/example/views/*.ts`) that passes dynamic HTML slots/props into `render*CompiledView(...)`

When interaction is high-frequency (paging/sort/filter), add a hybrid data path:

- first load: SSR page HTML
- subsequent updates: JSON endpoint + targeted DOM patch on the client

Reference implementation: Host Listings (`/host-listings`) now follows this pattern.

## End-to-end: add a page in Helix

For the full walkthrough (including troubleshooting), see `END_TO_END_FRAMEWORK_GUIDE.md`.

1. Add a TSX page source in `src/example/views-tsx/your-page.view.tsx`.
2. Generate compiled artifacts with `npm run gen:views`.
3. Add a server wrapper in `src/example/views/your-page.ts` that composes dynamic table/card HTML and calls `renderYourPageCompiledView(...)`.
4. Add/extend page handler logic in `src/example/handlers/pages.handler.ts`.
5. Register route in `src/example/routes/index.ts`.
6. If the page needs incremental updates, add a JSON endpoint in `src/example/handlers/api.handler.ts` and a client module in `src/example/client/*.ts`.
7. If using `data-hx-bind`, export matching handlers from feature modules in `src/example/client/actions-*.ts` (re-exported by `src/example/client/actions.ts`) and run `npm run gen:bindings`.
8. Validate with `npm run build` and `npm run test` (or `npm run verify` before push).

### Quick checklist for hybrid pages

- Keep durable data derivation on the server (resource read + query parsing).
- Keep client updates scoped to stable `data-hx-id` targets.
- Preserve URL state with `pushState` and handle `popstate`.
- Prefer fallback to full navigation when JSON patching fails.

### Binding id + handler convention

- Binding ids are validated at generation time and must match `^[a-z][a-z0-9-]*$`.
- Default handler export mapping is `data-hx-bind="save-user"` → `onSaveUser`.
- App-level overrides (action id, handler name, preventDefault) live in `src/example/shared/client-action-metadata.ts`.
- Event overrides are static-only: `data-hx-event="keydown"` on the same element as `data-hx-bind`.

### TSX escape hatches (current)

- `uncompiledView(() => expr)` emits an HTML patch slot for runtime HTML content.
- `clientOnly(() => import("/client/chunk.js"), props)` emits a client-only placeholder and mounts after resume.
- `data-hx-event` and binding ids are compile-time checked; dynamic values are rejected.

## Project layout

- `src/helix/*` — framework primitives/runtime/SSR helpers
- `src/helix/resume.ts` — reusable resumability bootstrap + delegated event activation
- `src/helix/node-http.ts` — Node adapter helpers (`sendJson`, `readJsonBody`, static file serving)
- `src/helix/tsx-view-compiler.ts` — framework TSX compile core (AST to template/patch descriptors)
- `src/helix/binding-map-compiler.ts` — framework AST scan helpers for binding/list and client-handler extraction
- `src/helix/client-action-metadata.ts` — framework declarative client-action metadata typing + binding event resolution/validation
- `src/helix/compiler-utils.ts` — shared naming helpers and TypeScript source parsing for compiler/codegen modules
- `src/helix/codegen-utils.ts` — shared file discovery and generator entrypoint helpers
- `src/helix/codegen-runner.ts` — shared codegen check/write orchestration and stale-output reconciliation helpers
- `src/helix/codegen-emitters.ts` — reusable generated-module emitters for compiled views and binding maps
- `src/helix/compiled-view-codegen.ts` — reusable compiled-view generation orchestration (scan/compile/emit/check/stale-prune)
- `src/helix/build-guard.ts` — shared module-resolution and AST analysis core for browser-boundary guard scripts
- `src/helix/html.ts` — generic HTML escaping + document shell start/end helpers
- `src/helix/theme.ts` — first-class theme tokens + headless UI base styles
- `src/helix/ui.ts` — framework-native headless HTML helpers (`uiButton`, `uiCard`, `uiInput`, `uiSelect`, `uiTable`)
- `src/helix/components/*` — reusable higher-level UI components built on top of `ui.ts`
- `src/example/server.ts` — streaming SSR server + API/action endpoints
- `src/example/client/bootstrap.ts` — tiny client delegator bootstrap
- `src/example/client/actions-*.ts` — feature-scoped lazy-loaded handlers (`users`, `posts`, `external`, `navigation`, shared helpers)
- `src/example/client/actions.ts` — barrel re-exports consumed by binding-map/runtime chunk resolution
- `src/example/shared/*` — browser-safe modules shared by SSR wrappers and client chunks
- `src/example/shared/client-action-metadata.ts` — app-level declarative client-action metadata manifest consumed by binding-map generation
- `src/example/domain.ts` — in-memory users domain model
- `src/example/scripts/generate-compiled-views.ts` — example-level wrapper that delegates compiled-view codegen orchestration to framework APIs
- `src/example/scripts/generate-binding-map.ts` — example-level wrapper that emits binding maps using framework binding compiler + client-action metadata resolver cores
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

### Headless UI Primitives

Ten framework-agnostic UI primitives with no React dependency:

- **Dialog:** Modal overlay with focus trap, Escape dismiss, optional portal, configurable open display mode
- **Popover:** Non-modal floating panel, positioned relative to trigger, Escape/outside dismiss
- **Menu / Dropdown:** Floating action menus with roving focus and keyboard navigation (Arrow/Home/End)
- **Tabs:** Inline tab interface with arrow-key navigation
- **Tooltip:** Hover/focus-triggered floating hint layer
- **Accordion:** Inline disclosure groups with keyboard navigation between triggers
- **Toast:** Fixed viewport notifications with auto-dismiss support
- **Select:** Button-triggered listbox with keyboard selection
- **Combobox:** Input-driven listbox with client-side filtering

All primitives provide:

- **Dual state API:** `value` / `defaultValue` / `onChange` options plus Helix `Cell<T>` integration where applicable
- **Full ARIA:** Proper roles, attributes, and relationships for accessibility
- **Keyboard-first:** Keyboard navigation built-in; Escape always closes modal layers
- **Framework-free:** Pure TypeScript, no React, uses direct DOM APIs
- **Compiler-aware bindings:** `data-hx-bind` can opt into non-click events with compile-time `data-hx-event`

**Example app integrations:**

- `/primitives` — full interactive showcase for dialog, popover, menu, dropdown, tabs, tooltip, accordion, toast, select, and combobox
- `/search` — combobox suggestions + help popover
- `/settings` — select replacement for page-size + help tooltip
- Primitive controllers are mounted in `src/example/client/primitives-demo.ts` and re-initialized after fragment navigation

**Usage example (dialog):**

```typescript
import { createDialogController } from "@helix/primitives";

const trigger = document.querySelector("#open-btn");
const content = document.querySelector("#dialog-content");

const dialog = createDialogController(trigger, content, {
  defaultValue: false,
  onChange: (isOpen) => console.log("Dialog", isOpen),
  openDisplay: "flex",
});

// Later:
dialog.open();
dialog.close();
dialog.toggle();
```

## Phase 2 Features in Action

### DevTools Inspector

Press `Ctrl+M` in the browser to toggle the in-page inspector panel:

- **Graph tab**: View all reactive nodes (cells, derived, resources, actions) with names, types, and current state
- **Trace tab**: Real-time causality traces showing which scheduler lane triggered each patch, with execution times and affected DOM operations

### Virtualization (VirtualList / VirtualGrid)

**Framework primitive for future use**: `VirtualList` and `VirtualGrid` are implemented in `src/helix/virtualization.ts` and available for windowing large DOM trees. They are not yet integrated into the example app.

Example API usage:

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

**Integration roadmap**: Future versions will automatically wire virtualization into `reconcileKeyed()` for large table/list renders, coordinating with the patch scheduler for smooth scrolling.

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

### Create Post page

The admin nav now includes **New Post** (`/posts/new`) with a server-backed create form.

- Form binding: `data-hx-bind="create-post"`
- Client handler: `onCreatePost` in `src/example/client/actions-navigation.ts` (re-exported by `src/example/client/actions.ts`)
- Server endpoint: `POST /actions/create-post`
- Validation: `validateCreatePostInput` in `src/example/utils/http.ts`
- Data write path: `createPostAction` → `createPost` in `src/example/resources/posts.resource.ts`

After a successful submit, the client navigates back to `/posts?page=1`, and the new post
appears at the top of the posts table.

### External Data Rich page

The admin nav includes **External Data Rich** (`/external-data-rich`) for a higher-density
table rendering scenario.

- Same 10,000-row external dataset and paging flow as `/external-data`
- Adds per-row thumbnail media, additional badges, and heavier conditional row styling
- Uses dedicated client bindings + endpoint (`/api/external-data-rich`) for incremental updates

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

- TSX compiled-view support now includes strict compile-time guardrails and stale-artifact drift detection; unsupported patterns fail fast with file/line diagnostics.
- The TSX subset remains intentionally constrained while deeper graph extraction and chunk planning continue to layer in incrementally.
- React/shadcn component islands are an optional adapter path, not a core Helix requirement.
