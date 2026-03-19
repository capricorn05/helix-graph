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

export interface ComboboxOptions extends PrimitiveStateOptions<string | null> {
  placement?: PrimitivePlacement;
  offset?: number;
  portal?: boolean;
  adapter?: EventAdapter;
  filter?: (query: string, optionEl: HTMLElement) => boolean;
}

export interface ComboboxController extends PrimitiveController {
  open(): void;
  close(): void;
  isOpen(): boolean;
  select(value: string): void;
  value(): string | null;
  query(): string;
  setQuery(query: string): void;
  highlight(index: number): void;
}

export function createComboboxController(
  inputEl: HTMLInputElement,
  listEl: HTMLElement,
  options?: ComboboxOptions,
): ComboboxController {
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

  const listId = `combobox-${Math.random().toString(36).substr(2, 9)}`;

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

  const filterOption = (query: string, optionEl: HTMLElement): boolean => {
    if (options?.filter) {
      return options.filter(query, optionEl);
    }
    return getOptionLabel(optionEl).toLowerCase().includes(query.toLowerCase());
  };

  const getVisibleOptions = (): HTMLElement[] => {
    return getOptions().filter((option) => !option.hidden);
  };

  const updateSelection = () => {
    const selectedValue = state.get();
    getOptions().forEach((option, index) => {
      const isSelected = getOptionValue(option) === selectedValue;
      option.id = option.id || `${listId}-option-${index}`;
      option.tabIndex = -1;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", isSelected ? "true" : "false");
      option.setAttribute("data-hx-selected", isSelected ? "true" : "false");
    });

    inputEl.setAttribute("data-hx-value", selectedValue ?? "");
  };

  const updateFilteredOptions = () => {
    const queryValue = inputEl.value.trim();

    getOptions().forEach((option) => {
      const visible = filterOption(queryValue, option);
      option.hidden = !visible;
      option.style.display = visible ? "block" : "none";
    });

    const visibleOptions = getVisibleOptions();
    if (visibleOptions.length === 0) {
      highlightedIndex = -1;
      return;
    }

    if (highlightedIndex < 0 || highlightedIndex >= visibleOptions.length) {
      highlightedIndex = 0;
    }
  };

  const highlight = (index: number) => {
    const visibleOptions = getVisibleOptions();
    if (visibleOptions.length === 0) {
      highlightedIndex = -1;
      return;
    }

    const boundedIndex = Math.max(
      0,
      Math.min(index, visibleOptions.length - 1),
    );
    highlightedIndex = boundedIndex;

    getOptions().forEach((option) => {
      option.setAttribute("data-hx-highlighted", "false");
    });

    const activeOption = visibleOptions[boundedIndex];
    if (!activeOption) {
      return;
    }

    activeOption.setAttribute("data-hx-highlighted", "true");
    inputEl.setAttribute("aria-activedescendant", activeOption.id);
    activeOption.focus();
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

    inputEl.setAttribute("role", "combobox");
    inputEl.setAttribute("aria-autocomplete", "list");
    inputEl.setAttribute("aria-controls", listId);
    inputEl.setAttribute("aria-expanded", openState ? "true" : "false");

    updateSelection();
    updateFilteredOptions();

    if (openState && getVisibleOptions().length > 0) {
      teardownFloating();

      if (shouldUsePortal) {
        originalParent = listEl.parentElement;
        mountToPortal(listEl);
      }

      const pos = computePosition(inputEl, listEl, { placement, offset });
      applyPosition(listEl, pos);
      listEl.style.display = "block";

      listKeydownHandler = createKeyboardHandler({
        [KEY.ArrowDown]: (event) => {
          event.preventDefault();
          const visible = getVisibleOptions();
          const nextIndex =
            highlightedIndex >= visible.length - 1 ? 0 : highlightedIndex + 1;
          highlight(nextIndex);
        },
        [KEY.ArrowUp]: (event) => {
          event.preventDefault();
          const visible = getVisibleOptions();
          const nextIndex =
            highlightedIndex <= 0 ? visible.length - 1 : highlightedIndex - 1;
          highlight(nextIndex);
        },
        [KEY.Home]: (event) => {
          event.preventDefault();
          highlight(0);
        },
        [KEY.End]: (event) => {
          event.preventDefault();
          highlight(getVisibleOptions().length - 1);
        },
        [KEY.Enter]: (event) => {
          event.preventDefault();
          const option = getVisibleOptions()[highlightedIndex];
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
      inputEl.removeAttribute("aria-activedescendant");
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
    highlight(highlightedIndex >= 0 ? highlightedIndex : 0);
  };

  const close = () => {
    if (!openState) {
      return;
    }
    openState = false;
    updateDisplay();
  };

  const isOpen = () => openState;

  const select = (value: string) => {
    const option = getOptions().find(
      (candidate) => getOptionValue(candidate) === value,
    );
    state.set(value);
    if (option) {
      inputEl.value = getOptionLabel(option);
    }
    updateSelection();
    close();
  };

  const query = () => inputEl.value;

  const setQuery = (queryValue: string) => {
    inputEl.value = queryValue;
    updateFilteredOptions();
    if (document.activeElement === inputEl && getVisibleOptions().length > 0) {
      open();
      return;
    }
    updateDisplay();
  };

  const inputFocusHandler = adapter.on(inputEl, "focus", () => {
    updateFilteredOptions();
    if (getVisibleOptions().length > 0) {
      open();
    }
  });

  const inputHandler = adapter.on(inputEl, "input", () => {
    updateFilteredOptions();
    if (getVisibleOptions().length > 0) {
      open();
      return;
    }
    close();
  });

  const inputBlurHandler = adapter.on(inputEl, "blur", () => {
    setTimeout(() => {
      if (
        document.activeElement !== inputEl &&
        !listEl.contains(document.activeElement)
      ) {
        close();
      }
    }, 0);
  });

  const inputKeydownHandler = createKeyboardHandler({
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
        const visible = getVisibleOptions();
        highlight(visible.length - 1);
        return;
      }
      const visible = getVisibleOptions();
      highlight(
        highlightedIndex <= 0 ? visible.length - 1 : highlightedIndex - 1,
      );
    },
    [KEY.Enter]: (event) => {
      if (!openState) {
        return;
      }
      event.preventDefault();
      const option = getVisibleOptions()[highlightedIndex];
      if (option) {
        select(getOptionValue(option));
      }
    },
    [KEY.Escape]: (event) => {
      event.preventDefault();
      close();
    },
  });

  const inputKeyHandler = adapter.on(inputEl, "keydown", (event) => {
    inputKeydownHandler(event as KeyboardEvent);
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
      updateFilteredOptions();
      if (openState) {
        updateDisplay();
      }
    });
  }

  return {
    open,
    close,
    isOpen,
    select,
    value() {
      return state.get();
    },
    query,
    setQuery,
    highlight,
    destroy() {
      inputFocusHandler();
      inputHandler();
      inputBlurHandler();
      inputKeyHandler();
      listClickHandler();
      close();
    },
  };
}
