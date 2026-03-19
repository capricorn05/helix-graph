# Helix – Next Steps

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
- ✅ All 96 tests passing

**Production readiness**: Core is solid. Optional enhancements (Phase 3 islands, advanced virtualization integration) remain future work per Design.

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
