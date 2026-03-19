# Helix UI Primitive Layer — Implementation Plan

**Date:** March 16, 2026  
**Status:** Approved, ready to implement  
**Branch:** main

---

## 1. Objective

Build a headless, framework-agnostic UI primitive layer for Helix with no React dependency. The layer provides four interactive primitives — **dialog**, **popover**, **menu**, **tabs** — backed by shared infrastructure modules that handle open/close state, focus management, keyboard interaction, dismiss-on-escape/outside, layering/portal strategy, positioning, and accessibility attributes.

---

## 2. Constraints & Non-Goals

| Constraint                     | Details                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| No React                       | TypeScript-only, plain DOM APIs                                                             |
| No compiler changes            | `tsx-view-compiler.ts` stays untouched (`BindingEvent = "click" \| "submit"` only)          |
| No `top`/`left` patch ops      | These are not in `STYLE_WHITELIST` in `patch.ts`; positioning sets `element.style` directly |
| Baseline a11y only             | ARIA roles + basic keyboard; not full APG-strict                                            |
| No new primitives beyond scope | No select, combobox, tooltip, toast, dropdown in v1                                         |
| No visual styles               | Primitives are completely unstyled (headless); no `theme.ts` changes                        |
| No collision/flip              | Simple placement + offset only in v1                                                        |

---

## 3. Architectural Decisions (Locked)

### 3.1 Events Wiring

**Choice: Hybrid adapter**

Primitives use direct `addEventListener`/`removeEventListener` internally (same pattern as `devtools.ts`). An `EventAdapter` interface is defined as a seam for future `data-hx-bind` compiler integration. The adapter is injected into each primitive controller; the default is `defaultDomAdapter`.

This avoids the compiler's `click`/`submit` limitation for keyboard events (`keydown`, `Escape`, `ArrowUp`, etc.) and outside-click detection (`pointerdown`).

### 3.2 State API

**Choice: Both web-style props AND Cell integration**

Each primitive controller accepts:

- `defaultOpen?: boolean` — uncontrolled initial state
- `open?: boolean` — controlled value (web-style)
- `onOpenChange?: (next: boolean) => void` — web-style callback
- `cell?: Cell<boolean>` — Helix `Cell<T>` bridge (bidirectional sync)

Internally `controllable-state.ts` unifies all three into a single `{ get(): T; set(next: T): void }` interface.

### 3.3 Portal Defaults

**Choice: Per-primitive:**

| Primitive | Portal by default |
| --------- | ----------------- |
| Dialog    | Yes               |
| Popover   | Yes               |
| Menu      | Yes               |
| Tabs      | No (inline)       |

Portal behaviour can be overridden via `portal?: boolean` option on each controller.

### 3.4 Accessibility Level

**Choice: Baseline only**

- Correct ARIA roles (`dialog`, `menu`, `menuitem`, `tablist`, `tab`, `tabpanel`, `popover`)
- `aria-modal`, `aria-expanded`, `aria-haspopup`, `aria-controls`, `aria-selected`
- Basic keyboard nav (Arrow, Home, End, Tab, Escape, Enter/Space)
- No live regions, no full WCAG 2.1 pass in v1

---

## 4. Folder Structure

```
src/helix/primitives/
  index.ts                     ← barrel re-export
  dialog.ts
  popover.ts
  menu.ts
  tabs.ts
  core/
    types.ts                   ← shared TypeScript interfaces
    controllable-state.ts      ← unified open/close state (props + Cell)
    focus-scope.ts             ← getFocusable, trapFocus, restoreFocus
    keyboard.ts                ← KEY constants + createKeyboardHandler
    dismissable-layer.ts       ← Escape + outside-click dismiss
    layer-stack.ts             ← singleton stack for correct Escape ordering
    portal.ts                  ← ensurePortalRoot, mountToPortal, unmountFromPortal
    positioning.ts             ← computePosition, applyPosition (sets style directly)
    a11y.ts                    ← setDialogAttrs, setPopoverAttrs, setMenuAttrs, setTabsAttrs
    events.ts                  ← EventAdapter interface + defaultDomAdapter
```

