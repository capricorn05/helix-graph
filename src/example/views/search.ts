import { uiButton, uiInput } from "../../helix/ui.js";
import { renderSearchCompiledView } from "./compiled/search.compiled.js";

export function renderSearchPage(): string {
  return renderSearchCompiledView({
    searchInputHtml: uiInput({
      name: "q",
      placeholder: "Enter name or email...",
      attrs: {
        autofocus: true,
        autocomplete: "off",
        "data-hx-id": "search-combobox-input",
      },
    }),
    searchSuggestionsHtml: `<div data-hx-id="search-combobox-list" class="primitive-listbox" style="display: none;">
      <div data-hx-option data-hx-value="name:a-z" class="primitive-option">Users by name (A-Z)</div>
      <div data-hx-option data-hx-value="name:z-a" class="primitive-option">Users by name (Z-A)</div>
      <div data-hx-option data-hx-value="email" class="primitive-option">Users by email</div>
      <div data-hx-option data-hx-value="active" class="primitive-option">Active users</div>
    </div>`,
    searchStatusHtml:
      '<p data-hx-id="search-autocomplete-status" class="muted">Type to search users in real time.</p>',
    searchButtonHtml: uiButton({
      label: "Search",
      type: "submit",
      attrs: { "data-hx-id": "search-submit-btn" },
    }),
    searchHelpTriggerHtml: uiButton({
      label: "Search Help",
      type: "button",
      variant: "secondary",
      attrs: { "data-hx-id": "search-help-trigger" },
    }),
    searchHelpPopoverHtml: `<div data-hx-id="search-help-popover" class="primitive-surface" style="display: none;">
      Choose a suggestion with arrow keys, then press Enter to fill the input.
    </div>`,
  });
}
