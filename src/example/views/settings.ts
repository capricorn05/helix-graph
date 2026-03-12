import { uiInput, uiSelect } from "../../helix/ui.js";
import { renderSettingsCompiledView } from "./compiled/settings.compiled.js";

export function renderSettingsPage(): string {
  return renderSettingsCompiledView({
    autoActivateInputHtml: uiInput({
      name: "auto-activate",
      type: "checkbox",
      checked: true,
      disabled: true,
    }),
    pageSizeSelectHtml: uiSelect({
      name: "page-size",
      disabled: true,
      options: [
        { value: "6", label: "6", selected: true },
        { value: "12", label: "12" },
        { value: "24", label: "24" },
      ],
    }),
  });
}