New tests in `src/tests/`:

```
primitives-core.test.ts
dialog.test.ts
popover.test.ts
menu.test.ts
tabs.test.ts
```

One addition to `src/helix/index.ts`:

```ts
export * from "./primitives/index.js";
```

---

## 5. Core Module Contracts

### 5.1 `core/types.ts`

```typescript
export type PrimitivePlacement =
  | "top"
  | "top-start"
  | "top-end"
  | "bottom"
  | "bottom-start"
  | "bottom-end"
  | "left"
  | "right";

export interface PrimitiveStateOptions<T> {
  value?: T;
  defaultValue?: T;
  onChange?: (next: T) => void;
  cell?: import("../../reactive.js").Cell<T>;
}

export interface PrimitiveController {
  destroy(): void;
}
```

### 5.2 `core/controllable-state.ts`

```typescript
export function createControllableState<T>(options: PrimitiveStateOptions<T>): {
  get(): T;
  set(next: T): void;
};
```

- If `cell` is provided: bidirectional sync via `cell.subscribe` + `cell.set`
- If `value` is provided: controlled mode — only `onChange` fires, internal state does not update
- Otherwise: uncontrolled mode — `defaultValue` seeds internal state, `onChange` fires on change

### 5.3 `core/focus-scope.ts`

```typescript
export function getFocusableElements(root: HTMLElement): HTMLElement[];
export function trapFocus(root: HTMLElement): () => void; // returns cleanup fn
export function restoreFocus(element: HTMLElement | null): void;
```

Focusable selector: `a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`.

`trapFocus` wraps Tab/Shift+Tab with circular cycling.

### 5.4 `core/keyboard.ts`

```typescript
export const KEY = {
  Escape: "Escape",
  Enter: "Enter",
  Space: " ",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Home: "Home",
  End: "End",
  Tab: "Tab",
} as const;

export function createKeyboardHandler(
  map: Partial<Record<keyof typeof KEY, (e: KeyboardEvent) => void>>,
): (e: KeyboardEvent) => void;
```

### 5.5 `core/dismissable-layer.ts`

```typescript
export interface DismissableLayerOptions {
  element: HTMLElement;
  onDismiss: (reason: "escape" | "outside-click") => void;
  disableEscape?: boolean;
  disableOutsideClick?: boolean;
}

export interface DismissableLayer {
  mount(): void;
  destroy(): void;
}

export function createDismissableLayer(
  options: DismissableLayerOptions,
): DismissableLayer;
```

Escape dismiss goes through `layer-stack.ts` to ensure only the topmost layer handles it.

### 5.6 `core/layer-stack.ts`

Module-level singleton (no export of the array itself):

```typescript
export function pushLayer(id: symbol): void;
export function popLayer(id: symbol): void;
export function isTopmostLayer(id: symbol): boolean;
```

Ensures correct Escape ordering when layers are nested (e.g. dialog containing a menu).

### 5.7 `core/portal.ts`

```typescript
export function ensurePortalRoot(): HTMLElement;
// Creates <div id="__hx-portal-root__" data-hx-portal="true"> on body once

export function mountToPortal(element: HTMLElement): void;
export function unmountFromPortal(element: HTMLElement): void;
```

Portal root is a flat container appended to `document.body` outside any overflow/clip ancestor.

### 5.8 `core/positioning.ts`

```typescript
export interface PositionResult {
  top: number;
  left: number;
}

export interface PositionOptions {
  placement?: PrimitivePlacement;
  offset?: number; // default: 8px
}

export function computePosition(
  anchor: HTMLElement,
  floating: HTMLElement,
  options?: PositionOptions,
): PositionResult;

export function applyPosition(floating: HTMLElement, pos: PositionResult): void;
// Sets element.style.top and element.style.left directly (NOT via PatchRuntime)
// top/left are not in STYLE_WHITELIST — this is intentional for v1
```

