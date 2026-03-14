# Helix – Next Steps

## Immediate fixes (this sprint)

Status update (2026-03-11): ✅ Items 1–3 completed.

### 1. Fix the graph edge direction bug ✅ Completed (2026-03-11)

In `src/helix/reactive.ts` edges are recorded as `from: derived, to: cell` (labeled `dependsOn`).
In `src/helix/graph.ts`, `getDependents(nodeId)` follows _outgoing_ edges (`from === nodeId`).
When you call `getDependents(cellId)` nothing is found because the cell is always on the `to` side.
The names `getDependents` and `getDependencies` are effectively swapped.

**Fix either the edge direction or the method names** before anything else builds on top of the graph.

Delivered: dependency edges now record `source -> derived`, so `getDependents(source)` and `getDependencies(derived)` return correct results.

---

### 2. Honor `revalidateMs` and `idempotency` ✅ Completed (2026-03-11)

Both are defined in types, set in example code, and **silently ignored** at runtime.

- `revalidateMs` in `src/helix/resource.ts` — should trigger a background re-fetch when a
  fresh cache hit falls within the revalidation window (stale-while-revalidate pattern).
- `idempotency` in `src/helix/action.ts` — should deduplicate inflight requests with the
  same key rather than firing multiple concurrent mutations.

Ignoring declared policy options erodes trust in the entire model.

Delivered: `revalidateMs` now performs background stale-while-revalidate refreshes, and `idempotency` now deduplicates inflight action runs by idempotency key.

---

### 3. Add a test layer ✅ Completed (2026-03-11)

There are **zero tests**. The bench in `src/bench/index.ts` catches router and reactive
performance regressions but nothing else.

Minimum coverage needed:

| Module          | What to test                                               |
| --------------- | ---------------------------------------------------------- |
| `reactive.ts`   | `cell`/`derived` propagation, batching, dirty marking      |
| `reconciler.ts` | keyed insert / remove / move correctness                   |
| `patch.ts`      | each `PatchOp` variant, target-not-found throws            |
| `resource.ts`   | cache hit, stale eviction, tag invalidation, deduplication |
| `router.ts`     | static, param, and wildcard route matching                 |

Delivered: baseline Node test suite added for all listed modules and passing (`npm test`: 13 passing).

---

## Near-term (next few weeks)

Status update (2026-03-11): ✅ Items 4–6 completed.

### 4. Code-generate the BindingMap ✅ Completed (2026-03-11)

The `BindingMap` in `src/example/views/users.view.ts` must be kept in sync by hand with every
`data-hx-bind` attribute in HTML and every export in `src/example/client/actions.ts`.
This is fragile and error-prone.

**Add a small codegen script** that:

1. Scans all view files for `data-hx-bind="<id>"` occurrences.
2. Scans all client action files for exported handler functions.
3. Emits a typed `BindingMap` automatically.

This would cut most of the bookkeeping overhead and make the model feel coherent.

Delivered: added `src/example/scripts/generate-binding-map.ts`, generated `src/example/views/binding-map.generated.ts`, and wired `npm run gen:bindings`.

---

### 5. Wire invalidation through the graph edges ✅ Completed (2026-03-11)

`invalidateResourcesByTags` in `src/helix/resource.ts` is a flat walk of the resource registry.
Actions record `invalidates` metadata as graph nodes, but `action.run()` calls the flat registry
walk directly — the graph edges are never consulted.

**Wire the actual `UnifiedGraph` into the invalidation path** so that:

- The graph drives which resources are invalidated after an action.
- DevTools can show real propagation paths instead of just node lists.

This is the change that makes the "unified causal graph" claim true.

Delivered: actions now connect `invalidates` edges to matching `ResourceNode`s and invalidate resources via graph dependents (`action.ts` + `resource.ts`).

---

### 6. Client state as live reactive cells ✅ Completed (2026-03-11)

The client currently resumes into a plain mutable object in `src/example/client/runtime.ts`.
Every action handler manually mutates `runtime.state` and calls `schedulePatchBatch`.

**Replace with live `cell`/`derived` primitives**:

- One `cell<UsersClientState>` per page scope.
- `derived` nodes for computed values (label text, button disabled states, etc.).
- Let the reactive scheduler drive re-patching automatically instead of hand-wiring it in
  every handler.

This would dramatically reduce the boilerplate in `src/example/client/actions.ts`.

Delivered: runtime state now uses live cells/derived state not just for users paging/sort, but also for posts paging metadata, external-data paging metadata, external detail modal visibility/content formatting, and create-user form status/error/disabled flows. Remaining manual state patch paths in `src/example/client/actions.ts` were migrated to reactive subscriptions.

