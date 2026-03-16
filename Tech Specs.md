# Helix Graph-Native Web Framework

**Technical Specification (v0.1)**  
TypeScript-only • SSR Streaming • Resumable Interactivity • Patch-First UI • Unified Causal Graph

## 1. Purpose

Helix is a web application framework that shifts work from runtime to compile time by:

- Compiling TSX views into DOM fragments + direct patch operations (no VDOM diff)
- Delivering HTML via streaming SSR
- Enabling resumable interactivity (attach behavior lazily on demand, rather than hydrating the whole tree)
- Using a single unified causal graph to coordinate UI, state, data, actions, routing, caching, chunking, and observability

Target outcome: faster time-to-usable pages, lower JS execution on load, higher responsiveness (INP), and predictable data invalidation.

## 2. Goals and Non-Goals

### Goals

- Instant usability: HTML works without JS; JS progressively enhances
- Resumability: no full-app hydration step; behaviors load/attach per interaction/visibility/idle
- Patch-first updates: update only exact DOM targets affected by changes
- Unified causal graph: one source-of-truth model used by compiler + server + client runtime + devtools
- Deterministic data model: resources/actions have explicit keys/tags; invalidation is graph-driven
- Performance scheduling: prioritized lanes (`input`/`animation`/`viewport`/`idle`) to prevent jank
- Interop: React/Vue islands and escape hatches supported

### Non-Goals (v0.x)

- Supporting all dynamic TS patterns in compiled views (escape hatches are the path)
- Solving every local-first/collaboration model universally (optional module later)
- Replacing all component ecosystems immediately

## 3. Terminology

| Term               | Definition                                                               |
| ------------------ | ------------------------------------------------------------------------ |
| Compiled View      | TSX conforming to Helix restrictions and compiled to fragments + patches |
| BindingMap         | Metadata mapping DOM targets ↔ patch slots + event bindings              |
| GraphSnapshot      | Minimal serialized state/resource payload needed to resume               |
| Resource           | Typed data dependency with caching policy and tags                       |
| Action             | Typed mutation boundary that can invalidate resources/tags               |
| Unified Graph (UG) | IR containing nodes + edges for app concerns                             |

## 4. System Overview

### 4.1 High-level architecture

**Build time**

```text
TS/TSX → Typecheck → Unified Graph (UG)
       → Compile Views → DOM Fragments + Patch Tables
       → Extract Actions → Endpoints + Stubs
       → Extract Resources → Cache/Tags + Prefetch Plan
       → Chunk Planner → Activation Chunks
       → Emit Manifests (server/client/graph)
```

**Request time**

```text
Server: Route → Subgraph → Stream HTML + GraphSnapshot + BindingMap
Client: Paint HTML → Install tiny delegator → Resume on-demand
```

### 4.2 Core invariants

- UI updates are performed by patch ops computed from graph dependencies
- Lists/tables use keyed collection reconciliation (not VDOM)
- Interactivity is lazy by default (event/visibility/idle activation)
- Data invalidation uses tags/keys and graph edges to compute impact

## 5. Programming Model (Core Primitives)

Helix provides 5 primitives that define graph nodes.

### 5.1 `cell<T>(initial, options?)`

Writable reactive state.

Options:

- `scope`: `app | route | view | session`
- `serializable`
- `secure`
- `clientOnly`

### 5.2 `derived<T>(compute, options?)`

Pure computation dependent on cells/resources.

### 5.3 `resource<T>(keyFn, fetcher, policy)`

Data dependency with caching and placement rules.

Policy:

- `where`: `server | edge | client | any`
- `cache`: `memory | disk | kv | none`
- `staleMs`, `revalidateMs`, `dedupe: inflight | none`
- `tags: string[] | (ctx) => string[]`

### 5.4 `action<I, O>(handler, policy)`

Typed mutation boundary.

Policy:

- `where`: `server | edge | client | any`
- `invalidates: tags[] | (ctx, input) => tags[]`
- `capabilities: string[]`
- `idempotency` (optional)
- `optimistic` (optional; library-level helper)

### 5.5 `view<Props>(renderFn)`

Declares a compiled view. TSX subset applies.

## 6. TSX Compilation Rules (Compiled Views)

### 6.1 Allowed

