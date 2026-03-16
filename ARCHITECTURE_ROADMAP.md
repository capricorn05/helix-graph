# Helix Graph: Architecture & Development Roadmap

## Current Architecture

Helix Graph is a **server-first, progressive-enhancement framework** that combines:

- **SSR-first rendering** via pre-compiled template strings (`.tsx` → `.compiled.ts` → wrapper)
- **Thin client reconciler** for table/list updates using `reconcileKeyed()` and `schedulePatchBatch()`
- **Binding-based event delegation** via `data-hx-bind` attributes and auto-generated binding map
- **Post-request granular updates** (JSON fetch → patch batch) for data-driven interactions
- **Compiled shell + server-composed slots** as the default page authoring pattern for maintainability

### Key Design Principles

1. **Server owns durable state** — all persistent data is computed/rendered server-side
2. **Client owns immediate interaction state** — transient UI state lives in the browser
3. **Zero hydration cost** — no component tree traversal; direct event listener attachment
4. **Minimal JS payload** — only binding handlers shipped to client, no framework runtime
5. **Fragment-based navigation** — page transitions fetch only `[data-hx-id="app-core"]` fragment, not full HTML

---

## Vision: SSR-First, Not SSR-Only

The goal is to maintain SSR's benefits (SEO, fast initial render, predictable page load) while adding **rich client interactivity** for the best product UX.

### The Hybrid Model

```
┌─────────────────────────────────────────────────────────────┐
│ Server                                                      │
│  • SSR shell (layout, nav, breadcrumbs)                    │
│  • Data fetching & resource invalidation                    │
│  • Request/response handlers & validation                   │
│  • Source of truth for durable state                        │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│ Network Boundary                                            │
│  • JSON endpoints for data updates                          │
│  • HTML fragments for navigation                            │
│  • WebSocket/SSE for live invalidation                      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│ Client                                                      │
│  • Keyed reconciliation for tables/lists                    │
│  • Optimistic UI updates                                    │
│  • Interactive islands (autocomplete, editors, drag/drop)   │
│  • Transient state (focus, selection, hover, search query)  │
└─────────────────────────────────────────────────────────────┘
```

### Current default page pattern (2026-03)

For new pages, prefer:

1. TSX view source in `views-tsx/`
2. generated compiled artifact in `views/compiled/`
3. server wrapper in `views/` that composes dynamic HTML and calls `render*CompiledView(...)`

For high-frequency interactions (paging/sorting/filtering), add JSON endpoints + client DOM patching on top of SSR.
Host Listings (`/host-listings`) is the reference for this combined approach.

---

## Development Roadmap

### Phase 1: Stabilize Existing Patterns (Foundation)

**Goal:** Document and test the current hybrid approach.

- [x] **SSR + fragment swap** for page navigation
- [x] **JSON + reconciliation** for table paging
- [x] **Server actions** for mutations with invalidation
- [x] **Formal documentation** of the SSR → component → client binding pipeline
- [x] **Documented default authoring pattern** (compiled shell + optional hybrid JSON patching)
- [ ] **Comprehensive test coverage** for reconciliation edge cases
- [ ] **Perf benchmarks** comparing SSR fragment load vs. full page refresh

**Status:** Mostly complete; reconciliation/actions flows are validated via `npm run verify`.

---

### Phase 2: Optimistic Updates (Better UX)

**Goal:** Enable instant client feedback on safe operations.

- [ ] **Optimistic row creation** — add to table before server confirmation
  - Example: click "Create Post" → row appears immediately, greyed out; on success, confirm
  - Needs: rollback on 400/500, dedupe logic for retries
  - Reference: `src/helix/optimistic.ts` exists but not fully wired

- [ ] **Optimistic row edits** — inline edit cells before POST
  - Example: click cell → make editable → submit → patch on success
  - Needs: local copy of row + merge/conflict logic

