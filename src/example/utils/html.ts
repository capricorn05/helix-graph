import {
  escapeHtml,
  renderHtmlDocumentStart,
  renderHelixDocumentEnd,
} from "../../helix/index.js";
import type { BindingMap, GraphSnapshot } from "../../helix/index.js";
import { renderExampleHeadContent } from "./layout.js";

// ---------------------------------------------------------------------------
// HTML escaping and rendering helpers
// ---------------------------------------------------------------------------

export { escapeHtml };

export function renderDocumentHead(title = "Helix Graph Prototype"): string {
  return renderHtmlDocumentStart({
    title,
    headContent: renderExampleHeadContent(),
  });
}

export function renderPageEnd(
  snapshot: GraphSnapshot,
  bindingMap: BindingMap,
): string {
  return renderHelixDocumentEnd({
    snapshot,
    bindingMap,
    bootstrapModuleSrc: "/client/bootstrap.js",
  });
}
