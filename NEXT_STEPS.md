# Helix – Next Steps

## Status update (2026-03-20, endpoint tests + keyboard reorder)

✅ Completed in this pass:

- Added `src/tests/api-endpoints.test.ts` with 15 focused handler tests:
  - 5 tests for `GET /api/users/suggest` (match, no-match, empty query, ≤8 cap, email match)
  - 7 tests for `POST /actions/reorder-posts` (missing/empty rowIds, negative id, float id, wrong page ids, valid reorder, missing page defaults to 1)
  - 3 tests for `GET /api/invalidation-stream` (SSE headers + connected comment, client removal on close, invalidation fanout via mutation trigger)
- Added `setPostsStoreForTests(rows)` helper to `src/example/resources/posts.resource.ts` so reorder tests can seed known data without triggering a network fetch.
- Added keyboard-accessible ▲/▼ reorder buttons to each posts table row (`src/example/views/posts.ts`): `data-reorder-dir` + `data-post-id` + `aria-label`.
- Wired delegated `click` handler in `src/example/client/posts-reorder.ts` to intercept button clicks, move the item ±1 in the order cell, then commit/rollback via the existing `createDragReorder` controller.
- Validated: **216/216 tests passing**.

Open follow-ups from this pass: _(none)_

## Status update (2026-03-20, interaction primitives integrated end-to-end)

✅ Completed in this pass:

- Wired `createFormState(...)` into the concrete Users create flow (`src/example/client/actions-users.ts`) with reactive touched/error/server-error handling.
- Wired lazy client-only activation into default resume behavior (`src/helix/resume.ts`) using `createVisibilityTrigger(...)` and `createIdleTrigger(...)`.
- Added example server-pushed invalidation wiring:
  - SSE endpoint: `GET /api/invalidation-stream`
  - bootstrap channel install: `createInvalidationChannel({ type: "sse", ... })`
  - mutation broadcasts for users/posts actions.
- Added autocomplete integration on `/search` backed by `GET /api/users/suggest`.
- Added drag reorder integration on `/posts` backed by `POST /actions/reorder-posts` with optimistic commit/rollback behavior.
- Registered all new routes and regenerated artifacts (`gen:views`, `gen:bindings`).
- Validated end-to-end with `npm run test` (**201/201 passing**).

Open follow-ups from this pass:

- [x] ✅ Add focused route/handler tests for `/api/users/suggest`, `/actions/reorder-posts`, and `/api/invalidation-stream` behavior.
- [x] ✅ Add keyboard-accessible reorder controls to complement pointer drag/drop on the posts table.

## Status update (2026-03-19, dotenv-based env workflow)

✅ Completed in this pass:

- Added `dotenv` dependency and a shared loader module: `src/example/env.ts`.
- Wired automatic `.env` loading into both server entrypoints:
  - `src/example/server.ts`
  - `src/example/server-dev.ts`
- Added `.env.example` template for Mongo + port settings.
- Updated `README.md` run instructions to use `.env` instead of manual shell exports.

Open follow-ups from this pass:

- [ ] Investigate/clean up editor-only diagnostics drift where VS Code Problems reports unresolved `.js` import paths even when `npm run build` succeeds.

## Code-Doc Alignment Audit (2026-03-17)

The framework is mature enough to audit documentation against implementation. Here's the full status:

### Verified Claims (Documentation Accurate)

| Claim                                         | Location                                    | Status      | Notes                                                                                   |
| --------------------------------------------- | ------------------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| Escape hatches implemented                    | README §TSX escape hatches, Tech Specs §6.3 | ✅ ACCURATE | `uncompiledView` and `clientOnly` both implemented with compiler tests                  |
| Graph nodes (ViewNode, RouteNode, EffectNode) | Tech Specs §7.1                             | ✅ ACCURATE | All three node types created and used in graph (router.ts, view.ts, devtools.ts)        |
| Graph edges drive invalidation                | ARCHITECTURE_ROADMAP                        | ✅ ACCURATE | Actions connect to ResourceNodes via graph; `getDependents()` used in invalidation path |
| Binding convention documented                 | README Binding id + handler convention      | ✅ ACCURATE | Format, validation pattern, mapping rules, event overrides all documented               |
| DevTools causality traces                     | README Phase 2                              | ✅ ACCURATE | Traces recorded, displayed, and tab-switchable in devtools panel                        |
| Hot-reload dev tool                           | NEXT_STEPS §7                               | ✅ ACCURATE | Implemented with file watcher + polling endpoint + npm script                           |
| SSR & Resume benchmarks                       | NEXT_STEPS §8                               | ✅ ACCURATE | Three benchmarks integrated, results formatted, npm script added                        |

### Documentation Gaps (Fixed in this audit)

| Issue                                        | Location             | Status   | Fix                                                                                     |
| -------------------------------------------- | -------------------- | -------- | --------------------------------------------------------------------------------------- |
| Compiled view schema outdated                | Tech Specs §8.1      | ✅ FIXED | Updated to match actual artifact format (template + patches + bindingMap, no targetMap) |
| Binding convention missing from ARCHITECTURE | ARCHITECTURE_ROADMAP | ✅ FIXED | Added convention details alongside binding-based delegation description                 |
| Virtualization status ambiguous              | README Phase 2       | ✅ FIXED | Clarified: primitives exist but not integrated in example; added API reference section  |

