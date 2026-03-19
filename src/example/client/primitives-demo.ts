import {
  createAccordionController,
  createComboboxController,
  createDialogController,
  createDropdownController,
  createMenuController,
  createPopoverController,
  createSelectController,
  createTabsController,
  createToastController,
  createTooltipController,
} from "../../helix/primitives/index.js";
import type { PrimitiveController } from "../../helix/primitives/core/types.js";

interface MountedPrimitiveControllers {
  root: HTMLElement | null;
  controllers: PrimitiveController[];
}

const demoMount: MountedPrimitiveControllers = {
  root: null,
  controllers: [],
};

const searchMount: MountedPrimitiveControllers = {
  root: null,
  controllers: [],
};

const settingsMount: MountedPrimitiveControllers = {
  root: null,
  controllers: [],
};

function destroyControllers(controllers: PrimitiveController[]): void {
  for (const controller of controllers) {
    controller.destroy();
  }
}

function remountControllers(
  mounted: MountedPrimitiveControllers,
  root: HTMLElement | null,
  factory: (rootEl: HTMLElement) => PrimitiveController[],
): void {
  if (mounted.root === root) {
    return;
  }

  destroyControllers(mounted.controllers);
  mounted.controllers = [];
  mounted.root = root;

  if (!root) {
    return;
  }

  mounted.controllers = factory(root);
}

function createEventController(
  target: EventTarget,
  type: string,
  listener: EventListener,
): PrimitiveController {
  target.addEventListener(type, listener);
  return {
    destroy() {
      target.removeEventListener(type, listener);
    },
  };
}

function mountPrimitivesDemoPage(root: HTMLElement): PrimitiveController[] {
  const controllers: PrimitiveController[] = [];

  const dialogTrigger = root.querySelector(
    '[data-hx-id="demo-dialog-trigger"]',
  );
  const dialogContent = root.querySelector(
    '[data-hx-id="demo-dialog-content"]',
  );
  const dialogClose = root.querySelector('[data-hx-id="demo-dialog-close"]');
  if (
    dialogTrigger instanceof HTMLElement &&
    dialogContent instanceof HTMLElement
  ) {
    const dialog = createDialogController(dialogTrigger, dialogContent, {
      portal: false,
      openDisplay: "flex",
    });
    controllers.push(dialog);

    if (dialogClose instanceof HTMLElement) {
      controllers.push(
        createEventController(dialogClose, "click", () => {
          dialog.close();
        }),
      );
    }
  }

  const popoverTrigger = root.querySelector(
    '[data-hx-id="demo-popover-trigger"]',
  );
  const popoverContent = root.querySelector(
    '[data-hx-id="demo-popover-content"]',
  );
  if (
    popoverTrigger instanceof HTMLElement &&
    popoverContent instanceof HTMLElement
  ) {
    controllers.push(
      createPopoverController(popoverTrigger, popoverContent, {
        portal: false,
        placement: "bottom-start",
      }),
    );
  }

  const tooltipTrigger = root.querySelector(
    '[data-hx-id="demo-tooltip-trigger"]',
  );
  const tooltipContent = root.querySelector(
    '[data-hx-id="demo-tooltip-content"]',
  );
  if (
    tooltipTrigger instanceof HTMLElement &&
    tooltipContent instanceof HTMLElement
  ) {
    controllers.push(
      createTooltipController(tooltipTrigger, tooltipContent, {
        portal: false,
        placement: "top",
        openDelay: 100,
      }),
    );
  }

  const menuTrigger = root.querySelector('[data-hx-id="demo-menu-trigger"]');
  const menuContent = root.querySelector('[data-hx-id="demo-menu-content"]');
  if (
    menuTrigger instanceof HTMLElement &&
    menuContent instanceof HTMLElement
  ) {
    controllers.push(
      createMenuController(menuTrigger, menuContent, {
        portal: false,
        placement: "bottom-start",
      }),
    );
  }

  const dropdownTrigger = root.querySelector(
    '[data-hx-id="demo-dropdown-trigger"]',
  );
  const dropdownContent = root.querySelector(
    '[data-hx-id="demo-dropdown-content"]',
  );
  if (
    dropdownTrigger instanceof HTMLElement &&
    dropdownContent instanceof HTMLElement
  ) {
    controllers.push(
      createDropdownController(dropdownTrigger, dropdownContent, {
        portal: false,
        placement: "bottom-start",
      }),
    );
  }

  const tabsRoot = root.querySelector('[data-hx-id="demo-tabs-root"]');
  if (tabsRoot instanceof HTMLElement) {
    controllers.push(
      createTabsController(tabsRoot, {
        defaultValue: 0,
      }),
    );
  }

  const accordionRoot = root.querySelector(
    '[data-hx-id="demo-accordion-root"]',
  );
  if (accordionRoot instanceof HTMLElement) {
    controllers.push(
      createAccordionController(accordionRoot, {
        defaultValue: [0],
        collapsible: true,
      }),
    );
  }

  const toastViewport = root.querySelector(
    '[data-hx-id="demo-toast-viewport"]',
  );
  const toastTrigger = root.querySelector('[data-hx-id="demo-toast-trigger"]');
  if (
    toastViewport instanceof HTMLElement &&
    toastTrigger instanceof HTMLElement
  ) {
    const toast = createToastController(toastViewport, {
      placement: "bottom-end",
      defaultDuration: 2800,
    });

    controllers.push(toast);
    controllers.push(
      createEventController(toastTrigger, "click", () => {
        toast.show(`Saved demo state at ${new Date().toLocaleTimeString()}`, {
          tone: "success",
        });
      }),
    );
  }

  const selectTrigger = root.querySelector(
    '[data-hx-id="demo-select-trigger"]',
  );
  const selectList = root.querySelector('[data-hx-id="demo-select-list"]');
  const selectValue = root.querySelector('[data-hx-id="demo-select-value"]');
  if (
    selectTrigger instanceof HTMLElement &&
    selectList instanceof HTMLElement &&
    selectValue instanceof HTMLElement
  ) {
    const select = createSelectController(selectTrigger, selectList, {
      portal: false,
      defaultValue: "medium",
      onChange: (value) => {
        const next = (value ?? "-").toString();
        selectValue.textContent = `Selected: ${next.charAt(0).toUpperCase()}${next.slice(1)}`;
      },
    });

    controllers.push(select);
  }

  const comboboxInput = root.querySelector(
    '[data-hx-id="demo-combobox-input"]',
  );
  const comboboxList = root.querySelector('[data-hx-id="demo-combobox-list"]');
  const comboboxValue = root.querySelector(
    '[data-hx-id="demo-combobox-value"]',
  );
  if (
    comboboxInput instanceof HTMLInputElement &&
    comboboxList instanceof HTMLElement &&
    comboboxValue instanceof HTMLElement
  ) {
    controllers.push(
      createComboboxController(comboboxInput, comboboxList, {
        portal: false,
        onChange: (value) => {
          comboboxValue.textContent = `Selected: ${value ?? "-"}`;
        },
      }),
    );
  }

  return controllers;
}

