import { uiButton, uiInput } from "../../helix/ui.js";
import { renderSearchCompiledView } from "./compiled/search.compiled.js";

export function renderSearchPage(): string {
  return renderSearchCompiledView({
    searchInputHtml: uiInput({
      name: "q",
      placeholder: "Enter name or email...",
      attrs: { autofocus: true },
    }),
    searchButtonHtml: uiButton({ label: "Search", type: "submit" }),
  });
}
