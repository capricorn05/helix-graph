import { createControllableState } from "./core/controllable-state.js";
import { createDismissableLayer } from "./core/dismissable-layer.js";
import { getFocusableElements } from "./core/focus-scope.js";
import { KEY, createKeyboardHandler } from "./core/keyboard.js";
import {
  ensurePortalRoot,
  mountToPortal,
  unmountFromPortal,
} from "./core/portal.js";
import { applyPosition, computePosition } from "./core/positioning.js";
import { setMenuAttrs } from "./core/a11y.js";
import { defaultDomAdapter } from "./core/events.js";
import type {
  PrimitiveController,
  PrimitiveStateOptions,
  PrimitivePlacement,
} from "./core/types.js";
import type { EventAdapter } from "./core/events.js";

export interface MenuOptions extends PrimitiveStateOptions<boolean> {
  placement?: PrimitivePlacement;
  offset?: number;
  portal?: boolean;
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
): MenuController {
  const shouldUsePortal = options?.portal !== false;
  const adapter = options?.adapter ?? defaultDomAdapter;
  const placement = options?.placement ?? "bottom-start";
  const offset = options?.offset ?? 8;

  const state = createControllableState<boolean>({
    value: options?.value,
    defaultValue: options?.defaultValue ?? false,
    onChange: options?.onChange,
    cell: options?.cell,
  });

  let dismissableLayer: ReturnType<typeof createDismissableLayer> | null = null;
  let originalParent: HTMLElement | null = null;
  let menuKeydownHandler: ((e: KeyboardEvent) => void) | null = null;

  const menuId = `menu-${Math.random().toString(36).substr(2, 9)}`;

  const getMenuItems = (): HTMLElement[] => {
    return Array.from(menuEl.querySelectorAll('[role="menuitem"]'));
  };

  const focusItem = (index: number) => {
    const items = getMenuItems();
    if (items[index]) {
      items[index].focus();
    }
  };

  const updateDisplay = () => {
    const isOpen = state.get();
    menuEl.setAttribute("data-hx-open", isOpen ? "true" : "false");
    setMenuAttrs(triggerEl, menuEl, menuId, isOpen);

    if (isOpen) {
      // Mount to portal
      if (shouldUsePortal) {
        originalParent = menuEl.parentElement;
        mountToPortal(menuEl);
      }

      // Position the menu
      const pos = computePosition(triggerEl, menuEl, { placement, offset });
      applyPosition(menuEl, pos);

      menuEl.style.display = "block";

      // Set up keyboard navigation
      menuKeydownHandler = createKeyboardHandler({
        [KEY.ArrowDown]: () => focusItem(0),
        [KEY.ArrowUp]: () => {
          const items = getMenuItems();
          focusItem(items.length - 1);
        },
        [KEY.Home]: () => focusItem(0),
        [KEY.End]: () => {
          const items = getMenuItems();
          focusItem(items.length - 1);
        },
        [KEY.Escape]: () => close(),
      });
      menuEl.addEventListener("keydown", menuKeydownHandler);

      // Set up dismissable layer
      dismissableLayer = createDismissableLayer({
        element: menuEl,
        onDismiss: () => close(),
      });
      dismissableLayer.mount();
    } else {
      if (menuKeydownHandler) {
        menuEl.removeEventListener("keydown", menuKeydownHandler);
        menuKeydownHandler = null;
      }

      if (dismissableLayer) {
        dismissableLayer.destroy();
        dismissableLayer = null;
      }

      menuEl.style.display = "none";

      // Unmount from portal
      if (shouldUsePortal) {
        unmountFromPortal(menuEl);
        if (originalParent) {
          originalParent.appendChild(menuEl);
          originalParent = null;
        }
      }
    }
  };

  const open = () => {
    state.set(true);
    updateDisplay();
  };

  const close = () => {
    state.set(false);
    updateDisplay();
  };

  const toggle = () => {
    state.set(!state.get());
    updateDisplay();
  };

  const isOpen = () => state.get();

  // Set up trigger keyboard handlers
  const triggerKeydownHandler = createKeyboardHandler({
    [KEY.ArrowDown]: () => {
      if (!isOpen()) {
        open();
        setTimeout(() => focusItem(0), 0);
      }
    },
    [KEY.ArrowUp]: () => {
      if (!isOpen()) {
        open();
        setTimeout(() => {
          const items = getMenuItems();
          focusItem(items.length - 1);
        }, 0);
      }
    },
  });

  const triggerKeyHandler = adapter.on(triggerEl, "keydown", (e) => {
    triggerKeydownHandler(e as KeyboardEvent);
  });

  const triggerClickHandler = adapter.on(triggerEl, "click", (e) => {
    e.preventDefault();
    toggle();
  });

  // Initial state
  updateDisplay();

  // Subscribe to state changes
  if (options?.cell) {
    options.cell.subscribe(() => updateDisplay());
  }

  return {
    open,
    close,
    toggle,
    isOpen,
    focusItem,
    destroy() {
      triggerKeyHandler();
      triggerClickHandler();
      close();
      if (menuKeydownHandler) {
        menuEl.removeEventListener("keydown", menuKeydownHandler);
      }
      if (dismissableLayer) dismissableLayer.destroy();
    },
  };
}
