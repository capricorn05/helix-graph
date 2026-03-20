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
import { createAutocomplete } from "../../helix/autocomplete.js";
import {
  bindTargetTextValue,
  createDomTargetScope,
  listenToTarget,
} from "../../helix/client-dom.js";
import { installRuntimeReactivePatchBindings } from "../../helix/client-reactivity.js";
import type { PrimitiveController } from "../../helix/primitives/core/types.js";
import {
  makeInitialPrimitiveMessageFormState,
  type HelixClientRuntime,
} from "./runtime.js";

interface MountedPrimitiveControllers {
  root: HTMLElement | null;
  key: string | null;
  controllers: PrimitiveController[];
}

const demoMount: MountedPrimitiveControllers = {
  root: null,
  key: null,
  controllers: [],
};

const searchMount: MountedPrimitiveControllers = {
  root: null,
  key: null,
  controllers: [],
};

const settingsMount: MountedPrimitiveControllers = {
  root: null,
  key: null,
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
  key: string,
  factory: (rootEl: HTMLElement) => PrimitiveController[],
): void {
  if (mounted.root === root && mounted.key === key) {
    return;
  }

  destroyControllers(mounted.controllers);
  mounted.controllers = [];
  mounted.root = root;
  mounted.key = key;

  if (!root) {
    return;
  }

  mounted.controllers = factory(root);
}

function getHelixRuntime(): HelixClientRuntime | null {
  return typeof window !== "undefined"
    ? (window.__HELIX_RUNTIME__ ?? null)
    : null;
}

interface SearchAutocompleteSuggestion {
  id: number;
  name: string;
  email: string;
  status: "active" | "pending";
}

interface SearchAutocompleteResponse {
  suggestions: SearchAutocompleteSuggestion[];
}

function escapeAutocompleteText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderSearchAutocompleteOptions(
  suggestions: readonly SearchAutocompleteSuggestion[],
): string {
  if (suggestions.length === 0) {
    return '<div class="primitive-option" aria-disabled="true">No matching users</div>';
  }

  return suggestions
    .map((suggestion) => {
      const optionLabel = `${suggestion.name} (${suggestion.email})`;
      const optionMeta = suggestion.status === "active" ? "Active" : "Pending";

      return `<div data-hx-option data-hx-value="${escapeAutocompleteText(optionLabel)}" data-hx-label="${escapeAutocompleteText(optionLabel)}" class="primitive-option">${escapeAutocompleteText(optionLabel)}<span class="muted"> · ${optionMeta}</span></div>`;
    })
    .join("");
}

function updateSearchAutocompleteStatus(
  statusEl: HTMLElement | null,
  value: string,
): void {
  if (!(statusEl instanceof HTMLElement)) {
    return;
  }

  statusEl.textContent = value;
}

function installPrimitiveMessageReactivity(runtime: HelixClientRuntime): void {
  installRuntimeReactivePatchBindings(
    runtime,
    "primitive-message-reactivity",
    [
      {
        trigger: "primitive-message:label",
        source: runtime.primitiveMessageFormDerived.messageLabel,
        patches: (value) => [
          { op: "setText", targetId: "demo-message-label", value },
        ],
      },
      {
        trigger: "primitive-message:response",
        source: runtime.primitiveMessageFormStateCell,
        patches: (state) => [
          {
            op: "setText",
            targetId: "demo-message-response",
            value: state.response,
          },
        ],
      },
      {
        trigger: "primitive-message:submit-disabled",
        source: runtime.primitiveMessageFormDerived.submitDisabled,
        patches: (disabled) => [
          {
            op: "setAttr",
            targetId: "demo-message-submit",
            name: "disabled",
            value: disabled ? "disabled" : null,
          },
        ],
      },
    ],
    {
      flush: "microtask",
      dedupePatches: true,
      owner: runtime.viewScope,
    },
  );
}

export function syncPrimitiveMessageStateFromDom(
  runtime: HelixClientRuntime,
): void {
  installPrimitiveMessageReactivity(runtime);

  const input = createDomTargetScope(document).query(
    "demo-message-input",
    HTMLInputElement,
  );
  if (!input) {
    runtime.primitiveMessageForm = makeInitialPrimitiveMessageFormState();
    return;
  }

  runtime.primitiveMessageForm = {
    ...makeInitialPrimitiveMessageFormState(),
    message: input.value,
  };
}