Uses `getBoundingClientRect()` + `window.scrollX/Y` to compute absolute page coordinates.

### 5.9 `core/a11y.ts`

```typescript
export function setDialogAttrs(
  triggerEl: HTMLElement,
  contentEl: HTMLElement,
  contentId: string,
  isOpen: boolean,
): void;

export function setPopoverAttrs(
  triggerEl: HTMLElement,
  contentEl: HTMLElement,
  contentId: string,
  isOpen: boolean,
): void;

export function setMenuAttrs(
  triggerEl: HTMLElement,
  menuEl: HTMLElement,
  menuId: string,
  isOpen: boolean,
): void;

export function setTabsAttrs(
  tablistEl: HTMLElement,
  tabs: HTMLElement[],
  panels: HTMLElement[],
  activeIndex: number,
): void;
```

### 5.10 `core/events.ts`

```typescript
export interface EventAdapter {
  on(
    element: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): () => void; // returns unsubscribe
}

export const defaultDomAdapter: EventAdapter;
// Uses addEventListener / removeEventListener
```

---

## 6. Primitive Controller APIs

### 6.1 `dialog.ts`

```typescript
export interface DialogOptions {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  cell?: Cell<boolean>;
  portal?: boolean; // default: true
  adapter?: EventAdapter;
}

export interface DialogController extends PrimitiveController {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
}

export function createDialogController(
  triggerEl: HTMLElement,
  contentEl: HTMLElement,
  options?: DialogOptions,
): DialogController;
```

**Behaviour:**

- Portal to `#__hx-portal-root__` (default)
- Focus trap on open; focus restore on close
- Escape and outside-click dismiss
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (set via `setDialogAttrs`)
- `data-hx-open` attribute toggled for CSS hooks

### 6.2 `popover.ts`

```typescript
export interface PopoverOptions {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  cell?: Cell<boolean>;
  portal?: boolean; // default: true
  placement?: PrimitivePlacement; // default: "bottom-start"
  offset?: number; // default: 8
  adapter?: EventAdapter;
}

export interface PopoverController extends PrimitiveController {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
}

export function createPopoverController(
  triggerEl: HTMLElement,
  contentEl: HTMLElement,
  options?: PopoverOptions,
): PopoverController;
```

**Behaviour:**

- Portal (default); positioned relative to anchor on open
- No focus trap (non-modal floating)
- Escape and outside-click dismiss
- `aria-expanded`, `aria-haspopup="true"`, `aria-controls`

### 6.3 `menu.ts`

```typescript
export interface MenuOptions {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  cell?: Cell<boolean>;
  portal?: boolean; // default: true
  placement?: PrimitivePlacement; // default: "bottom-start"
  offset?: number;
  adapter?: EventAdapter;
}

export interface MenuController extends PrimitiveController {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  focusItem(index: number): void;
}

export function createMenuController(
  triggerEl: HTMLElement,
  menuEl: HTMLElement,
  options?: MenuOptions,
): MenuController;
```

**Behaviour:**

- Portal (default); positioned relative to anchor
- Roving focus via `ArrowUp`/`ArrowDown`/`Home`/`End` within `[role="menuitem"]` children
- `ArrowDown` on trigger opens and focuses first item
- `ArrowUp` on trigger opens and focuses last item
- Escape closes and returns focus to trigger
- `role="menu"`, `role="menuitem"` (set on open; respects pre-existing roles)

### 6.4 `tabs.ts`

