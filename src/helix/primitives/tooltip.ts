import { createControllableState } from "./core/controllable-state.js";
import {
  ensurePortalRoot,
  mountToPortal,
  unmountFromPortal,
} from "./core/portal.js";
import { applyPosition, computePosition } from "./core/positioning.js";
import { KEY, createKeyboardHandler } from "./core/keyboard.js";
import { defaultDomAdapter } from "./core/events.js";
import type {
  PrimitiveController,
  PrimitivePlacement,
  PrimitiveStateOptions,
} from "./core/types.js";
import type { EventAdapter } from "./core/events.js";

export interface TooltipOptions extends PrimitiveStateOptions<boolean> {
  placement?: PrimitivePlacement;
  offset?: number;
  portal?: boolean;
  openDelay?: number;
  closeDelay?: number;
  adapter?: EventAdapter;
}

export interface TooltipController extends PrimitiveController {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

export function createTooltipController(
  triggerEl: HTMLElement,
  contentEl: HTMLElement,
  options?: TooltipOptions,
): TooltipController {
  const shouldUsePortal = options?.portal !== false;
  const adapter = options?.adapter ?? defaultDomAdapter;
  const placement = options?.placement ?? "top";
  const offset = options?.offset ?? 8;
  const openDelay = options?.openDelay ?? 0;
  const closeDelay = options?.closeDelay ?? 0;

  const state = createControllableState<boolean>({
    value: options?.value,
    defaultValue: options?.defaultValue ?? false,
    onChange: options?.onChange,
    cell: options?.cell,
  });

  let originalParent: HTMLElement | null = null;
  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;

  const clearTimers = () => {
    if (openTimer) {
      clearTimeout(openTimer);
      openTimer = null;
    }
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  };

  const updateDisplay = () => {
    const isOpen = state.get();
    contentEl.id = tooltipId;
    contentEl.setAttribute("role", "tooltip");
    contentEl.setAttribute("data-hx-open", isOpen ? "true" : "false");

    if (isOpen) {
      if (shouldUsePortal) {
        originalParent = contentEl.parentElement;
        mountToPortal(contentEl);
      }

      const pos = computePosition(triggerEl, contentEl, { placement, offset });
      applyPosition(contentEl, pos);
      contentEl.style.display = "block";
      triggerEl.setAttribute("aria-describedby", tooltipId);
    } else {
      contentEl.style.display = "none";
      triggerEl.removeAttribute("aria-describedby");

      if (shouldUsePortal) {
        unmountFromPortal(contentEl);
        if (originalParent) {
          originalParent.appendChild(contentEl);
          originalParent = null;
        }
      }
    }
  };

  const openNow = () => {
    state.set(true);
    updateDisplay();
  };

  const closeNow = () => {
    state.set(false);
    updateDisplay();
  };

  const open = () => {
    clearTimers();
    if (openDelay > 0) {
      openTimer = setTimeout(() => openNow(), openDelay);
      return;
    }
    openNow();
  };

  const close = () => {
    clearTimers();
    if (closeDelay > 0) {
      closeTimer = setTimeout(() => closeNow(), closeDelay);
      return;
    }
    closeNow();
  };

  const isOpen = () => state.get();

  const escapeHandler = createKeyboardHandler({
    [KEY.Escape]: (event) => {
      event.preventDefault();
      close();
    },
  });

  const triggerMouseEnter = adapter.on(triggerEl, "mouseenter", () => open());
  const triggerMouseLeave = adapter.on(triggerEl, "mouseleave", () => close());
  const triggerFocus = adapter.on(triggerEl, "focus", () => open());
  const triggerBlur = adapter.on(triggerEl, "blur", () => close());
  const triggerKeydown = adapter.on(triggerEl, "keydown", (event) => {
    escapeHandler(event as KeyboardEvent);
  });
  const contentMouseEnter = adapter.on(contentEl, "mouseenter", () => open());
  const contentMouseLeave = adapter.on(contentEl, "mouseleave", () => close());

  if (shouldUsePortal) {
    ensurePortalRoot();
  }

  updateDisplay();

  if (options?.cell) {
    options.cell.subscribe(() => updateDisplay());
  }

  return {
    open,
    close,
    isOpen,
    destroy() {
      clearTimers();
      triggerMouseEnter();
      triggerMouseLeave();
      triggerFocus();
      triggerBlur();
      triggerKeydown();
      contentMouseEnter();
      contentMouseLeave();
      closeNow();
    },
  };
}