- Static tag names (`<div>`, `<UserRow>`)
- Static attrs and reactive attrs bound to cells/derived/resources
- Conditionals (`cond ? <A/> : <B/>`)
- Keyed lists (`items.map(item => <Row key={item.id} ... />)`)
- Named handlers (`onClick={saveUser}` where `saveUser` is an action or registered client action)
- Limited refs (see escape hatches)

### 6.2 Disallowed in compiled views

- Inline lambdas in handlers (`onClick={() => ...}`)
- Prop spread (`<X {...props} />`)
- Dynamic tag names (`<Tag />` where `Tag` varies)
- Render props / function-as-child patterns
- Unbounded dynamic style objects (restricted to known keys)

### 6.3 Escape hatches

- `uncompiledView(fn)` — runtime evaluation, no patch compile
- `clientOnly(loader)` — loads an island component after paint
- `rawComponent(React/Vue)` — mounts external component as an island
- `dangerouslyRawHTML(html)` — controlled HTML injection

Tooling requirement: dev mode warns when escape hatch footprint exceeds thresholds.

## 7. Unified Graph IR (Single Source of Truth)

### 7.1 Node types

- `RouteNode`
- `ViewNode` (compiled view, template IDs, patch table)
- `CellNode`
- `DerivedNode`
- `ResourceNode`
- `ActionNode`
- `EffectNode` (sockets, subscriptions, timers)
- `AssetNode`
- `ModuleNode`

### 7.2 Edge types

- `dependsOn(A, B)` — value dependency
- `renders(Route, View/Layout)`
- `invalidates(Action, Tag/Resource)`
- `imports(Module, Module)`
- `activates(EventBinding, Chunk)`
- `owns(ScopeOwner, Cell)` — lifecycle ownership (GC rules)

### 7.3 Determinism rules

Compiled regions must allow static extraction of:

- Dependency edges (what each binding reads)
- Event bindings (what events invoke)
- List keys (stable key expressions)

## 8. View Output Format (DOM Template + Patch Ops)

### 8.1 Compiled view produces

- `createFragment(): DocumentFragment`
- `patchTable: PatchFn[]`
- `targetMap: targetId → DOM node reference offset`
- `bindingSlots: slotId → (targetId, patchFnIndex, dependencyNodeId)`

### 8.2 Patch op set (v0.1)

- `setText(targetId, string)`
- `setAttr(targetId, name, string | null)`
- `toggleClass(targetId, className, boolean)`
- `setValue(targetId, string)` (inputs)
- `setChecked(targetId, boolean)`
- `setStyle(targetId, prop, value)` (restricted whitelist)

## 9. SSR + Streaming Lifecycle

### 9.1 Server pipeline

1. Route match → route subgraph
2. Start HTML stream
3. Evaluate resources (parallel, dedupe, cache)
4. Stream resolved segments
5. Emit `<script type="application/helix+snapshot">...</script>` containing:
   - `GraphSnapshot` (cells/resources needed)
   - `BindingMap` (event + patch slot metadata)
   - `ChunkManifestHints` (preload candidates)

### 9.2 Client bootstrap

On page load:

- Install one tiny event delegator
- Do not execute view render functions
- Attach handlers lazily when:
  - user interacts (event)
  - element becomes visible (`IntersectionObserver`)
  - idle time (`requestIdleCallback`)

## 10. Resumability Model

### 10.1 BindingMap

A compact mapping of:

- `domTargetId → patchSlots[]`
- `domEventBindingId → actionId + chunkId + parameters encoding`
- `listContainerId → keyed reconciliation config`

### 10.2 Activation

When an event is captured:

1. Lookup binding
2. Load chunk if not loaded
3. Execute action (client/server)
4. Update dependent cells/resources
5. Compute affected patch slots from graph edges
6. Apply patch ops (scheduled)

## 11. Scheduling and Responsiveness

### 11.1 Lanes

- Input lane (highest)
- Animation lane
- Viewport lane
- Network lane
- Idle lane

### 11.2 Budgets

- Patch batches are time-sliced (e.g., 2–4ms)
- Input lane can interrupt lower lanes
- Devtools reports long tasks and offending dependencies

## 12. Data Model (Resources)

### 12.1 Keying

Resources are keyed by stable arrays/strings.

Example:

```ts
["users", page, pageSize, sortCol, sortDir, filter];
```

### 12.2 Cache + dedupe

- Inflight dedupe by key
- Cache store choice by policy (`memory`/`kv`/`none`)
- Revalidate by time or invalidation tags

### 12.3 Invalidation

Actions invalidate:

- Specific resource keys, or
- Tags (recommended)

Helix uses graph edges to determine:

- Which resources to refetch
- Which DOM targets to patch after refresh

## 13. Mutation Model (Actions)

### 13.1 Types

- `serverAction`
- `edgeAction`
- `clientAction` (pure UI)
- `universalAction` (policy-driven placement)

### 13.2 Capabilities

Actions declare required capabilities; runtime enforces:

- Views cannot call actions without route/app-granted capabilities
- Server-side enforcement is mandatory

### 13.3 Optimistic updates (library)

Pattern:

1. Apply optimistic cell changes
2. Run action
3. On failure, rollback from recorded transaction log

## 14. Complex Components: Tables, Paging, Forms

### 14.1 Keyed Collection Reconciler (required)

For `<tbody>` or list containers, Helix provides a reconciler.

Inputs:

- Current keys (ordered)
- Next keys (ordered)
- `key → fragment` map

Operations:

- Move fragments for existing keys
- Insert for new keys
- Remove for missing keys

Only the list container performs reconciliation; inside each row fragment, updates are patch ops.

### 14.2 Virtualization primitives (required)

- `VirtualList`
- `VirtualGrid`

Virtualization determines which keys are mounted (windowing); reconciler mounts/unmounts fragments accordingly.

### 14.3 Paging lifecycle (reference)

- Click Next → page cell updates
- Resource key changes → fetch/dedupe/cache
- Reconciler swaps rows (move/insert/remove)
- Patches update page indicators, disabled buttons, etc.

### 14.4 Form system (two modes)

**Mode A: HTML-first progressive forms**

- Standard `<form method="post" action="...">`
- Works without JS
- With JS: intercept submit → action fetch → patch errors inline

**Mode B: Reactive forms**

- Cells per field
- Derived validity/errors
- Patch disabled states, error messages, `aria-*` attributes

Requirement: library must support server-returned structured errors:

```ts
{ fieldErrors: Record<string, string>, formError?: string }
```

## 15. Visual Lifecycle Reference (Canonical Flows)

### 15.1 Table paging

**SSR**

```text
[S] /users?page=1 → resource(usersPage(1)) → HTML stream + snapshot + bindings
```

**Resume**

```text
[C] click Next → load paging chunk → page++ → fetch usersPage(2)
→ keyed reconcile tbody → patch indicators
```

### 15.2 Sorting

```text
[C] click header → setSort → resource key changes → (cache hit or fetch)
→ DOM moves (reorder) + patch sort icon
```

### 15.3 Virtualized scroll

```text
[C] scroll → compute window keys → mount/unmount row fragments
→ patch visible cells only
```

### 15.4 Enhanced form submit

```text
[C] submit captured → chunk load → action request → response
success: patch toast/nav
fail: patch field errors + aria-invalid + message
```

### 15.5 Inline edit + optimistic

```text
[C] edit cell → patch that cell only
[C] click Save → optimistic 'saving' state patch → action
→ invalidate tag → refresh resource → patch row status + values
```

## 16. Interop / Islands

### 16.1 Island host

```ts
clientOnly(() => import("./HeavyWidget"));
```

Mounts after paint or on visibility; can receive Helix resources as props.

### 16.2 External frameworks

```ts
rawComponent(ReactComponent, { ssr?: boolean, hydrate?: "local" | "none" });
```

Local hydration may be used inside the island without affecting the whole page.

## 17. Devtools and Observability

### 17.1 Graph inspector

- Select DOM element → show dependency chain in UG
- Select action/resource → list affected DOM targets and timings

### 17.2 Causality trace

Every update records:

- Trigger (`event`/`action`/`resource`)
- Nodes invalidated/refetched
- Patch slots executed
- Scheduler lane + timings

### 17.3 Guardrails

Warnings for:

- Large escape hatch footprint
- Non-keyed lists
- Large initial JS
- Long derived chains / heavy patch bursts

## 18. Validation Across 10 Use Cases

