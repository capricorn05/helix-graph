import { createControllableState } from "./core/controllable-state.js";
import { KEY, createKeyboardHandler } from "./core/keyboard.js";
import { setTabsAttrs } from "./core/a11y.js";
import { defaultDomAdapter } from "./core/events.js";
import type {
  PrimitiveController,
  PrimitiveStateOptions,
} from "./core/types.js";
import type { EventAdapter } from "./core/events.js";

export interface TabsOptions extends PrimitiveStateOptions<number> {
  adapter?: EventAdapter;
}

export interface TabsController extends PrimitiveController {
  activate(index: number): void;
  activeIndex(): number;
}

export function createTabsController(
  tablistEl: HTMLElement,
  options?: TabsOptions,
): TabsController {
  const adapter = options?.adapter ?? defaultDomAdapter;

  const state = createControllableState<number>({
    value: options?.value,
    defaultValue: options?.defaultValue ?? 0,
    onChange: options?.onChange,
    cell: options?.cell,
  });

  const getTabs = (): HTMLElement[] => {
    return Array.from(tablistEl.querySelectorAll("[data-hx-tab]"));
  };

  const getPanels = (): HTMLElement[] => {
    return Array.from(tablistEl.querySelectorAll("[data-hx-panel]"));
  };

  const updateDisplay = () => {
    const activeIndex = state.get();
    const tabs = getTabs();
    const panels = getPanels();

    tabs.forEach((tab, idx) => {
      tab.setAttribute(
        "data-hx-active",
        idx === activeIndex ? "true" : "false",
      );
    });

    panels.forEach((panel, idx) => {
      panel.style.display = idx === activeIndex ? "block" : "none";
    });

    setTabsAttrs(tablistEl, tabs, panels, activeIndex);
  };

  const activate = (index: number) => {
    const tabs = getTabs();
    if (index >= 0 && index < tabs.length) {
      state.set(index);
      updateDisplay();
    }
  };

  const activeIndex = () => state.get();

  // Set up tab click handlers
  const tabHandlers: Array<() => void> = [];
  getTabs().forEach((tab, idx) => {
    const handler = adapter.on(tab, "click", (e) => {
      e.preventDefault();
      activate(idx);
    });
    tabHandlers.push(handler);
  });

  // Set up keyboard navigation
  const tablistKeydownHandler = createKeyboardHandler({
    [KEY.ArrowRight]: () => {
      const currentIndex = activeIndex();
      const tabs = getTabs();
      const nextIndex = (currentIndex + 1) % tabs.length;
      activate(nextIndex);
    },
    [KEY.ArrowLeft]: () => {
      const currentIndex = activeIndex();
      const tabs = getTabs();
      const nextIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
      activate(nextIndex);
    },
    [KEY.Home]: () => activate(0),
    [KEY.End]: () => {
      const tabs = getTabs();
      activate(tabs.length - 1);
    },
  });

  const keyHandler = adapter.on(tablistEl, "keydown", (e) => {
    tablistKeydownHandler(e as KeyboardEvent);
  });

  // Initial state
  updateDisplay();

  // Subscribe to state changes
  if (options?.cell) {
    options.cell.subscribe(() => updateDisplay());
  }

  return {
    activate,
    activeIndex,
    destroy() {
      tabHandlers.forEach((h) => h());
      keyHandler();
    },
  };
}