### Accurate Status Summary

The framework implementation and documentation are **well-aligned overall**:

- ✅ 7 major claims verified as accurate
- ✅ 3 documentation gaps identified and corrected
- ✅ No "silent failures" where features are missing but docs claim completion
- ✅ Graph unification actually wired and tested
- ✅ Type safety achieved; no `any` in public APIs
- ✅ All tests passing (currently 98)

**Production readiness**: Core is solid. Optional enhancements (Phase 3 islands, advanced virtualization integration) remain future work per Design.

---

## Status update (2026-03-19, Airbnb Mongo page with sample dataset integration)

✅ Completed in this pass:

- Added a new admin route and page: `/airbnb-mongo`.
- Implemented a MongoDB-backed resource (`src/example/resources/mongo-airbnb.resource.ts`) that reads from `sample_airbnb.listingsAndReviews` when `MONGODB_URI` is configured.
- Added robust query handling and UI filters (market, room type, max price, min guests) with paging/sorting support.
- Added SSR + hybrid incremental update flow with dedicated API route (`/api/airbnb-mongo`) and client navigation enhancement module (`src/example/client/mongo-airbnb.ts`).
- Added an offline curated fallback dataset so the page remains fully functional when MongoDB is unavailable.
- Added targeted tests in `src/tests/mongo-airbnb.test.ts` for query parsing, href state serialization, and offline fallback behavior.
- Updated navigation, layout styling, and generated artifacts (`gen:views`, `gen:bindings`) to include the new page.

Open follow-ups from this pass:

- [ ] Add optional integration coverage for real MongoDB environments (for example, gated by env vars in CI) to validate live Atlas query compatibility beyond offline fallback tests.

---

## Status update (2026-03-19, system usage documentation pass)

✅ Completed in this pass:

- Added `docs/system-usage-guide.md` with a user-focused usage guide for the example application.
- Added `docs/documentation-gaps.md` to separate confirmed behavior from inferred behavior and implementation gaps.
- Audited the example app routes, handlers, client modules, resources, and selected tests to ground the guide in code.

Open follow-ups from this pass:

- [ ] Decide whether `/users/:id/edit` should redirect or return HTML after save instead of leaving the user on a JSON API response.
- [ ] Resolve the `/external-data` copy mismatch that says the page shows 30 rows per page while the implementation uses 100.
- [ ] Decide whether Search and Settings should remain demo-only pages or be completed as fully functional workflows.
- [ ] Decide whether delete and activate user APIs should have visible admin UI controls.
- [ ] Clarify the intended authentication and authorization model if this example app will be used beyond framework demos.

---

## Status update (2026-03-19, reactive lifecycle + scheduling hardening)

✅ Completed in this pass:

- Fixed stale dependency edge accumulation in `src/helix/reactive.ts` by reconciling `dependsOn` edges on recompute (unsubscribe + `runtimeGraph.removeEdge(...)`).
- Added mutable graph cleanup support in `src/helix/graph.ts` via `removeEdge(...)` and `removeNode(...)`.
- Added derived equality support (`DerivedOptions.equals`) so unchanged recomputations suppress downstream subscriber emissions.
- Added first-pass lifecycle ownership/disposal primitives:
  - `createReactiveScope(...)` with `dispose()` and `onDispose(...)`
  - `owner` support in `CellOptions` / `DerivedOptions`
  - `dispose()` + `disposed` on cells/derived and graph `owns` edge cleanup
- Added core `batch(() => ...)` support in `reactive.ts` and coalesced per-source cell emissions to latest value in the flush turn.
- Reduced split scheduling by routing runtime microtask patch flushes through the shared reactive task queue (`scheduleReactiveTask`) in `client-reactivity.ts`.
- Added/expanded regression coverage:
  - `src/tests/reactive.test.ts` (edge reconciliation, derived-equality suppression, batch semantics, scope disposal)
  - `src/tests/client-reactivity.test.ts` (shared microtask turn for runtime patch flushes)
- Validated end-to-end with `npm run verify` (pass, 127 tests).

Open follow-ups from this pass:

- [x] ✅ Add `untracked()` / `peek()` reads to prevent accidental dependency capture in incidental reads (completed 2026-03-19).
- [x] ✅ Add a first-class `effect()` primitive layered on top of the current `cell` / `derived` core (completed 2026-03-19).
- [x] ✅ Wire route/view ownership scopes into app bootstrap/navigation lifecycles so client-owned island state is disposed automatically on fragment swaps (completed 2026-03-19).

---

## Status update (2026-03-19, untracked/peek + effect primitive)

✅ Completed in this pass:

- Added `untracked(() => ...)` and `peek(signal)` to `src/helix/reactive.ts` for explicit non-tracking reads.
- Added first-class `effect(run, options?)` with:
  - dynamic dependency discovery + reconciliation (`dependsOn` edges removed/re-added per run)
  - microtask-coalesced invalidation re-runs
  - `dispose()` / `disposed` lifecycle semantics
  - ownership integration via `owner` option (`owns` edges + scope cleanup)
  - `EffectNode` graph registration for introspection/devtools topology