- [ ] **Optimistic deletes** — fade out row before server confirmation
  - Example: click delete → row fades immediately; on success, removed; on error, restored opacity

**When to add:** After Phase 1 stabilization; high ROI for perceived responsiveness.

---

### Phase 3: Client-Owned Interactive Islands (Rich UX)

**Goal:** Support rich, stateful interactions without full client-side rendering.

#### 3a. Autocomplete / Type-Ahead

- [ ] **Per-keystroke search** with debounce and local caching
- [ ] **Dropdown list** managed client-side during composition
- [ ] **Server validation** on selection (e.g., userId must exist)
- **Why:** Instant feedback on search is essential UX; server round-trip per keystroke is too slow.

#### 3b. Drag & Drop

- [ ] **Client-side drag state** (source, target, visual feedback)
- [ ] **Server-side reorder** on drop with invalidation
- [ ] **Rollback on failure** (restore original order)
- **Why:** Drag motion must run at 60fps; network latency kills UX entirely.

#### 3c. Rich Text Editing

- [ ] **Dedicated editor DOM island** (not server-patched during edit)
- [ ] **Local toolbar** (bold, italic, link insertion)
- [ ] **Server save** on blur or explicit submit
- [ ] **Conflict handling** if server version changes while editing
- **Why:** Server patch operations break cursor, selection, undo stack, IME composition.

#### 3d. Transient Selection & Focus State

- [ ] **Expanded row detail view** (client-owned overlay)
- [ ] **Multi-select checkbox state** (client-owned until submit)
- [ ] **Filter/sort UI state** (local model updated on change, submitted on confirm button)
- **Why:** These should be immediate; deferring to server breaks fluent interaction.

---

### Phase 4: Live Channels & Real-Time (Advanced)

**Goal:** Support collaborative features and live invalidation without polling.

- [ ] **WebSocket connection** for server → client push
- [ ] **Interest-based subscriptions** (e.g., subscribe to `posts:*:changes`)
- [ ] **Live row updates** — when another user edits a row you're viewing, patch it in place
- [ ] **Presence indicators** — show which users/cursors are active
- [ ] **Optimistic conflict resolution** — CRDT or last-write-wins for concurrent edits

**When to add:** After Phase 3; needed for multiplayer, notifications, live dashboards.

---

## Implementation Guidance

### When to Use SSR Fragment Swap

- Full page navigation (link clicks, form submits that change the main view)
- Large content changes (switch from users → posts → settings)
- **Tradeoff:** clean separation; requires round-trip; good for slow networks

### When to Use JSON + Reconciliation

- Table paging, sorting, filtering
- Adding/removing rows (with optimistic update)
- Inline cell updates
- **Tradeoff:** faster than fragment swap; still requires network; good for CRUD

### When to Use Client Islands

- Autocomplete during composition
- Drag/drop reordering
- Rich text editing
- Multi-field forms with complex validation logic
- **Tradeoff:** more code in browser; full UX control; higher JS payload (but optional per page)

### Never Use Client-Side Rendering For

- Initial page load (always SSR)
- SEO-critical content (always server-rendered and in HTML)
- Durable data mutations (server must validate, not client)

---

## File Structure Evolution

Today:

```
src/helix/              — framework core (ssr, router, resource, actions, etc.)
src/example/
  ├─ views-tsx/        — hand-written TSX designs
  ├─ scripts/          — app-level wrappers for codegen output policy
  ├─ views/            — server wrappers (wire compiled + SSR)
  │  └─ compiled/      — auto-generated static templates
  ├─ client/           — all client handlers (bindings + actions)
  ├─ shared/           — browser-safe helpers reusable by SSR wrappers + client modules
  └─ handlers/         — SSR page handlers + API endpoints
```

