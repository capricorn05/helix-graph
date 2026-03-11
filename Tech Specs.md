Helix Graph-Native Web Framework

Technical Specification (v0.1)
TypeScript-only • SSR Streaming • Resumable Interactivity • Patch-First UI • Unified Causal Graph

1. Purpose

Helix is a web application framework that shifts work from runtime to compile time by:

compiling TSX views into DOM fragments + direct patch operations (no VDOM diff),

delivering HTML via streaming SSR,

enabling resumable interactivity (attach behavior lazily on demand, rather than hydrating the whole tree),

using a single unified causal graph to coordinate UI, state, data, actions, routing, caching, chunking, and observability.

Target outcome: faster time-to-usable pages, lower JS execution on load, higher responsiveness (INP), and predictable data invalidation.

2. Goals and Non-Goals
   Goals

Instant usability: HTML works without JS; JS progressively enhances.

Resumability: no full-app hydration step; behaviors load/attach per interaction/visibility/idle.

Patch-first updates: update only the exact DOM targets affected by changes.

Unified causal graph: one source-of-truth model used by compiler + server + client runtime + devtools.

Deterministic data model: resources/actions have explicit keys/tags and invalidation is graph-driven.

Performance scheduling: prioritized lanes (input/animation/viewport/idle) to prevent jank.

Interop: React/Vue islands and “escape hatches” supported.

Non-Goals (v0.x)

Supporting all dynamic TS patterns in compiled views (escape hatches instead).

Solving every local-first/collaboration model universally (optional module later).

Replacing all component ecosystems immediately.

3. Terminology

Compiled View: TSX that conforms to Helix restrictions and compiles to fragments + patches.

BindingMap: metadata mapping DOM targets ↔ patch slots + event bindings (for resumability).

GraphSnapshot: minimal serialized state/resource payload needed to resume.

Resource: typed data dependency with caching policy and tags.

Action: typed mutation boundary that can invalidate resources/tags.

Unified Graph (UG): IR containing nodes + edges for all app concerns.

4. System Overview
   4.1 High-level architecture
   Build Time
   TS/TSX → Typecheck → Unified Graph (UG)
   → Compile Views → DOM Fragments + Patch Tables
   → Extract Actions → Endpoints + Stubs
   → Extract Resources → Cache/Tags + Prefetch Plan
   → Chunk Planner → Activation Chunks
   → Emit Manifests (server/client/graph)

Request Time
Server: Route → Subgraph → Stream HTML + GraphSnapshot + BindingMap
Client: Paint HTML → Install tiny delegator → Resume on-demand
4.2 Core invariants

UI updates are performed by patch ops computed from graph dependencies.

Lists/tables use keyed collection reconciliation (not VDOM).

Interactivity is lazy by default (event/visibility/idle activation).

Data invalidation uses tags/keys and graph edges to compute impact.

5. Programming Model (Core Primitives)

Helix provides 5 primitives that define graph nodes:

5.1 cell<T>(initial, options?)

Writable reactive state.

Options: scope: app|route|view|session, serializable, secure, clientOnly

5.2 derived<T>(compute, options?)

Pure computation dependent on cells/resources.

5.3 resource<T>(keyFn, fetcher, policy)

Data dependency with caching and placement rules.

Policy:
where: server|edge|client|any
cache: memory|disk|kv|none
staleMs, revalidateMs, dedupe: inflight|none
tags: string[] | (ctx)=>string[]

5.4 action<I,O>(handler, policy)

Typed mutation boundary.

Policy:
where: server|edge|client|any
invalidates: tags[] | (ctx,input)=>tags[]
capabilities: string[]
idempotency: optional
optimistic: optional (library-level helper)

5.5 view<Props>(renderFn)

Declares a compiled view. TSX subset applies.

6. TSX Compilation Rules (Compiled Views)
   6.1 Allowed

static tag names (<div>, <UserRow>)

static attrs and reactive attrs bound to cells/derived/resources

conditionals (cond ? <A/> : <B/>)

keyed lists (items.map(item => <Row key={item.id} ... />))

named handlers: onClick={saveUser} where saveUser is an action (or registered client action)

limited refs (see 6.3)

6.2 Disallowed in compiled views

inline lambdas in handlers: onClick={() => ...} ❌

prop spread: <X {...props} /> ❌

dynamic tag names: <Tag /> where Tag varies ❌

render props / function-as-child patterns ❌

unbounded dynamic style objects (restricted to known keys)

6.3 Escape hatches

uncompiledView(fn) – renders with runtime evaluation, no patch compile

