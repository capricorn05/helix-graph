import { uiButton, uiInput } from "../../helix/ui.js";
import { renderSettingsCompiledView } from "./compiled/settings.compiled.js";

export function renderSettingsPage(): string {
  return renderSettingsCompiledView({
    autoActivateInputHtml: uiInput({
      name: "auto-activate",
      type: "checkbox",
      checked: true,
      disabled: true,
    }),
    pageSizeControlHtml: `<div class="primitive-select-wrap">
      <button type="button" data-hx-id="settings-page-size-trigger" data-hx-select-label="true">6</button>
      <div data-hx-id="settings-page-size-list" class="primitive-listbox" style="display: none;">
        <div data-hx-option data-hx-value="6" class="primitive-option">6</div>
        <div data-hx-option data-hx-value="12" class="primitive-option">12</div>
        <div data-hx-option data-hx-value="24" class="primitive-option">24</div>
      </div>
      <input type="hidden" name="page-size" value="6" data-hx-id="settings-page-size-hidden" />
    </div>`,
    pageSizeHelpTriggerHtml: uiButton({
      label: "Page Size Help",
      type: "button",
      variant: "secondary",
      attrs: { "data-hx-id": "settings-page-size-help-trigger" },
    }),
    pageSizeHelpTooltipHtml: `<div data-hx-id="settings-page-size-help-tooltip" class="primitive-surface primitive-tooltip" style="display: none;">
      Uses the headless Select primitive; selection updates local form state only.
    </div>`,
  });
}