`src/helix/tsx-view-compiler.ts` and `src/helix/binding-map-compiler.ts` now hold reusable compile/
scan cores; `src/helix/compiler-utils.ts`, `src/helix/codegen-utils.ts`,
`src/helix/codegen-emitters.ts`, `src/helix/codegen-runner.ts`,
`src/helix/compiled-view-codegen.ts`, and
`src/helix/build-guard.ts` now hold shared naming, TypeScript source parsing, file discovery,
generator entrypoint helpers, generated-module source emitters, reusable check/write +
stale-output orchestration, compiled-view codegen orchestration, and browser-boundary analysis
core for guard scripts.
`src/helix/client-action-metadata.ts` now holds declarative client-action metadata typing,
handler/action inference, and stale/missing-export validation for generated binding maps.
Example scripts now focus on repo-specific output paths and app manifests such as
`src/example/shared/client-action-metadata.ts`.

Browser-delivered modules should stay inside `src/example/client`, `src/example/shared`, or `src/helix` so emitted ESM specifiers resolve to served URLs at runtime.

Future (as islands grow):

```
src/helix/
  ├─ islands/          — island lifecycle/context management
  ├─ form.ts           — enhanced form state + optimistic updates
  ├─ autocomplete.ts   — search/filter component primitive
  └─ […existing…]

src/example/
  ├─ islands/          — app-specific islands (user picker, editor, etc.)
  │  ├─ autocomplete.tsx
  │  ├─ editor.tsx
  │  └─ […more…]
  ├─ views-tsx/
  ├─ views/
  └─ […existing…]
```

---

## Success Metrics

| Metric                                 | Target        | Current                       |
| -------------------------------------- | ------------- | ----------------------------- |
| **Time to First Paint (SSR)**          | <200ms        | ✓ (no hydration overhead)     |
| **Time to Interactive (no JS needed)** | <100ms        | ✓ (delegated listeners only)  |
| **Table page change latency**          | <100ms        | ~50–100ms (network-dependent) |
| **Autocomplete first result**          | <50ms         | — (not implemented)           |
| **Drag/drop frame rate**               | 60 fps        | — (not implemented)           |
| **Bundle size (client JS)**            | <50KB gzipped | ~30KB (bindings + reconciler) |

---

## Open Questions & Exploration

1. **Optimistic update semantics** — how much client-side conflict resolution do we want?
   - Last-write-wins (simplest, can lose data)
   - CRDT (complex but safe for multiplayer)
   - Server-decides-on-conflict (middle ground; needs server logic)

2. **Island communication** — how do islands coordinate with SSR shell?
   - Event bus? Shared runtime state? Message passing?
   - How does an island invalidate the table next to it?

3. **Live channel design** — subscribe/publish model?
   - Redis Pub/Sub → WebSocket fan-out?
   - Database triggers → server push?
   - Sparse (only what's visible) vs. full?

4. **Form builder** — can we auto-generate optimistic updates in forms?
   - Detect which fields are safe to optimisticize (e.g., text input but not async validation)?

---

## References & Inspiration

- **Marko** — similar SSR + islands model; excellent streaming perf
- **Astro** — SSR default + opt-in islands
- **HTMX** — fragment-swap interaction model (similar to our fragment approach)
- **Solid.js** — fine-grained reactivity (less relevant for SSR, but good ideas for islands)
- **React Query + SWR** — excellent invalidation/refetch patterns
- **Optimistic UI patterns** — [Jim Nielsen blog](https://blog.jim-nielsen.com/2021/semantic-html-and-progressive-enhancement/) on progressive enhancement

---

## Contributing

When adding features to this roadmap:

1. **Align with hybrid model** — does it split server truth from client interaction state?
2. **Test with slow networks** — SSR wins on 3G; make sure patterns still work offline
3. **Measure bundle impact** — each island adds JS; track gzipped size
4. **Document the pattern** — add an example in `/src/example` if it's a new interaction type
5. **Invalidation strategy** — how does the server tell the client data changed?

---

**Last Updated:** March 16, 2026  
**Version:** 0.1 (pre-roadmap stabilization)
