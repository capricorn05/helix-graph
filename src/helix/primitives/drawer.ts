import { createControllableState } from "./core/controllable-state.js";
import { createDismissableLayer } from "./core/dismissable-layer.js";
import { trapFocus } from "./core/focus-scope.js";
import { mountToPortal, unmountFromPortal } from "./core/portal.js";
import { setDialogAttrs } from "./core/a11y.js";
import { defaultDomAdapter } from "./core/events.js";
import type {
  PrimitiveController,
  PrimitiveStateOptions,
} from "./core/types.js";
import type { Cell } from "../reactive.js";
import type { EventAdapter } from "./core/events.js";

export type DrawerSide = "right" | "left" | "top" | "bottom";

export interface DrawerOptions extends PrimitiveStateOptions<boolean> {
  /** Which edge the panel slides in from. Default: "right". */
  side?: DrawerSide;
  /**
   * Element treated as the interactive surface for outside-click dismissal.
   * Clicks outside this element will dismiss the drawer. Default: contentEl.
   */
  dismissTarget?: HTMLElement;
  /**
   * Duration in ms to wait for the exit animation before hiding the overlay.
   * Set the matching CSS animation duration to the same value.
   * Default: 220.
   */
  closingDuration?: number;
  /** Mount the overlay to the portal root. Default: true. */
  portal?: boolean;
  adapter?: EventAdapter;
}

export interface DrawerController extends PrimitiveController {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
}

export function createDrawerController(
  triggerEl: HTMLElement,
  contentEl: HTMLElement,
  options?: DrawerOptions,
): DrawerController {
  const shouldUsePortal = options?.portal !== false;
  const adapter = options?.adapter ?? defaultDomAdapter;
  const closingDuration = options?.closingDuration ?? 220;
  const side = options?.side ?? "right";
  const dismissTarget = options?.dismissTarget ?? contentEl;

  const state = createControllableState<boolean>({
    value: options?.value,
    defaultValue: options?.defaultValue ?? false,
    onChange: options?.onChange,
    cell: options?.cell,
  });

  let focusTrapCleanup: (() => void) | null = null;
  let dismissableLayer: ReturnType<typeof createDismissableLayer> | null = null;
  let originalParent: HTMLElement | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  const contentId = `drawer-${Math.random().toString(36).substr(2, 9)}`;

  // Stamp the side so CSS can key off it without JS positioning
  contentEl.setAttribute("data-hx-side", side);

  const applyOpen = () => {
    // Cancel any in-progress close animation
    if (closeTimer !== null) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    contentEl.removeAttribute("data-hx-closing");

    if (shouldUsePortal) {
      originalParent = contentEl.parentElement;
      mountToPortal(contentEl);
    }

    focusTrapCleanup = trapFocus(contentEl);

    dismissableLayer = createDismissableLayer({
      element: dismissTarget,
      onDismiss: () => close(),
    });
    dismissableLayer.mount();

    contentEl.setAttribute("data-hx-open", "true");
    setDialogAttrs(triggerEl, contentEl, contentId, true);
    contentEl.style.display = "flex";
  };

  const applyClose = () => {
    if (focusTrapCleanup) {
      focusTrapCleanup();
      focusTrapCleanup = null;
    }

    if (dismissableLayer) {
      dismissableLayer.destroy();
      dismissableLayer = null;
    }

    contentEl.setAttribute("data-hx-open", "false");
    setDialogAttrs(triggerEl, contentEl, contentId, false);

    // Trigger CSS exit animation then hide
    contentEl.setAttribute("data-hx-closing", "true");

    closeTimer = setTimeout(() => {
      closeTimer = null;
      contentEl.removeAttribute("data-hx-closing");
      contentEl.style.display = "none";

      if (shouldUsePortal) {
        unmountFromPortal(contentEl);
        if (originalParent) {
          originalParent.appendChild(contentEl);
          originalParent = null;
        }
      }
    }, closingDuration);
  };

  const open = () => {
    state.set(true);
    applyOpen();
  };

  const close = () => {
    state.set(false);
    applyClose();
  };

  const toggle = () => {
    if (state.get()) {
      close();
    } else {
      open();
    }
  };

  const isOpen = () => state.get();

  // Clicking triggerEl toggles the drawer (e.g. a close button inside the panel)
  const toggleHandler = adapter.on(triggerEl, "click", (e) => {
    e.preventDefault();
    toggle();
  });

  // Initial visual state
  if (state.get()) {
    applyOpen();
  } else {
    contentEl.style.display = "none";
    contentEl.setAttribute("data-hx-open", "false");
  }

  // Cell bridge: external reactive state drives the drawer
  if (options?.cell) {
    options.cell.subscribe(() => {
      if (options.cell!.get()) {
        open();
      } else {
        close();
      }
    });
  }

  return {
    open,
    close,
    toggle,
    isOpen,
    destroy() {
      toggleHandler();
      if (closeTimer !== null) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      if (focusTrapCleanup) focusTrapCleanup();
      if (dismissableLayer) dismissableLayer.destroy();
      contentEl.style.display = "none";
    },
  };
}