| Use Case                   | Fit               | Primary wins                                  | Primary risks      | Must-have modules                       |
| -------------------------- | ----------------- | --------------------------------------------- | ------------------ | --------------------------------------- |
| Marketing/blog             | Excellent         | Near-zero JS, instant paint                   | None major         | streaming SSR, islands                  |
| E-commerce                 | Excellent         | Fast PDP/PLP, deterministic cart invalidation | 3rd-party scripts  | resources/tags, secure actions          |
| SaaS admin dashboard       | Very good         | Patch-first tables/forms, less rerender churn | JS-heavy pages     | virtualization, scheduler, datagrid lib |
| Realtime chat              | Good              | Patch-only list updates                       | backpressure/order | effect nodes, buffering                 |
| Analytics tables           | Very good         | Stable performance under filters              | huge DOM           | virtualization + profiling              |
| Page builder (Wix-like)    | Excellent         | Graph maps naturally, fast inspector          | dynamic widgets    | transaction log, devtools               |
| Offline field app          | Strong (optional) | Local-first responsiveness                    | conflicts          | local store + sync module               |
| Media + comments           | Good              | Lazy comments/reactions                       | DRM/SDKs           | islands + prefetch policies             |
| Docs + interactive samples | Excellent         | Activate only samples                         | sandboxing         | MDX + `clientOnly` sandbox              |
| Fintech                    | Very good         | Capabilities + audit traces                   | compliance         | server-only data, audit hooks           |

## 19. Non-Functional Requirements

### Performance targets (v0.x guidance)

- Minimal bootstrap runtime: `< 5–10KB` gzip target (excluding app chunks)
- No global hydration pass
- Input handling: no long tasks > 50ms on typical pages
- List reconciliation: `O(changes)` using keys; virtualization required for large datasets

### Security

- Server enforcement of capabilities is mandatory
- Sensitive data must be accessed via server resources/actions only
- CSP-friendly output required (avoid inline scripts where possible; snapshot can be nonce’d)

### Reliability

- Deterministic cache invalidation (tag-based)
- Idempotency support for actions that mutate state

## 20. Deliverables / Artifacts

Build output:

- `dist/server/**` (SSR renderer, action handlers)
- `dist/client/**` (bootstrap + activation chunks)
- `dist/graph/graph.bin` (UG)
- `dist/manifest.json` (chunks/assets/bindings versioning)
- Source maps for patches and chunks

## 21. Roadmap (Practical Sequencing)

### Phase 0

- TSX subset + view compiler to DOM fragments + patches
- BindingMap + minimal client delegator
- SSR streaming (basic) + GraphSnapshot

### Phase 1

- Resources/actions extraction + cache/tags
- Keyed list reconciliation
- Form enhancement pipeline

### Phase 2

- Virtualization primitives
- Scheduler lanes + devtools traces
- React island interop

### Phase 3

- Capability enforcement framework
- Advanced devtools (graph inspector UI)
- Optional local-first module

## 22. Repository Implementation Pattern (Current)

Default page authoring pattern in this repository:

1. TSX source view in `src/example/views-tsx/*.view.tsx`
2. Generated compiled artifact in `src/example/views/compiled/*.compiled.ts`
3. Server wrapper in `src/example/views/*.ts` that composes dynamic HTML and calls `render*CompiledView(...)`

This split keeps static structure compiler-managed while allowing server-side composition of dynamic table/card markup where needed.

## 23. End-to-End Page Workflow (Current)

### Step 1 — Author TSX shell

Create a `.view.tsx` file with static structure and `hx-slot` placeholders for dynamic HTML.

### Step 2 — Generate compiled artifacts

Run `npm run gen:views` to emit/refresh `*.compiled.ts` output.
The example wrapper `src/example/scripts/generate-compiled-views.ts` delegates orchestration to
the framework API in `src/helix/compiled-view-codegen.ts` (`runCompiledViewCodegen(...)`) so scan/
compile/emit/check/stale-prune behavior stays shared and app scripts remain path/config focused.

### Step 3 — Implement server wrapper

In `src/example/views/*.ts`, render dynamic sections (cards/tables/pager) and pass them as props to the compiled render function.

### Step 4 — Wire page route

Add/extend page logic in `src/example/handlers/pages.handler.ts` and register route in `src/example/routes/index.ts`.

### Step 5 — Add optional hybrid interaction path

For frequent updates (paging/sort/filter), add:

- JSON endpoint in `src/example/handlers/api.handler.ts`
- Client module in `src/example/client/*.ts` that fetches JSON and patches only stable `data-hx-id` regions
- Browser history sync (`pushState`/`popstate`) with full-navigation fallback on error

### Step 6 — Validate consistency

- `npm run build`
- `npm run test`
- `npm run verify` before push

Reference implementation: Host Listings (`/host-listings`) uses this full path (compiled shell + hybrid JSON paging updates).