- Expanded `src/tests/reactive.test.ts` to cover:
  - `untracked` dependency suppression
  - `peek` non-subscription behavior
  - effect initial run + re-run + disposal
  - effect dynamic dependency edge reconciliation
  - scope-owned effect disposal behavior
- Validated with focused runtime tests and full `npm run verify` in this pass.

Open follow-ups from this pass:

- [x] ✅ Wire route/view ownership scopes into app bootstrap/navigation lifecycles so client-owned island state is disposed automatically on fragment swaps (completed 2026-03-19).
- [ ] Evaluate optional `effect` cleanup callback ergonomics (`onCleanup`-style) if repeated teardown patterns emerge in island modules.

---

## Status update (2026-03-19, route/view ownership scope wiring)

✅ Completed in this pass:

- Added owner-aware install lifecycle support in `src/helix/client-reactivity.ts`:
  - `installRuntimeReactivePatchBindings(..., { owner })` now registers owner disposal cleanup
  - owner disposal removes active subscriptions and install-key bookkeeping so old sources stop emitting
  - same install key can be safely reinstalled under a new owner/source after disposal
- Added route/view scope lifecycle primitives in `src/example/client/runtime.ts`:
  - `createClientViewScope()` for initial client view owner
  - `rotateClientViewScope(runtime)` to dispose prior view owner and assign a new one
- Wired scope lifecycle into client bootstrap/navigation:
  - bootstrap initializes `runtime.viewScope`
  - fragment-swap navigation rotates `runtime.viewScope` before replacing app-core DOM
- Wired owner-scoped installs for runtime reactive bindings in:
  - `src/example/client/actions-users.ts`
  - `src/example/client/actions-posts.ts`
  - `src/example/client/actions-external.ts`
  - `src/example/client/primitives-demo.ts`
- Added regression coverage:
  - `src/tests/client-reactivity.test.ts` validates owner disposal cleanup + same-key reinstall behavior
  - `src/tests/client-runtime.test.ts` validates `rotateClientViewScope(...)` disposes the old scope and assigns a new one
- Validated with focused tests and full `npm run verify` (pass, 134 tests).

Open follow-ups from this pass:

- [ ] Evaluate optional helper(s) for scoped runtime install groups if additional island modules need coordinated multi-install teardown semantics.

---

## Status update (2026-03-18, docs: framework-first prompt guidance)

✅ Completed in this pass:

- Added framework-first documentation guidance for the `/primitives` input+button example in `END_TO_END_FRAMEWORK_GUIDE.md`.
- Added a copy/paste prompt template that explicitly requires `cell` + `derived` for client interaction state.
- Clarified that the existing direct-DOM copy/paste snippet is an MVP shortcut, not the preferred default pattern.
- Added a README pointer to the new framework-first prompt section.

Open follow-ups from this pass:

- [x] ✅ Replace the MVP snippet with a fully reactive (`cell`/`derived`) concrete code variant in `END_TO_END_FRAMEWORK_GUIDE.md` (completed 2026-03-18).

---

## Status update (2026-03-18, client action boilerplate extracted to Helix core)

✅ Completed in this pass:

- Added `src/helix/client-reactivity.ts` with reusable helpers for:
  - runtime patch batch scheduling (`scheduleRuntimePatchBatch`)
  - target-aware reactive patch scheduling (`scheduleRuntimeReactivePatches`)
  - once-per-runtime reactive subscription install (`installRuntimeReactivePatchBindings`)
- Exported the helper module via `src/helix/index.ts`.
- Migrated `src/example/client/actions-users.ts`, `src/example/client/actions-posts.ts`, and `src/example/client/actions-external.ts` to the new core helper, removing repeated `WeakSet` install guards and repetitive `subscribe(...)` + `scheduleReactivePatches(...)` wiring boilerplate.
- Removed duplicated local scheduler helpers from `src/example/client/actions-shared.ts`.
- Added unit coverage in `src/tests/client-reactivity.test.ts` for node derivation, missing-target filtering, and once-per-runtime install semantics.

Open follow-ups from this pass:

- [ ] Evaluate whether to apply the same core helper pattern to any future client modules before introducing new action-local scheduling utilities.

---

## Status update (2026-03-18, best-of-framework reactive runtime patterns)

✅ Completed in this pass:

- Upgraded `src/helix/client-reactivity.ts` with framework-inspired runtime primitives:
  - distinct-until-changed reactive binding emissions (default `Object.is`, overridable comparator)
  - optional flush strategies per binding/install (`sync`, `microtask`, `animation-frame`)
  - queued batch coalescing for deferred flush modes
  - latest-write patch deduplication by target/op key
  - install-scope cleanup support via returned disposer and `uninstallRuntimeReactivePatchBindings(...)`
- Adopted microtask + dedupe install defaults in:
  - `src/example/client/actions-users.ts`
  - `src/example/client/actions-posts.ts`
  - `src/example/client/actions-external.ts`
