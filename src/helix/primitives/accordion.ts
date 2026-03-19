import { createControllableState } from "./core/controllable-state.js";
import { KEY, createKeyboardHandler } from "./core/keyboard.js";
import { defaultDomAdapter } from "./core/events.js";
import type {
  PrimitiveController,
  PrimitiveStateOptions,
} from "./core/types.js";
import type { EventAdapter } from "./core/events.js";

export interface AccordionOptions extends PrimitiveStateOptions<number[]> {
  multiple?: boolean;
  collapsible?: boolean;
  adapter?: EventAdapter;
}

export interface AccordionController extends PrimitiveController {
  open(index: number): void;
  close(index: number): void;
  toggle(index: number): void;
  openItems(): number[];
}

export function createAccordionController(
  rootEl: HTMLElement,
  options?: AccordionOptions,
): AccordionController {
  const adapter = options?.adapter ?? defaultDomAdapter;
  const multiple = options?.multiple ?? false;
  const collapsible = options?.collapsible ?? true;

  const state = createControllableState<number[]>({
    value: options?.value,
    defaultValue: options?.defaultValue ?? [],
    onChange: options?.onChange,
    cell: options?.cell,
  });

  const accordionId = `accordion-${Math.random().toString(36).substr(2, 9)}`;

  const getItems = (): HTMLElement[] => {
    return Array.from(rootEl.querySelectorAll("[data-hx-accordion-item]"));
  };

  const getTriggers = (): HTMLElement[] => {
    return Array.from(rootEl.querySelectorAll("[data-hx-accordion-trigger]"));
  };

  const getContents = (): HTMLElement[] => {
    return Array.from(rootEl.querySelectorAll("[data-hx-accordion-content]"));
  };

  const normalize = (openItems: number[]): number[] => {
    const valid = Array.from(new Set(openItems.filter((index) => index >= 0)));
    if (multiple) {
      return valid.sort((a, b) => a - b);
    }
    return valid.length > 0 ? [valid[valid.length - 1]] : [];
  };

  const updateDisplay = () => {
    const openItems = normalize(state.get());
    const items = getItems();
    const triggers = getTriggers();
    const contents = getContents();

    rootEl.setAttribute("data-hx-accordion", "true");

    items.forEach((item, index) => {
      const isOpen = openItems.includes(index);
      item.setAttribute("data-hx-open", isOpen ? "true" : "false");
    });

    triggers.forEach((trigger, index) => {
      const isOpen = openItems.includes(index);
      const content = contents[index];
      const contentId = `${accordionId}-panel-${index}`;

      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (content) {
        content.id = contentId;
        trigger.setAttribute("aria-controls", contentId);
      }
    });

    contents.forEach((content, index) => {
      const isOpen = openItems.includes(index);
      content.setAttribute("role", "region");
      content.style.display = isOpen ? "block" : "none";
      content.setAttribute("data-hx-open", isOpen ? "true" : "false");
    });
  };

  const setOpenItems = (next: number[]) => {
    state.set(normalize(next));
    updateDisplay();
  };

  const open = (index: number) => {
    const current = normalize(state.get());
    if (multiple) {
      setOpenItems([...current, index]);
      return;
    }
    setOpenItems([index]);
  };

  const close = (index: number) => {
    const current = normalize(state.get());
    if (!current.includes(index)) {
      return;
    }

    if (!collapsible && !multiple && current.length === 1) {
      return;
    }

    setOpenItems(current.filter((value) => value !== index));
  };

  const toggle = (index: number) => {
    const current = normalize(state.get());
    if (current.includes(index)) {
      close(index);
      return;
    }
    open(index);
  };

  const openItems = () => normalize(state.get());

  const focusTrigger = (index: number) => {
    const triggers = getTriggers();
    if (triggers[index]) {
      triggers[index].focus();
    }
  };

  const triggerHandlers: Array<() => void> = [];
  getTriggers().forEach((trigger, index) => {
    triggerHandlers.push(
      adapter.on(trigger, "click", (event) => {
        event.preventDefault();
        toggle(index);
      }),
    );

    const keydownHandler = createKeyboardHandler({
      [KEY.Enter]: (event) => {
        event.preventDefault();
        toggle(index);
      },
      [KEY.Space]: (event) => {
        event.preventDefault();
        toggle(index);
      },
      [KEY.ArrowDown]: (event) => {
        event.preventDefault();
        const triggers = getTriggers();
        focusTrigger((index + 1) % triggers.length);
      },
      [KEY.ArrowUp]: (event) => {
        event.preventDefault();
        const triggers = getTriggers();
        focusTrigger(index === 0 ? triggers.length - 1 : index - 1);
      },
      [KEY.Home]: (event) => {
        event.preventDefault();
        focusTrigger(0);
      },
      [KEY.End]: (event) => {
        event.preventDefault();
        const triggers = getTriggers();
        focusTrigger(triggers.length - 1);
      },
    });

    triggerHandlers.push(
      adapter.on(trigger, "keydown", (event) => {
        keydownHandler(event as KeyboardEvent);
      }),
    );
  });

  updateDisplay();

  if (options?.cell) {
    options.cell.subscribe(() => updateDisplay());
  }

  return {
    open,
    close,
    toggle,
    openItems,
    destroy() {
      triggerHandlers.forEach((handler) => handler());
    },
  };
}