clientOnly(loader) – loads an island component after paint

rawComponent(React/Vue) – mounts external component as an island

dangerouslyRawHTML(html) – controlled HTML injection

Tooling requirement: Dev mode warns when escape hatch footprint exceeds thresholds.

7. Unified Graph IR (Single Source of Truth)
   7.1 Node types

RouteNode

ViewNode (compiled view, template IDs, patch table)

CellNode

DerivedNode

ResourceNode

ActionNode

EffectNode (sockets, subscriptions, timers)

AssetNode

ModuleNode

7.2 Edge types

dependsOn(A,B) – value dependency

renders(Route,View/Layout)

invalidates(Action, Tag/Resource)

imports(Module,Module)

activates(EventBinding, Chunk)

owns(ScopeOwner, Cell) – lifecycle ownership (GC rules)

7.3 Determinism rules

Compiled regions must allow static extraction of:

dependency edges (what each binding reads),

event bindings (what events invoke),

list keys (stable key expressions).

8. View Output Format (DOM Template + Patch Ops)
   8.1 Compiled view produces

createFragment(): DocumentFragment

patchTable: PatchFn[]

targetMap: targetId → DOM node reference offset

bindingSlots: slotId → (targetId, patchFnIndex, dependencyNodeId)

8.2 Patch op set (v0.1)

setText(targetId, string)

setAttr(targetId, name, string|null)

toggleClass(targetId, className, boolean)

setValue(targetId, string) (inputs)

setChecked(targetId, boolean)

setStyle(targetId, prop, value) (restricted whitelist)

9. SSR + Streaming Lifecycle
   9.1 Server pipeline

Route match → route subgraph

Start HTML stream

Evaluate resources (parallel, dedupe, cache)

Stream resolved segments

Emit <script type="application/helix+snapshot">...</script> containing:

GraphSnapshot (cells/resources needed)

BindingMap (event + patch slot metadata)

ChunkManifestHints (preload candidates)

9.2 Client bootstrap

On page load:

install one tiny event delegator

do not execute view render functions

attach handlers lazily when:

user interacts (event)

element becomes visible (IntersectionObserver)

idle time (requestIdleCallback)

10. Resumability Model
    10.1 BindingMap

A compact mapping of:

domTargetId → patchSlots[]

domEventBindingId → actionId + chunkId + parameters encoding

listContainerId → keyed reconciliation config

10.2 Activation

When an event is captured:

lookup binding

load chunk if not loaded

execute action (client/server)

update dependent cells/resources

compute affected patch slots from graph edges

apply patch ops (scheduled)

11. Scheduling and Responsiveness
    11.1 Lanes

Input lane (highest)

Animation lane

Viewport lane

Network lane

Idle lane

11.2 Budgets

Patch batches are time-sliced (e.g., 2–4ms)

Input lane can interrupt lower lanes

Devtools reports long tasks and offending dependencies.

12. Data Model (Resources)
    12.1 Keying

Resources are keyed by stable arrays/strings. Example:
["users", page, pageSize, sortCol, sortDir, filter]

12.2 Cache + dedupe

inflight dedupe by key

cache store choice by policy: memory/kv/none

revalidate by time or invalidation tags

12.3 Invalidation

Actions invalidate:

specific resource keys, or

tags (recommended)

Helix uses graph edges to determine:

which resources to refetch

which DOM targets to patch after refresh

13. Mutation Model (Actions)
    13.1 Types

serverAction

edgeAction

clientAction (pure UI)

universalAction (policy-driven placement)

13.2 Capabilities

Actions declare required capabilities; runtime enforces:

views cannot call actions without route/app-granted capabilities

server-side enforcement mandatory

13.3 Optimistic updates (library)

Pattern:

apply optimistic cell changes

run action

on failure rollback from recorded transaction log

14. Complex Components: Tables, Paging, Forms
    14.1 Keyed Collection Reconciler (required)

For <tbody> or list containers, Helix provides a reconciler:

Inputs

current keys (ordered)

next keys (ordered)

key → fragment map

Operations

move fragments for existing keys

insert for new keys

remove for missing keys

Only the list container performs reconciliation; inside each row fragment, updates are patch ops.

14.2 Virtualization primitives (required)

VirtualList

VirtualGrid

Virtualization determines which keys are mounted (windowing); reconciler mounts/unmounts fragments accordingly.

14.3 Paging lifecycle (reference)

click Next → page cell updates

resource key changes → fetch/dedupe/cache

reconciler swaps rows (move/insert/remove)

patches update page indicators, disabled buttons, etc.