```typescript
export interface TabsOptions {
  defaultIndex?: number;
  activeIndex?: number;
  onIndexChange?: (next: number) => void;
  cell?: Cell<number>;
  portal?: boolean; // default: false
  adapter?: EventAdapter;
}

export interface TabsController extends PrimitiveController {
  activate(index: number): void;
  activeIndex(): number;
}

export function createTabsController(
  tablistEl: HTMLElement,
  options?: TabsOptions,
): TabsController;
```

**Behaviour:**

- Scans for `[data-hx-tab]` children as tab buttons and `[data-hx-panel]` siblings/descendants as panels
- Arrow keys + `Home`/`End` navigate between tabs
- `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`
- No portal (inline by default)

---

## 7. Implementation Order

Dependencies flow top to bottom; each step can be started only after its dependencies are complete.

```
Step  File                                 Depends on
───────────────────────────────────────────────────────
 1    core/types.ts                        (nothing)
 2    core/events.ts                       types.ts
 3    core/keyboard.ts                     (nothing)
 4    core/layer-stack.ts                  (nothing)
 5    core/controllable-state.ts           types.ts, reactive.ts
 6    core/focus-scope.ts                  keyboard.ts
 7    core/dismissable-layer.ts            keyboard.ts, layer-stack.ts, events.ts
 8    core/portal.ts                       (nothing — pure DOM)
 9    core/positioning.ts                  types.ts
10    core/a11y.ts                         (nothing — pure DOM attr setters)
11    core/index.ts (barrel)               all of 1–10
12    dialog.ts                            all core modules
13    popover.ts                           all core modules
14    menu.ts                              all core modules
15    tabs.ts                              all core modules
16    primitives/index.ts (barrel)         12–15
17    src/helix/index.ts (add export)      16
```

---

## 8. Test Matrix

Each test file uses `node:test` + `jsdom` matching the project's existing test style (see `src/tests/patch.test.ts` for reference). JSDOM is set up with `new JSDOM("<!DOCTYPE html>")` and `global.document`/`window` assigned.

| File                      | Key scenarios                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primitives-core.test.ts` | controllable-state (controlled/uncontrolled/cell), focus-scope trap, keyboard handler dispatch, layer-stack ordering, portal mount/unmount, computePosition |
| `dialog.test.ts`          | open/close/toggle, focus trap active, Escape dismiss, outside-click dismiss, ARIA attrs, Cell sync                                                          |
| `popover.test.ts`         | open/close, positioning applied, Escape + outside-click, aria-expanded, no focus trap                                                                       |
| `menu.test.ts`            | open/close, ArrowDown opens+focuses first, ArrowUp opens+focuses last, Home/End, Escape returns focus                                                       |
| `tabs.test.ts`            | tab activation, ArrowLeft/Right nav, Home/End, ARIA roles, Cell sync                                                                                        |

---

## 9. Doc Updates Required (AGENTS.md)

| Document                  | Section to update                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ARCHITECTURE_ROADMAP.md` | Add Phase 3d — Headless Primitive Layer; update future folder map to include `src/helix/primitives/` |
| `Tech Specs.md`           | Add Section 24 — Primitive Layer contracts (EventAdapter, ControllableState, portal model)           |
| `NEXT_STEPS.md`           | Close any stale reference to primitives; add new in-progress item + follow-on deferred items         |
| `README.md`               | Add brief usage note under "Headless UI helpers" covering the four primitives                        |

---

## 10. Explicitly Deferred (Not in v1)

- `tsx-view-compiler.ts` or `BindingMap` compiler changes for primitive events
- Collision detection / flip / auto-placement in positioning
- Full APG-strict keyboard compliance
- Select, combobox, tooltip, toast, accordion, dropdown
- Visual styles or theme token additions
- Positioning via `PatchRuntime` patch ops (tracked as follow-on in NEXT_STEPS)

---

## 11. Validation Gate

Before marking done:

```bash
npm run build          # TypeScript must compile clean
npm run check:client-imports   # build-guard must pass
npm run test           # all new + existing tests must pass
npm run verify         # full pipeline
```
