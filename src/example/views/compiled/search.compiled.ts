import type { BindingMap } from "../../../helix/types.js";
import {
  renderCompiledView,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {},
};

export const searchCompiledArtifact: CompiledViewArtifact<any> = {
  template: "<p>Find users by name or email.</p><section><form method=\"GET\" action=\"/search\" novalidate><label>Search\n            __HX_HTML_search_1_hx-search-slot-1__</label>__HX_HTML_search_2_hx-search-slot-2__</form></section><section><h2>Search Tips</h2><ul><li>Use your browser&#39;s developer tools to inspect the graph</li><li>Open devtools with <code>Ctrl+M</code></li><li>Search is currently a demo page; full-text search coming soon</li></ul></section><section><h2>Popular Searches</h2><ul><li><a href=\"/?sortCol=name&amp;sortDir=asc\">Users by name (A-Z)</a></li><li><a href=\"/?sortCol=name&amp;sortDir=desc\">Users by name (Z-A)</a></li><li><a href=\"/?sortCol=email&amp;sortDir=asc\">Users by email</a></li></ul></section>",
  patches: [
    {
      kind: "html",
      token: "__HX_HTML_search_1_hx-search-slot-1__",
      targetId: "hx-search-slot-1",
      evaluate: (props: any) => (props.searchInputHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_search_2_hx-search-slot-2__",
      targetId: "hx-search-slot-2",
      evaluate: (props: any) => (props.searchButtonHtml),
    }
  ],
  bindingMap: compiledBindingMap,
};

export function renderSearchCompiledView(props: any): string {
  return renderCompiledView(searchCompiledArtifact, props);
}

export function buildSearchCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const searchCompiledPatchTable = searchCompiledArtifact.patches;