14.4 Form system (two modes)

Mode A: HTML-first progressive forms

standard <form method=post action=...>

works without JS

with JS: intercept submit → action fetch → patch errors inline

Mode B: Reactive forms

cells per field

derived validity/errors

patch disabled states, error messages, aria attributes

Requirement: library must support server-returned structured errors:
{ fieldErrors: Record<string,string>, formError?: string }

15. Visual Lifecycle Reference (Canonical Flows)
    15.1 Table paging
    SSR:
    [S] /users?page=1 → resource(usersPage(1)) → HTML stream + snapshot + bindings
    Resume:
    [C] click Next → load paging chunk → page++ → fetch usersPage(2) → keyed reconcile tbody → patch indicators
    15.2 Sorting
    [C] click header → setSort → resource key changes → (cache hit or fetch) → DOM moves (reorder) + patch sort icon
    15.3 Virtualized scroll
    [C] scroll → compute window keys → mount/unmount row fragments → patch visible cells only
    15.4 Enhanced form submit
    [C] submit captured → chunk load → action request → response
    success: patch toast/nav
    fail: patch field errors + aria-invalid + message
    15.5 Inline edit + optimistic
    [C] edit cell → patch that cell only
    [C] click Save → optimistic 'saving' state patch → action → invalidate tag → refresh resource → patch row status + values
16. Interop / Islands
    16.1 Island host

clientOnly(() => import("./HeavyWidget"))
Mounts after paint or on visibility; can receive Helix resources as props.

16.2 External frameworks

rawComponent(ReactComponent, { ssr?: boolean, hydrate?: "local"|"none" })

Local hydration may be used inside the island without affecting the whole page.

17. Devtools and Observability
    17.1 Graph inspector

select DOM element → show dependency chain in UG

select action/resource → list affected DOM targets and timings

17.2 Causality trace

Every update records:

trigger (event/action/resource)

nodes invalidated/refetched

patch slots executed

scheduler lane + timings

17.3 Guardrails

Warnings for:

large escape hatch footprint

non-keyed lists

large initial JS

long derived chains / heavy patch bursts

18. Validation Across 10 Use Cases
    Use Case Fit Primary Wins Primary Risks Must-Have Modules

1) Marketing/blog Excellent near-zero JS, instant paint none major streaming SSR, islands
2) E-commerce Excellent fast PDP/PLP, deterministic cart invalidation 3rd-party scripts resources/tags, secure actions
3) SaaS admin dashboard Very good patch-first tables/forms, less rerender churn JS-heavy pages virtualization, scheduler, datagrid lib
4) Realtime chat Good patch-only list updates backpressure/order effect nodes, buffering
5) Analytics tables Very good stable performance under filters huge DOM virtualization + profiling
6) Page builder (Wix-like) Excellent graph maps naturally, fast inspector dynamic widgets transaction log, devtools
7) Offline field app Strong (opt) local-first responsiveness conflicts local store + sync module
8) Media + comments Good lazy comments/reactions DRM/SDKs islands + prefetch policies
9) Docs + interactive samples Excellent activate only samples sandboxing mdx + clientOnly sandbox
10) Fintech Very good capabilities + audit traces compliance server-only data, audit hooks

19. Non-Functional Requirements
    Performance targets (v0.x guidance)

minimal bootstrap runtime: < 5–10KB gzip target (excluding app chunks)

no global hydration pass

input handling: no long tasks > 50ms in typical pages

list reconciliation: O(changes) using keys; virtualization required for large datasets

Security

server enforcement of capabilities is mandatory

sensitive data must be accessed via server resources/actions only

CSP-friendly output required (avoid inline script where possible; snapshot can be nonce’d)

Reliability

deterministic cache invalidation (tag-based)

idempotency support for actions that mutate state

20. Deliverables / Artifacts

Build output:

dist/server/\*\* (SSR renderer, action handlers)

dist/client/\*\* (bootstrap + activation chunks)

dist/graph/graph.bin (UG)

dist/manifest.json (chunks/assets/bindings versioning)

source maps for patches and chunks

21. Roadmap (Practical Sequencing)

Phase 0:

TSX subset + view compiler to DOM fragments + patches

BindingMap + minimal client delegator

SSR streaming (basic) + GraphSnapshot

Phase 1:

resources/actions extraction + cache/tags

keyed list reconciliation

form enhancement pipeline

Phase 2:

virtualization primitives

scheduler lanes + devtools traces

React island interop

Phase 3:

capability enforcement framework

advanced devtools (graph inspector UI)

optional local-first module