---

## Medium-term (the actual moat)

Status update (2026-03-13): 🚧 Item 7 MVP delivered, ✅ Item 8 completed, ✅ Item 9 completed.

### 7. View compiler – TSX to patches 🚧 MVP delivered (2026-03-11)

The `view()` primitive is currently just a typed string function. The spec promises compile-time
TSX → DOM fragments + patch tables with no VDOM diff.

**Build the compiler**:

1. Walk TSX, identify static vs dynamic slots.
2. Emit a stable string template for the static shell (SSR).
3. Emit a `BindingMap` + patch table for the dynamic slots (client activation).
4. Eliminate the hand-authored `data-hx-id` / `data-hx-bind` coordination entirely.

This is months of work but it is the feature that makes ergonomics viable at scale and
differentiates Helix from "just another SSR framework with some HTMX-style tricks".

Delivered (MVP): added a TSX compiler path that generates compiled view artifacts with a static
template shell, dynamic patch descriptors, and inferred binding maps. Added
`src/example/scripts/generate-compiled-views.ts`, `src/helix/view-compiler.ts`, TSX source views
in `src/example/views-tsx/*.view.tsx`, and generated compiled page artifacts in
`src/example/views/compiled/*.compiled.ts` (currently 12 files checked in verify).
Integrated compiled rendering across all admin pages (Users, Dashboard, Reports, External Data,
Posts, Search, Settings, About), plus user detail/edit route pages, with verify-time drift
checks (`npm run gen:views` and
`node dist/example/scripts/generate-compiled-views.js --check`).

---

### 8. Enforce `where` placement at build time ✅ Completed (2026-03-11)

`ResourcePolicy.where` and `ActionPolicy.where` are declared but never enforced.
A `where: "server"` resource can be called from a client bundle without any error.

**Add enforcement**:

- Build-time: the compiler (or a lint rule) should reject client imports of server-only resources.
- Runtime: a guard in `resource.read()` that throws if `where === "server"` and
  `typeof window !== "undefined"`.

This hardens the concurrency model and gives DevTools something meaningful to report.

Delivered: runtime placement enforcement now guards `resource.read()` and `action.run()` based on
policy `where` and active runtime placement (`src/helix/placement.ts`, `src/helix/resource.ts`,
`src/helix/action.ts`). Added static boundary checks via `scripts/check-where-boundaries.mjs`
and wired into `npm run verify`, plus regression tests in `src/tests/resource.test.ts` and
`src/tests/action.test.ts`.

---

### 9. Document the recommended page pattern + end-to-end flow ✅ Completed (2026-03-13)

The project had strong implementation patterns but lacked a concise, repo-specific
"how to build a page end-to-end" guide.

Delivered:

- Added recommended pattern docs (compiled TSX shell + server wrapper + optional hybrid JSON updates)
  in `README.md`.
- Added practical architecture guidance in `ARCHITECTURE_ROADMAP.md`.
- Improved formatting/readability across `Tech Specs.md` and kept section content intact.
- Added dedicated end-to-end implementation guide in `END_TO_END_FRAMEWORK_GUIDE.md`
  (resource → action → route → view → binding → client flow + troubleshooting matrix).
- Migrated Host Listings to the compiled-shell pattern (`views-tsx` + generated compiled view + wrapper)
  while keeping hybrid JSON paging behavior.

---

### 10. Add high-density external table perf scenario ✅ Completed (2026-03-14)

Delivered:

- Added `/external-data-rich` page with the same external products table flow plus row-level media,
  richer conditional formatting, and additional per-cell visual states.
- Added dedicated API and client binding path (`/api/external-data-rich`) to keep paging updates
  incremental under heavier row rendering load.

Follow-up:

- Add a repeatable benchmark case comparing patch/update latency between `/external-data` and
  `/external-data-rich` and capture results in `src/bench/index.ts` output.

---

## Priority order (shortest path to a defensible foundation)

```
1. ✅ Fix graph edge direction bug
2. ✅ Add tests
3. ✅ Honor revalidateMs + idempotency
4. ✅ Code-generate the BindingMap
5. ✅ Wire invalidation through graph edges
6. ✅ Client state as live reactive cells
7. 🚧 View compiler (TSX → patches) — MVP delivered
8. ✅ Enforce `where` placement
9. ✅ Document recommended page pattern + end-to-end flow
10. ✅ Add high-density external table perf scenario
```

Steps 1–6 are all tractable without a compiler and together turn the prototype into something
with a sound foundation. Steps 7–8 are where the framework becomes genuinely differentiated.