- Expanded coverage in `src/tests/client-reactivity.test.ts` for:
  - deferred microtask batch coalescing
  - patch dedupe semantics
  - distinct-until-changed filtering
  - explicit uninstall cleanup behavior
- Validated end-to-end with `npm run verify` (pass, 116 tests).

Open follow-ups from this pass:

- [ ] Evaluate exposing typed presets (for example `flush: "microtask" + dedupe + distinct`) as named helper profiles to standardize reactive binding behavior across future client modules.

---

## Status update (2026-03-18, `/primitives` submit flow aligned to framework-reactive standard)

✅ Completed in this pass:

- Refactored `onSubmitPrimitiveMessage` in `src/example/client/actions-primitives.ts` to update `runtime.primitiveMessageForm` state (`message`, `response`, `submitting`) instead of writing response/disabled UI directly to DOM nodes.
- Restored the submit-button patch target in `src/example/views-tsx/primitives.view.tsx` with `data-hx-id="demo-message-submit"` so disabled state is driven by reactive patches.
- Added primitive message runtime modeling in `src/example/client/runtime.ts` (`PrimitiveMessageFormState`, `PrimitiveMessageFormDerivedState`, state cell factory, derived factory).
- Wired primitive message runtime state into `src/example/client/bootstrap.ts` and defined the cell-backed runtime property for `primitiveMessageForm`.
- Added and exported primitive message sync/install helpers in `src/example/client/primitives-demo.ts` to:
  - synchronize DOM input value into runtime state on bootstrap/navigation,
  - install once-per-runtime reactive patch bindings for label text, response text, and submit disabled state.
- Extended navigation re-sync flow in `src/example/client/actions-navigation.ts` to call `syncPrimitiveMessageStateFromDom(runtime)` after app-core swaps.
- Added dedicated flow coverage in `src/tests/primitives-message.test.ts` for:
  - runtime state → reactive DOM patch behavior,
  - submit handler behavior + server response path updating reactive UI state.
- Extended runtime-derived assertions in `src/tests/client-runtime.test.ts` for primitive message label/disabled derived state.
- Regenerated artifacts and validated end-to-end with:
  - `npm run gen:views`
  - `npm run verify` (pass, 118 tests)

Open follow-ups from this pass:

- [x] ✅ Extend `/primitives` submit coverage beyond barrel-export alignment to full handler behavior + endpoint response paths (completed 2026-03-18).

---

## Status update (2026-03-18, framework-level client DOM target/model helpers)

✅ Completed in this pass:

- Added `src/helix/client-dom.ts` with framework-level helpers inspired by Stimulus targets and `v-model`-style input binding:
  - `createDomTargetScope(root)` for scoped `data-hx-id` lookups
  - `listenToTarget(...)` for target-scoped event listeners with disposable cleanup
  - `bindTargetTextValue(...)` for text/select input → state wiring with inferred DOM event (`input` vs `change`)
  - `createEventController(...)` for reusable disposable listener cleanup
- Exported the helper module via `src/helix/index.ts`.
- Refactored `src/example/client/primitives-demo.ts` to use the new framework helpers instead of repeated ad-hoc `root.querySelector(...)` + listener boilerplate.
- Simplified the primitive message input binding so runtime lookup happens once during mount instead of on every keystroke.
- Added coverage in `src/tests/client-dom.test.ts` for scoped target lookup, inferred model events, missing-target behavior, and listener cleanup.
- Updated `README.md` to point enhancement modules toward the new framework helper.

Open follow-ups from this pass:

- [ ] Evaluate extending `bindTargetTextValue(...)` into a fuller framework model-binding helper for checkbox/radio/file/select-multiple cases where page enhancements start to repeat those patterns.

---

## Status update (2026-03-16)

✅ Completed in this pass:

- Route→view→resource graph wiring helpers are in use across page/user handlers.
- TSX escape hatches (`uncompiledView`, `clientOnly`) are implemented with compiler/runtime tests.
- Binding id conventions are compile-time validated in binding-map generation.
- SSR→snapshot→resume integration coverage was added (`src/tests/ssr-resume.test.ts`).
- Client action handlers are split into feature modules (`actions-users`, `actions-posts`, `actions-external`, `actions-navigation`) with `actions.ts` as a barrel export.
- Source-of-truth docs were aligned with the implementation changes.

Open follow-ups from this pass:

- [x] ✅ Add dev-time hot reload for client action chunks and generated artifacts (completed 2026-03-17).
- [x] ✅ Add perf benchmark harness for SSR fragment swap vs full refresh (completed 2026-03-17).

## Status update (2026-03-17, primitives integration)

✅ Completed in this pass:

- Added `/primitives` admin route as a full interactive showcase for all headless primitives.
- Upgraded `/search` to use primitive combobox suggestions and a help popover.
- Upgraded `/settings` to use primitive select behavior and a help tooltip.
- Added centralized primitive controller mounting/re-mounting (`src/example/client/primitives-demo.ts`) for initial load and app-core fragment swaps.

Open follow-ups from this pass:

- [ ] Expand primitive replacements to additional legacy controls/pages where ad-hoc UI state handling remains.

## Status update (2026-03-17, drawer primitive + external-data-rich slide panel)