function mountPrimitivesDemoPage(root: HTMLElement): PrimitiveController[] {
  const controllers: PrimitiveController[] = [];
  const targets = createDomTargetScope(root);
  const runtime = getHelixRuntime();

  const dialogTrigger = targets.query("demo-dialog-trigger", HTMLElement);
  const dialogContent = targets.query("demo-dialog-content", HTMLElement);
  if (
    dialogTrigger instanceof HTMLElement &&
    dialogContent instanceof HTMLElement
  ) {
    const dialog = createDialogController(dialogTrigger, dialogContent, {
      portal: false,
      openDisplay: "flex",
    });
    controllers.push(dialog);

    const dialogCloseController = listenToTarget({
      root,
      targetId: "demo-dialog-close",
      type: HTMLElement,
      event: "click",
      listener: () => {
        dialog.close();
      },
    });
    if (dialogCloseController) {
      controllers.push(dialogCloseController);
    }
  }

  const popoverTrigger = targets.query("demo-popover-trigger", HTMLElement);
  const popoverContent = targets.query("demo-popover-content", HTMLElement);
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

  const tooltipTrigger = targets.query("demo-tooltip-trigger", HTMLElement);
  const tooltipContent = targets.query("demo-tooltip-content", HTMLElement);
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

  const menuTrigger = targets.query("demo-menu-trigger", HTMLElement);
  const menuContent = targets.query("demo-menu-content", HTMLElement);
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

  const dropdownTrigger = targets.query("demo-dropdown-trigger", HTMLElement);
  const dropdownContent = targets.query("demo-dropdown-content", HTMLElement);
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

  const tabsRoot = targets.query("demo-tabs-root", HTMLElement);
  if (tabsRoot instanceof HTMLElement) {
    controllers.push(
      createTabsController(tabsRoot, {
        defaultValue: 0,
      }),
    );
  }

  const accordionRoot = targets.query("demo-accordion-root", HTMLElement);
  if (accordionRoot instanceof HTMLElement) {
    controllers.push(
      createAccordionController(accordionRoot, {
        defaultValue: [0],
        collapsible: true,
      }),
    );
  }

  const toastViewport = targets.query("demo-toast-viewport", HTMLElement);
  if (
    toastViewport instanceof HTMLElement &&
    targets.has("demo-toast-trigger")
  ) {
    const toast = createToastController(toastViewport, {
      placement: "bottom-end",
      defaultDuration: 2800,
    });

    controllers.push(toast);
    const toastTriggerController = listenToTarget({
      root,
      targetId: "demo-toast-trigger",
      type: HTMLElement,
      event: "click",
      listener: () => {
        toast.show(`Saved demo state at ${new Date().toLocaleTimeString()}`, {
          tone: "success",
        });
      },
    });
    if (toastTriggerController) {
      controllers.push(toastTriggerController);
    }
  }

  const selectTrigger = targets.query("demo-select-trigger", HTMLElement);
  const selectList = targets.query("demo-select-list", HTMLElement);
  const selectValue = targets.query("demo-select-value", HTMLElement);
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

  const comboboxInput = targets.query("demo-combobox-input", HTMLInputElement);
  const comboboxList = targets.query("demo-combobox-list", HTMLElement);
  const comboboxValue = targets.query("demo-combobox-value", HTMLElement);
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

  if (runtime) {
    const primitiveMessageInputBinding = bindTargetTextValue({
      root,
      targetId: "demo-message-input",
      type: HTMLInputElement,
      onValue: (value) => {
        runtime.primitiveMessageForm = {
          ...runtime.primitiveMessageForm,
          message: value,
        };
      },
    });

    if (primitiveMessageInputBinding) {
      controllers.push(primitiveMessageInputBinding);
    }
  }

  return controllers;
}

