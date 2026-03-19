import { createControllableState } from "./core/controllable-state.js";
import { createDismissableLayer } from "./core/dismissable-layer.js";
import { KEY, createKeyboardHandler } from "./core/keyboard.js";
import {
  ensurePortalRoot,
  mountToPortal,
  unmountFromPortal,
} from "./core/portal.js";
import { applyPosition, computePosition } from "./core/positioning.js";
import { defaultDomAdapter } from "./core/events.js";
import type {
  PrimitiveController,
  PrimitivePlacement,
  PrimitiveStateOptions,
} from "./core/types.js";
import type { EventAdapter } from "./core/events.js";

export interface SelectOptions extends PrimitiveStateOptions<string | null> {
  placement?: PrimitivePlacement;
  offset?: number;
  portal?: boolean;
  adapter?: EventAdapter;
}

export interface SelectController extends PrimitiveController {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  select(value: string): void;
  value(): string | null;
  highlight(index: number): void;
}

export function createSelectController(
  triggerEl: HTMLElement,
  listEl: HTMLElement,
  options?: SelectOptions,
): SelectController {
  const shouldUsePortal = options?.portal !== false;
  const adapter = options?.adapter ?? defaultDomAdapter;
  const placement = options?.placement ?? "bottom-start";
  const offset = options?.offset ?? 8;

  const state = createControllableState<string | null>({
    value: options?.value,
    defaultValue: options?.defaultValue ?? null,
    onChange: options?.onChange,
    cell: options?.cell,
  });

  let openState = false;
  let highlightedIndex = -1;
  let dismissableLayer: ReturnType<typeof createDismissableLayer> | null = null;
  let originalParent: HTMLElement | null = null;
  let listKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

  const listId = `select-${Math.random().toString(36).substr(2, 9)}`;

  const getOptions = (): HTMLElement[] => {
    return Array.from(listEl.querySelectorAll("[data-hx-option]"));
  };

  const getOptionValue = (optionEl: HTMLElement): string => {
    return (
      optionEl.getAttribute("data-hx-value") ??
      optionEl.dataset.value ??
      optionEl.textContent?.trim() ??
      ""
    );
  };

  const getOptionLabel = (optionEl: HTMLElement): string => {
    return (
      optionEl.getAttribute("data-hx-label") ??
      optionEl.textContent?.trim() ??
      ""
    );
  };

  const updateSelection = () => {
    const selectedValue = state.get();
    const options = getOptions();

    options.forEach((option, index) => {
      const isSelected = getOptionValue(option) === selectedValue;
      option.id = option.id || `${listId}-option-${index}`;
      option.tabIndex = -1;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", isSelected ? "true" : "false");
      option.setAttribute("data-hx-selected", isSelected ? "true" : "false");
    });

    const selectedOption = options.find(
      (option) => getOptionValue(option) === selectedValue,
    );
    const selectedLabel = selectedOption ? getOptionLabel(selectedOption) : "";
    triggerEl.setAttribute("data-hx-value", selectedValue ?? "");
    triggerEl.setAttribute("data-hx-label", selectedLabel);
    if (
      selectedOption &&
      (triggerEl.childElementCount === 0 ||
        triggerEl.getAttribute("data-hx-select-label") === "true")
    ) {
      triggerEl.textContent = selectedLabel;
    }
  };

  const highlight = (index: number) => {
    const options = getOptions();
    if (options.length === 0) {
      highlightedIndex = -1;
      return;
    }

    const boundedIndex = Math.max(0, Math.min(index, options.length - 1));
    highlightedIndex = boundedIndex;

    options.forEach((option, optionIndex) => {
      option.setAttribute(
        "data-hx-highlighted",
        optionIndex === boundedIndex ? "true" : "false",
      );
    });

    options[boundedIndex]?.focus();
  };

  const teardownFloating = () => {
    if (listKeydownHandler) {
      listEl.removeEventListener("keydown", listKeydownHandler);
      listKeydownHandler = null;
    }

    if (dismissableLayer) {
      dismissableLayer.destroy();
      dismissableLayer = null;
    }

    if (shouldUsePortal) {
      unmountFromPortal(listEl);
      if (originalParent) {
        originalParent.appendChild(listEl);
        originalParent = null;
      }
    }
  };

  const updateDisplay = () => {
    listEl.id = listId;
    listEl.setAttribute("role", "listbox");
    listEl.setAttribute("data-hx-open", openState ? "true" : "false");
    triggerEl.setAttribute("aria-haspopup", "listbox");
    triggerEl.setAttribute("aria-controls", listId);
    triggerEl.setAttribute("aria-expanded", openState ? "true" : "false");

    updateSelection();

    if (openState) {
      teardownFloating();

      if (shouldUsePortal) {
        originalParent = listEl.parentElement;
        mountToPortal(listEl);
      }

      const pos = computePosition(triggerEl, listEl, { placement, offset });
      applyPosition(listEl, pos);
      listEl.style.display = "block";

      listKeydownHandler = createKeyboardHandler({
        [KEY.ArrowDown]: (event) => {
          event.preventDefault();
          const nextIndex =
            highlightedIndex >= getOptions().length - 1
              ? 0
              : highlightedIndex + 1;
          highlight(nextIndex);
        },
        [KEY.ArrowUp]: (event) => {
          event.preventDefault();
          const options = getOptions();
          const nextIndex =
            highlightedIndex <= 0 ? options.length - 1 : highlightedIndex - 1;
          highlight(nextIndex);
        },
        [KEY.Home]: (event) => {
          event.preventDefault();
          highlight(0);
        },
        [KEY.End]: (event) => {
          event.preventDefault();
          highlight(getOptions().length - 1);
        },
        [KEY.Enter]: (event) => {
          event.preventDefault();
          const option = getOptions()[highlightedIndex];
          if (option) {
            select(getOptionValue(option));
          }
        },
        [KEY.Space]: (event) => {
          event.preventDefault();
          const option = getOptions()[highlightedIndex];
          if (option) {
            select(getOptionValue(option));
          }
        },
        [KEY.Escape]: (event) => {
          event.preventDefault();
          close();
        },
      });
      listEl.addEventListener("keydown", listKeydownHandler);

      dismissableLayer = createDismissableLayer({
        element: listEl,
        onDismiss: () => close(),
      });
      dismissableLayer.mount();
    } else {
      listEl.style.display = "none";
      highlightedIndex = -1;
      getOptions().forEach((option) => {
        option.setAttribute("data-hx-highlighted", "false");
      });
      teardownFloating();
    }
  };

  const open = () => {
    if (openState) {
      return;
    }
    openState = true;
    updateDisplay();
    const selectedIndex = getOptions().findIndex(
      (option) => getOptionValue(option) === state.get(),
    );
    highlight(selectedIndex >= 0 ? selectedIndex : 0);
  };

  const close = () => {
    if (!openState) {
      return;
    }
    openState = false;
    updateDisplay();
  };

  const toggle = () => {
    if (openState) {
      close();
      return;
    }
    open();
  };

  const isOpen = () => openState;

  const select = (value: string) => {
    state.set(value);
    updateSelection();
    close();
  };

  const value = () => state.get();

  const triggerClickHandler = adapter.on(triggerEl, "click", (event) => {
    event.preventDefault();
    toggle();
  });

  const triggerKeydownHandler = createKeyboardHandler({
    [KEY.ArrowDown]: (event) => {
      event.preventDefault();
      if (!openState) {
        open();
        return;
      }
      highlight(highlightedIndex + 1);
    },
    [KEY.ArrowUp]: (event) => {
      event.preventDefault();
      if (!openState) {
        open();
        const options = getOptions();
        highlight(options.length - 1);
        return;
      }
      highlight(
        highlightedIndex <= 0 ? getOptions().length - 1 : highlightedIndex - 1,
      );
    },
    [KEY.Enter]: (event) => {
      event.preventDefault();
      toggle();
    },
    [KEY.Space]: (event) => {
      event.preventDefault();
      toggle();
    },
    [KEY.Escape]: (event) => {
      event.preventDefault();
      close();
    },
  });

  const triggerKeyHandler = adapter.on(triggerEl, "keydown", (event) => {
    triggerKeydownHandler(event as KeyboardEvent);
  });

  const listClickHandler = adapter.on(listEl, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const option = target.closest("[data-hx-option]");
    if (!(option instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    select(getOptionValue(option));
  });

  if (shouldUsePortal) {
    ensurePortalRoot();
  }

  updateDisplay();

  if (options?.cell) {
    options.cell.subscribe(() => {
      updateSelection();
      if (openState) {
        updateDisplay();
      }
    });
  }

  return {
    open,
    close,
    toggle,
    isOpen,
    select,
    value,
    highlight,
    destroy() {
      triggerClickHandler();
      triggerKeyHandler();
      listClickHandler();
      close();
    },
  };
}