✅ Completed in this pass:

- Created `src/helix/primitives/drawer.ts` — headless drawer primitive (`createDrawerController`) composing the same building blocks as `dialog.ts` (controllable state, dismissable layer, focus trap, portal) with an additional `closingDuration` option that delays `display:none` to allow a CSS slide-out animation to complete.
- Exported `drawer.ts` from `src/helix/primitives/index.ts`.
- Converted the `/external-data-rich` detail popup from a centered modal to a right-side slide panel: overlay uses `.drawer-overlay`, inner card uses `.drawer-panel`, `ensureExternalMediaDetailDialog` now creates a `DrawerController` with `side:"right"` and `closingDuration:220`.
- Added `.drawer-overlay`, `.drawer-panel`, `.drawer-header`, `.drawer-grid`, `.drawer-thumb`, and `@keyframes drawerSlideIn/drawerSlideOut` CSS to `layout.ts`. Existing `.modal-overlay` / `.modal-card` rules are preserved for the `/external-data` page and primitives demo.
- Added `src/tests/drawer.test.ts` (7 tests covering open/close/toggle, ARIA, data-hx-opening attrs, display timing, onChange, defaultValue).

Open follow-ups from this pass:

- [ ] Consider applying the drawer primitive to other detail/inspection panels in the app (e.g. user detail on the users page).
- [ ] Evaluate left/top/bottom drawer variants and confirm CSS `@keyframes` are wired for those sides if used.

## Status update (2026-03-17, external details navigation regression)

✅ Completed in this pass:

- Fixed stale external dialog controller reuse after `app-core` fragment swaps, which caused detail overlays to stop opening after in-app navigation.
- Added lifecycle reset hook `resetExternalDialogControllers()` in `src/example/client/actions-external.ts` and invoked it before `core.innerHTML` replacement in `src/example/client/actions-navigation.ts`.
- Hardened dialog mount checks to re-create controllers when cached overlay/button nodes are detached or replaced.
- Added regression coverage in `src/tests/external-details-navigation.test.ts` for both `/external-data-rich` and `/external-data` reopen-after-navigation flows.

Open follow-ups from this pass:

- [x] ✅ Browser e2e regression added (`e2e/external-navigation.spec.ts` via Playwright/Chromium, `npm run test:e2e`). Covers baseline open, navigate-away/back reopen, and rapid multi-cycle for both `/external-data-rich` and `/external-data`.

## Immediate fixes (this sprint)

Status update (2026-03-16): ✅ Items 1–3 completed, ✅ VS Code definition-navigation hardening completed.

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

### 3.1 Stabilize VS Code definition navigation ✅ Completed (2026-03-16)

In VS Code, `Ctrl+Click` / `Go to Definition` could intermittently show **No definition found**
because workspace TypeScript settings were not pinned and TSX authoring files under
`src/example/views-tsx` did not have a dedicated configured editor project.

Delivered:

- Added workspace editor defaults in `.vscode/settings.json` (`typescript.tsdk`,
  `typescript.enablePromptUseWorkspaceTsdk`, and `editor.multiCursorModifier`).
- Added editor-only TS project in `src/example/views-tsx/tsconfig.json`
  (`noEmit`, `jsx: preserve`) to keep `.tsx` source files in a configured project.
- Added lightweight JSX ambient typing in `src/example/views-tsx/jsx.d.ts` for Helix TSX shells.
- Added README troubleshooting steps in `README.md` under **VS Code TypeScript navigation**.

---

## Near-term (next few weeks)

Status update (2026-03-11): ✅ Items 4–6 completed.

### 4. Code-generate the BindingMap ✅ Completed (2026-03-11)

The `BindingMap` in `src/example/views/users.view.ts` must be kept in sync by hand with every
`data-hx-bind` attribute in HTML and every export in the client handler modules under
`src/example/client/actions-*.ts` (re-exported by `src/example/client/actions.ts`).
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

This would dramatically reduce client-handler boilerplate across `src/example/client/actions-*.ts`.

Delivered: runtime state now uses live cells/derived state not just for users paging/sort, but also for posts paging metadata, external-data paging metadata, external detail modal visibility/content formatting, and create-user form status/error/disabled flows. Remaining manual state patch paths in client handler modules were migrated to reactive subscriptions.

---

## Medium-term (the actual moat)

Status update (2026-03-11): 🚧 Item 7 MVP delivered, ✅ Item 8 completed.

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

### 12. Headless Primitive Layer Implementation ✅ Complete

**Completed:** Primitive layer now includes dialog, popover, menu, tabs, tooltip, accordion, toast, dropdown, select, and combobox with shared infrastructure (focus management, keyboard handling, portal strategy, positioning, ARIA attributes, dismissable layers). `data-hx-bind` now supports compile-time `data-hx-event` overrides, floating positioning supports flip/clamp with `placementUsed`, and both external product detail examples now use the dialog primitive instead of ad-hoc display toggles. Primitive coverage now includes the original 5 primitive/core test files plus 6 new primitive test files and compiler coverage for the new event override behavior.

**Follow-up Items:**