function mountSearchPageEnhancements(root: HTMLElement): PrimitiveController[] {
  const controllers: PrimitiveController[] = [];
  const targets = createDomTargetScope(root);
  const runtime = getHelixRuntime();

  const input = targets.query("search-combobox-input", HTMLInputElement);
  const list = targets.query("search-combobox-list", HTMLElement);
  const statusEl = targets.query("search-autocomplete-status", HTMLElement);
  if (input instanceof HTMLInputElement && list instanceof HTMLElement) {
    let pushAutocompleteQuery: ((value: string) => void) | null = null;

    const combobox = createComboboxController(input, list, {
      portal: false,
      onChange: (value) => {
        if (typeof value === "string") {
          input.value = value;
          pushAutocompleteQuery?.(value);
        }
      },
    });
    controllers.push(combobox);

    if (runtime) {
      const autocomplete = createAutocomplete<SearchAutocompleteSuggestion>({
        owner: runtime.viewScope,
        debounceMs: 180,
        minLength: 1,
        fetch: async (query) => {
          const params = new URLSearchParams({ q: query });
          const response = await fetch(`/api/users/suggest?${params.toString()}`);
          if (!response.ok) {
            throw new Error(
              `Search suggestion request failed with status ${response.status}`,
            );
          }

          const payload = (await response.json()) as SearchAutocompleteResponse;
          return Array.isArray(payload.suggestions) ? payload.suggestions : [];
        },
      });

      pushAutocompleteQuery = (value) => {
        autocomplete.setQuery(value);
      };

      const renderSearchAutocomplete = (): void => {
        const query = autocomplete.query.get().trim();
        const status = autocomplete.status.get();
        const results = autocomplete.results.get();

        if (!query) {
          list.innerHTML = "";
          list.style.display = "none";
          combobox.close();
          updateSearchAutocompleteStatus(
            statusEl,
            "Type to search users in real time.",
          );
          return;
        }

        if (status === "loading") {
          updateSearchAutocompleteStatus(statusEl, "Searching users...");
        } else if (status === "error") {
          list.innerHTML = "";
          list.style.display = "none";
          combobox.close();
          updateSearchAutocompleteStatus(
            statusEl,
            "Could not load suggestions right now.",
          );
          return;
        } else {
          const resultLabel =
            results.length === 1
              ? "1 suggestion"
              : `${results.length} suggestions`;
          updateSearchAutocompleteStatus(statusEl, `Showing ${resultLabel}.`);
        }

        list.innerHTML = renderSearchAutocompleteOptions(results);
        combobox.setQuery(input.value);
      };

      const queryUnsubscribe = autocomplete.query.subscribe(() => {
        renderSearchAutocomplete();
      });
      const statusUnsubscribe = autocomplete.status.subscribe(() => {
        renderSearchAutocomplete();
      });
      const resultUnsubscribe = autocomplete.results.subscribe(() => {
        renderSearchAutocomplete();
      });

      const inputBinding = bindTargetTextValue({
        root,
        targetId: "search-combobox-input",
        type: HTMLInputElement,
        onValue: (value) => {
          autocomplete.setQuery(value);
        },
      });
      if (inputBinding) {
        controllers.push(inputBinding);
      }

      controllers.push({
        destroy() {
          queryUnsubscribe();
          statusUnsubscribe();
          resultUnsubscribe();
          autocomplete.destroy();
        },
      });

      autocomplete.setQuery(input.value);
      renderSearchAutocomplete();
    }
  }

  const helpTrigger = targets.query("search-help-trigger", HTMLElement);
  const helpPopover = targets.query("search-help-popover", HTMLElement);
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
  const targets = createDomTargetScope(root);

  const selectTrigger = targets.query(
    "settings-page-size-trigger",
    HTMLElement,
  );
  const selectList = targets.query("settings-page-size-list", HTMLElement);
  const hiddenInput = targets.query(
    "settings-page-size-hidden",
    HTMLInputElement,
  );
  const status = targets.query("settings-page-size-status", HTMLElement);

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

  const helpTrigger = targets.query(
    "settings-page-size-help-trigger",
    HTMLElement,
  );
  const helpTooltip = targets.query(
    "settings-page-size-help-tooltip",
    HTMLElement,
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
  const runtime = getHelixRuntime();
  remountControllers(
    demoMount,
    demoRoot instanceof HTMLElement ? demoRoot : null,
    runtime ? "runtime-ready" : "runtime-missing",
    mountPrimitivesDemoPage,
  );

  const searchRoot = document.querySelector(
    '[data-hx-id="search-primitives-root"]',
  );
  remountControllers(
    searchMount,
    searchRoot instanceof HTMLElement ? searchRoot : null,
    "search",
    mountSearchPageEnhancements,
  );

  const settingsRoot = document.querySelector(
    '[data-hx-id="settings-primitives-root"]',
  );
  remountControllers(
    settingsMount,
    settingsRoot instanceof HTMLElement ? settingsRoot : null,
    "settings",
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