function mountSearchPageEnhancements(root: HTMLElement): PrimitiveController[] {
  const controllers: PrimitiveController[] = [];

  const input = root.querySelector('[data-hx-id="search-combobox-input"]');
  const list = root.querySelector('[data-hx-id="search-combobox-list"]');
  if (input instanceof HTMLInputElement && list instanceof HTMLElement) {
    controllers.push(
      createComboboxController(input, list, {
        portal: false,
      }),
    );
  }

  const helpTrigger = root.querySelector('[data-hx-id="search-help-trigger"]');
  const helpPopover = root.querySelector('[data-hx-id="search-help-popover"]');
  if (
    helpTrigger instanceof HTMLElement &&
    helpPopover instanceof HTMLElement
  ) {
    controllers.push(
      createPopoverController(helpTrigger, helpPopover, {
        portal: false,
        placement: "bottom-start",
      }),
    );
  }

  return controllers;
}

function mountSettingsPageEnhancements(
  root: HTMLElement,
): PrimitiveController[] {
  const controllers: PrimitiveController[] = [];

  const selectTrigger = root.querySelector(
    '[data-hx-id="settings-page-size-trigger"]',
  );
  const selectList = root.querySelector(
    '[data-hx-id="settings-page-size-list"]',
  );
  const hiddenInput = root.querySelector(
    '[data-hx-id="settings-page-size-hidden"]',
  );
  const status = root.querySelector('[data-hx-id="settings-page-size-status"]');

  if (
    selectTrigger instanceof HTMLElement &&
    selectList instanceof HTMLElement &&
    hiddenInput instanceof HTMLInputElement &&
    status instanceof HTMLElement
  ) {
    controllers.push(
      createSelectController(selectTrigger, selectList, {
        portal: false,
        defaultValue: hiddenInput.value,
        onChange: (value) => {
          hiddenInput.value = value ?? "";
          status.textContent = `Selected page size: ${hiddenInput.value || "-"} (read-only in demo mode)`;
        },
      }),
    );
  }

  const helpTrigger = root.querySelector(
    '[data-hx-id="settings-page-size-help-trigger"]',
  );
  const helpTooltip = root.querySelector(
    '[data-hx-id="settings-page-size-help-tooltip"]',
  );

  if (
    helpTrigger instanceof HTMLElement &&
    helpTooltip instanceof HTMLElement
  ) {
    controllers.push(
      createTooltipController(helpTrigger, helpTooltip, {
        portal: false,
        placement: "right",
      }),
    );
  }

  return controllers;
}

function mountAllPrimitiveEnhancements(): void {
  const demoRoot = document.querySelector(
    '[data-hx-id="primitives-demo-root"]',
  );
  remountControllers(
    demoMount,
    demoRoot instanceof HTMLElement ? demoRoot : null,
    mountPrimitivesDemoPage,
  );

  const searchRoot = document.querySelector(
    '[data-hx-id="search-primitives-root"]',
  );
  remountControllers(
    searchMount,
    searchRoot instanceof HTMLElement ? searchRoot : null,
    mountSearchPageEnhancements,
  );

  const settingsRoot = document.querySelector(
    '[data-hx-id="settings-primitives-root"]',
  );
  remountControllers(
    settingsMount,
    settingsRoot instanceof HTMLElement ? settingsRoot : null,
    mountSettingsPageEnhancements,
  );
}

export function initializePrimitiveEnhancements(): void {
  mountAllPrimitiveEnhancements();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => {
      initializePrimitiveEnhancements();
    });
  } else {
    initializePrimitiveEnhancements();
  }
}