- [ ] Optional future work: drive floating-position updates through emitted patch batches instead of direct `style.setProperty()` calls

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
```

Steps 1–6 are all tractable without a compiler and together turn the prototype into something
with a sound foundation. Steps 7–8 are where the framework becomes genuinely differentiated.

---

## Dev-Time Experience (2026-03-17)

### 7. Dev-Time Hot Reload ✅ Completed (2026-03-17)

**Delivered**:

- `src/helix/dev-server.ts`: File watcher + live-reload infrastructure
  - `LiveReloadTracker`: watches `src/example/client/` and generated artifacts
  - `injectLiveReloadScript()`: inserts polling script into HTML responses
  - `/dev/poll-changes`: endpoint for browser to detect file changes
- `src/example/server-dev.ts`: Dev server with NODE_ENV=development support
- `npm run dev:watch`: new dev script that runs with live-reload enabled

**How it works**:

1. File watcher detects changes to client action files and generated artifacts
2. Browser polls `/dev/poll-changes` every 1000ms
3. When changes detected, full-page reload triggered

**Usage**:

```bash
npm run dev:watch
```

Edit client files in `src/example/client/` → browser automatically reloads.

**Future enhancement**: Selective hot module replacement (HMR) to reload only affected chunks without full page refresh.

---

### 8. SSR & Resume Performance Benchmarks ✅ Completed (2026-03-17)

**Delivered**:

- `src/helix/ssr-bench.ts`: Three new benchmarks
  - `benchmarkSsrGeneration()`: measures SSR snapshot creation (50-item list)
  - `benchmarkResumeInit()`: measures client resume initialization time
  - `benchmarkPatchApplication()`: measures DOM patch application overhead
- Integration with main benchmark suite in `src/bench/index.ts`
- `npm run bench:ssr`: convenience script to run only SSR benchmarks
- `DEVELOPMENT.md`: comprehensive performance guide with tips and metrics interpretation

**Typical Results**:

- SSR generation: 0.2–0.3ms (artifact definition + snapshot creation)
- Client resume: ~95ms (mostly JSDOM setup; resume execution ~19ms)
- Patch application: 2–3ms for 3 text updates

**Usage**:

```bash
npm run bench        # Full benchmark suite (all tests)
npm run bench:ssr    # SSR benchmarks only
```

**Next steps**:

- Track benchmark results over time to detect performance regressions
- Implement synthetic full-page load testing (SSR + simulated navigation)
- Add bundle size analysis tooling
- Profile memory usage for long-lived sessions

---

## Recommended Target Architecture (Phase-Based Path Forward)

Based on code-doc audit and design review, here's the prioritized roadmap to production-ready stability:

### Phase 1: Stabilize Foundation (Immediate, ~6 weeks)

**Goal**: Make core sound enough for production SSR apps with proven safety nets.

#### P0 Priority Tasks

| Task                                 | Effort  | Block             | Impact                          | Status                                   |
| ------------------------------------ | ------- | ----------------- | ------------------------------- | ---------------------------------------- |
| Add E2E SSR→Resume integration tests | 1 week  | Prod readiness    | Catch silent failures           | ⏳ Pending                               |
| Complete unified graph wiring        | 1 week  | Feature soundness | Devtools, compile-time analysis | ✅ Wired (graph edges used)              |
| Implement escape hatches             | 2 weeks | Phase 3 islands   | Enable extensions               | ✅ Done (`uncompiledView`, `clientOnly`) |
| Fix type safety in codegen           | 1 week  | Type safety       | IDE completion, fewer bugs      | ⏳ Evaluators use `any`                  |

#### P1 Priority Tasks

| Task                                       | Effort   | Block           | Impact                         |
| ------------------------------------------ | -------- | --------------- | ------------------------------ |
| Handler export validation at generate time | 3 days   | Safety          | Catch missing handlers early   |
| Split example actions.ts by feature        | 1 week   | Maintainability | Unblock code splitting         |
| Binding convention formal docs             | Included | DX              | Added to README + ARCHITECTURE |

---

### Phase 2: Complete Promised Features (~4-6 weeks)

**Goal**: Deliver Phase 2 features as documented.

- **Optimistic updates**: Helper to record transaction log, rollback on failure (form submission use case)
- **Virtualization integration**: Wire VirtualList into reconciliation for large lists
- **DevTools enhancements**: Trace filtering and link-to-source navigation
- **Example app refactoring**: Split actions.ts into feature modules with per-feature tests

---

### Phase 3: Rich Client Interactivity (Future, ~6-8 weeks)

**Goal**: Support client-owned islands and real-time collaboration.

#### ✅ Completed in Phase 3a (Headless Primitives)

- Headless primitive layer (dialog, popover, menu, tabs, tooltip, accordion, toast, dropdown, select, combobox)
- Focus management and keyboard navigation (_focus-scope, keyboard handler_)
- Portal strategy and floating positioning with collision avoidance
- Compiler integration for explicit `data-hx-event` binding overrides
- Product detail examples using dialog primitive

#### ⏳ Remaining Phase 3 work

- Autocomplete with debounce and local caching
- Drag & drop with client state + server reorder + rollback
- Rich text editor island (preserve cursor/selection across server patches)
- Transient selection/filter UI state (multi-select, expanded rows)
- WebSocket invalidation channel (Phase 4)

---

## Immediate Priority (Shortest Critical Path)

Based on risk and developer experience impact:

1. **Type safety in codegen** (1 week) — Infer typed evaluators from view props; eliminate `any` in generated code
2. **E2E integration tests** (1 week) — Add SSR→Resume→Patch flow tests to prevent silent failures
3. **Handler validation at gen time** (3 days) — Catch binding→export mismatches before runtime
4. **Synthetic load testing** (1 week) — Establish perf baselines for SSR + resumed navigation scenarios

**Total critical path**: ~3 weeks to significantly improve safety and confidence.

---

## Known Code Quality Findings

### Strengths

- ✅ Core TS types well-structured (no `any` in public API signatures)
- ✅ Error messages include file:line:column locations (good DX)
- ✅ Clean dependency graph (no circular imports)
- ✅ Clear module boundaries (_reactive.ts_ = reactivity, _resource.ts_ = caching, etc.)
- ✅ Binding validation at compile time (_binding-map-compiler.ts_, _tsx-view-compiler.ts_)
- ✅ Graph edges actually wired through invalidation path (_resource.ts:invalidateResourcesByTags_)
- ✅ All systems tested (96/96 tests passing)

### Weaknesses

- ⚠️ Codegen produces `any` in patch `evaluate` function signatures
- ⚠️ Ad hoc error handling (mix of throw vs. silent ignore patterns)
- ⚠️ Global mutable state (`resourceRegistry`, `runtimeGraph` exported)
- ⚠️ Cell/Derived instances not serializable (client must reconstruct from scratch)
- ⚠️ No declared resource schema (types inferred from cache values, not explicit)
- ⚠️ VirtualList/VirtualGrid exist but not integrated into _reconcileKeyed_

### Risks If Current Direction Continues

| Timeframe  | Risk                                                            | Mitigation                          |
| ---------- | --------------------------------------------------------------- | ----------------------------------- |
| 1-3 months | Silent binding failures (forgotten handler exports)             | Validate exports at generation time |
| 1-3 months | Incomplete devtools (traces work, but missing search/filter UI) | Complete causality viewer           |
| 3-6 months | Type safety illusion (codegen `any` masks real bugs)            | Type-infer patch evaluators         |
| 3-6 months | Phase 3 islands blocked by underdocumented patterns             | Add autocomplete/drag examples      |
| 6+ months  | Perf surprises at scale (registry walks are O(n), no profiling) | Add performance profiling tools     |
| 6+ months  | Multiplayer impossible (no server push channel)                 | Implement WebSocket invalidation    |

---

## Summary: Framework Status (as of 2026-03-17)

**Code Quality**: Solid foundation. Types are safe, graph is unified, binding convention is enforced, tests are comprehensive (96/96 passing).

**Documentation**: Well-aligned with implementation. Code-doc audit found 7 claims verified accurate, 3 gaps fixed. No silent failures.

**Production Readiness**:

- Core SSR + resumable interactivity: ✅ Ready
- Binding-based event delegation: ✅ Ready
- Graph-driven cache invalidation: ✅ Ready
- Form validation + optimistic updates: ⏳ Partial (not integrated)
- Virtualization + large table support: ⏳ Primitives ready, not integrated
- Devtools causality viewer: ⏳ Traces work, UI incomplete
- Type safety in generated code: ⏳ Works, but codegen produces `any`

**Next Major Milestone**: Complete Phase 1 stabilization (~6 weeks) with E2E tests, type-safe codegen, and generation-time validation. Then Phase 2 optimistic updates + virtualization integration to fully deliver promised features.

---

## Status update (2026-03-19, architecture-aligned client interaction primitives)

✅ Completed in this pass:

- Exported the new client interaction primitives from `src/helix/index.ts` so the public framework barrel matches the implemented API surface:
  - `createAutocomplete(...)`
  - `createDragReorder(...)`
  - `createInvalidationChannel(...)`
  - `createVisibilityTrigger(...)`
  - `createIdleTrigger(...)`
  - `createFormState(...)`
- Added `src/helix/form-state.ts` implementing the reactive form model described in Tech Specs Mode B:
  - per-field `value`, `error`, `touched`
  - aggregate `isValid`, `isDirty`, `isSubmitting`, `submitError`
  - `touchAll()`, `reset()`, `applyServerErrors()`, `submit()`, `getValues()`
- Added `src/helix/lazy-activation.ts` implementing the visibility/idle activation hooks already described by the resumability model:
  - `createVisibilityTrigger(...)`
  - `createIdleTrigger(...)`
- Added regression coverage:
  - `src/tests/form-state.test.ts`
  - `src/tests/lazy-activation.test.ts`
  - `src/tests/index-exports.test.ts`
- Validated with full test suite: **200/200 passing**.

Open follow-ups from this pass:

- [x] ✅ Wire `createFormState(...)` into one example page so the recommended reactive form path is demonstrated end-to-end (completed 2026-03-20).
- [x] ✅ Integrate `createVisibilityTrigger(...)` / `createIdleTrigger(...)` into resume/bootstrap so visibility and idle activation are not just library primitives but part of the default runtime path (completed 2026-03-20).
- [x] ✅ Add an example server-pushed invalidation endpoint and connect `createInvalidationChannel(...)` in the example app runtime (completed 2026-03-20).

---

## Status update (session, reactive island layer + devtools enhancements)

✅ Completed in this pass (187 tests, all passing):

### 1. `bindTargetValue` + reader helpers (`src/helix/client-dom.ts`)

- Added generic `bindTargetValue<TElement, TValue>()` alongside `bindTargetTextValue`, supporting non-string value types.
- Added `readCheckboxChecked(element)`, `readRadioGroupValue(element, root)`, `readFileList(element)`, `readSelectMultipleValues(element)` reader helpers.
- Covers checkbox/radio model bindings, file inputs, and multi-select arrays — previously unsupported by the string-only `bindTargetTextValue`.
- Added 2 new tests in `src/tests/client-dom.test.ts`.

### 2. DevTools topology tab (`src/helix/devtools.ts`)

- Added a new **Topology** tab alongside the existing Graph and Traces tabs.
- `renderTopologyView()` groups reactive nodes under their owning scope using `owns` graph edges.
- Each scope tree entry shows owned `Cell`, `Derived`, and `Effect` nodes with their `dependsOn` dependency labels.
- `switchTab()` now handles three tabs with consistent active/inactive styling.
- Added 4 tests in `src/tests/devtools.test.ts`.

### 3. Reactive autocomplete island (`src/helix/autocomplete.ts`)

- New `createAutocomplete<T>(options)` factory returning a headless reactive bundle:
  - `query: Cell<string>` — current query state
  - `results: Cell<T[]>` — live result list
  - `status: Cell<AutocompleteStatus>` — `"idle" | "loading" | "ready" | "error"`
- Debounce implemented with `setTimeout` + `onCleanup(() => clearTimeout(...))` — cancels in-flight timers on query change.
- Stale fetch suppression via a `cancelled` closure flag set in `onCleanup`.
- LRU-style result cache with configurable `maxCacheSize` (evicts oldest entry).
- Added 8 tests in `src/tests/autocomplete.test.ts`.

### 4. Drag-and-drop reorder with rollback (`src/helix/drag-reorder.ts`)

- New `createDragReorder<T>(options)` factory that wraps a `Cell<T[]>` with reorder + rollback semantics:
  - `move(fromIndex, toIndex)` — applies optimistic reorder to the cell immediately.
  - `commit()` — calls `onReorder(next)` async callback; reverts cell on failure, returns `boolean`.
  - `rollback()` — manually reverts to pre-move state without firing `onReorder`.
- `reorderArray<T>(arr, from, to)` utility exported for non-mutating index-based reordering.
- Added 9 tests in `src/tests/drag-reorder.test.ts`.

### 5. SSE/WebSocket live invalidation (`src/helix/invalidation-channel.ts`)

- New `createInvalidationChannel(options)` factory supporting `type: "sse"` and `type: "websocket"`.
- Server pushes JSON `{ "tags": string[] }` messages; channel calls `invalidateResourcesByTags(tags)` on receipt.
- `onMessage` hook allows filtering/suppression (`return false`) or logging before invalidation fires.
- Auto-reconnect with configurable `reconnectMs` (set to `0` to disable); intentional `disconnect()` suppresses reconnection.
- Added 6 tests in `src/tests/invalidation-channel.test.ts`.

### New files

| File                                     | Purpose                                    |
| ---------------------------------------- | ------------------------------------------ |
| `src/helix/autocomplete.ts`              | Headless reactive autocomplete island      |
| `src/helix/drag-reorder.ts`              | Drag-and-drop reorder primitive + rollback |
| `src/helix/invalidation-channel.ts`      | SSE/WebSocket live cache invalidation      |
| `src/tests/devtools.test.ts`             | DevTools topology/graph tab tests          |
| `src/tests/autocomplete.test.ts`         | Autocomplete island tests                  |
| `src/tests/drag-reorder.test.ts`         | Drag-reorder + rollback tests              |
| `src/tests/invalidation-channel.test.ts` | Invalidation channel tests                 |

### Updated production readiness

- Devtools causality viewer: ✅ Topology + Traces + Graph all working
- Virtualization + large table support: ✅ Reactive factories + windowed reconciliation complete
- Optimistic updates: ✅ `withOptimistic` + `TransactionLog` tested (9 tests)
- Live invalidation: ✅ SSE + WebSocket channel implemented and tested

Open follow-ups:

- [x] ✅ Wire `createAutocomplete` into a server search route (e.g., user search on admin page) (completed 2026-03-20).
- [x] ✅ Wire `createDragReorder` into example app list (e.g., reorderable todo list) (completed 2026-03-20).
- [x] ✅ Wire `createInvalidationChannel` into server bootstrap (SSE endpoint for tag-push notifications) (completed 2026-03-20).
- [x] ✅ Expose `autocomplete`, `drag-reorder`, `invalidation-channel` from `src/helix/index.ts` (completed 2026-03-19).
