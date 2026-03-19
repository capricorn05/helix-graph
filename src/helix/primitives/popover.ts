import { createControllableState } from "./core/controllable-state.js";
import { createDismissableLayer } from "./core/dismissable-layer.js";
import {
  ensurePortalRoot,
  mountToPortal,
  unmountFromPortal,
} from "./core/portal.js";
import { applyPosition, computePosition } from "./core/positioning.js";
import { setPopoverAttrs } from "./core/a11y.js";
import { defaultDomAdapter } from "./core/events.js";
import type {
  PrimitiveController,
  PrimitiveStateOptions,
  PrimitivePlacement,
} from "./core/types.js";
import type { EventAdapter } from "./core/events.js";

export interface PopoverOptions extends PrimitiveStateOptions<boolean> {
  placement?: PrimitivePlacement;
  offset?: number;
  portal?: boolean;
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
): PopoverController {
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

  const contentId = `popover-${Math.random().toString(36).substr(2, 9)}`;

  const updateDisplay = () => {
    const isOpen = state.get();
    contentEl.setAttribute("data-hx-open", isOpen ? "true" : "false");
    setPopoverAttrs(triggerEl, contentEl, contentId, isOpen);

    if (isOpen) {
      // Mount to portal
      if (shouldUsePortal) {
        originalParent = contentEl.parentElement;
        mountToPortal(contentEl);
      }

      // Position the popover
      const pos = computePosition(triggerEl, contentEl, { placement, offset });
      applyPosition(contentEl, pos);

      contentEl.style.display = "block";

      // Set up dismissable layer
      dismissableLayer = createDismissableLayer({
        element: contentEl,
        onDismiss: () => close(),
      });
      dismissableLayer.mount();
    } else {
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

  // Set up trigger click handler
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
      if (dismissableLayer) dismissableLayer.destroy();
    },
  };
}
