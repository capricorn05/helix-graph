import { createControllableState } from "./core/controllable-state.js";
import { createDismissableLayer } from "./core/dismissable-layer.js";
import { restoreFocus, trapFocus } from "./core/focus-scope.js";
import {
  ensurePortalRoot,
  mountToPortal,
  unmountFromPortal,
} from "./core/portal.js";
import { setDialogAttrs } from "./core/a11y.js";
import { defaultDomAdapter } from "./core/events.js";
import type {
  PrimitiveController,
  PrimitiveStateOptions,
} from "./core/types.js";
import type { Cell } from "../reactive.js";
import type { EventAdapter } from "./core/events.js";

export interface DialogOptions extends PrimitiveStateOptions<boolean> {
  portal?: boolean;
  adapter?: EventAdapter;
  openDisplay?: string;
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
): DialogController {
  const shouldUsePortal = options?.portal !== false;
  const adapter = options?.adapter ?? defaultDomAdapter;
  const openDisplay = options?.openDisplay ?? "block";

  const state = createControllableState<boolean>({
    value: options?.value,
    defaultValue: options?.defaultValue ?? false,
    onChange: options?.onChange,
    cell: options?.cell,
  });

  let focusTrapCleanup: (() => void) | null = null;
  let dismissableLayer: ReturnType<typeof createDismissableLayer> | null = null;
  let originalParent: HTMLElement | null = null;

  const contentId = `dialog-${Math.random().toString(36).substr(2, 9)}`;

  const updateDisplay = () => {
    const isOpen = state.get();
    contentEl.setAttribute("data-hx-open", isOpen ? "true" : "false");
    setDialogAttrs(triggerEl, contentEl, contentId, isOpen);

    if (isOpen) {
      // Mount to portal if needed
      if (shouldUsePortal) {
        originalParent = contentEl.parentElement;
        mountToPortal(contentEl);
      }

      // Set up focus trap
      focusTrapCleanup = trapFocus(contentEl);

      // Set up dismissable layer
      dismissableLayer = createDismissableLayer({
        element: contentEl,
        onDismiss: () => close(),
      });
      dismissableLayer.mount();

      contentEl.style.display = openDisplay;
    } else {
      // Clean up
      if (focusTrapCleanup) {
        focusTrapCleanup();
        focusTrapCleanup = null;
      }

      if (dismissableLayer) {
        dismissableLayer.destroy();
        dismissableLayer = null;
      }

      contentEl.style.display = "none";

      // Unmount from portal
      if (shouldUsePortal) {
        unmountFromPortal(contentEl);
        if (originalParent) {
          originalParent.appendChild(contentEl);
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

  // Set up trigger open/close handler
  const toggleHandler = adapter.on(triggerEl, "click", (e) => {
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
    destroy() {
      toggleHandler();
      close();
      if (focusTrapCleanup) focusTrapCleanup();
      if (dismissableLayer) dismissableLayer.destroy();
    },
  };
}
