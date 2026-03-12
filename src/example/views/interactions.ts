import { uiButton } from "../../helix/ui.js";
import { renderInteractionsCompiledView } from "./compiled/interactions.compiled.js";

export function renderInteractionsPage(): string {
  return renderInteractionsCompiledView({
    resetButtonHtml: uiButton({
      label: "Reset Order",
      type: "button",
      variant: "secondary",
      attrs: {
        "data-hx-id": "trial-dnd-reset",
      },
    }),
  });
}
