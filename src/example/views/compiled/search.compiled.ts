import type { BindingMap } from "../../../helix/types.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
  renderCompiledView,
  serializeClientOnlyProps,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

export type SearchCompiledViewProps = Parameters<
  typeof import("../../views-tsx/search.view.js").default
>[0];

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {

  },
};

export const searchCompiledArtifact: CompiledViewArtifact<SearchCompiledViewProps> = defineCompiledViewArtifact<SearchCompiledViewProps>(
  compiledViewId("search"),
  "search",
  {
    template: "<p>Find users by name or email.</p><section><form method=\"GET\" action=\"/search\" novalidate data-hx-id=\"search-primitives-root\"><label>Search\n            __HX_HTML_search_1_hx-search-slot-1__</label>__HX_HTML_search_2_hx-search-slot-2____HX_HTML_search_3_hx-search-slot-3__<div class=\"toolbar\">__HX_HTML_search_4_hx-search-slot-4____HX_HTML_search_5_hx-search-slot-5__</div>__HX_HTML_search_6_hx-search-slot-6__</form></section><section><h2>Search Tips</h2><ul><li>Use your browser&#39;s developer tools to inspect the graph</li><li>Open devtools with <code>Ctrl+M</code></li><li>Search is currently a demo page; full-text search coming soon</li></ul></section><section><h2>Popular Searches</h2><ul><li><a href=\"/?sortCol=name&amp;sortDir=asc\">Users by name (A-Z)</a></li><li><a href=\"/?sortCol=name&amp;sortDir=desc\">Users by name (Z-A)</a></li><li><a href=\"/?sortCol=email&amp;sortDir=asc\">Users by email</a></li></ul></section>",
    patches: [
    {
      kind: "html",
      token: "__HX_HTML_search_1_hx-search-slot-1__",
      targetId: "hx-search-slot-1",
      evaluate: (props: SearchCompiledViewProps) => (props.searchInputHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_search_2_hx-search-slot-2__",
      targetId: "hx-search-slot-2",
      evaluate: (props: SearchCompiledViewProps) => (props.searchSuggestionsHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_search_3_hx-search-slot-3__",
      targetId: "hx-search-slot-3",
      evaluate: (props: SearchCompiledViewProps) => (props.searchStatusHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_search_4_hx-search-slot-4__",
      targetId: "hx-search-slot-4",
      evaluate: (props: SearchCompiledViewProps) => (props.searchButtonHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_search_5_hx-search-slot-5__",
      targetId: "hx-search-slot-5",
      evaluate: (props: SearchCompiledViewProps) => (props.searchHelpTriggerHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_search_6_hx-search-slot-6__",
      targetId: "hx-search-slot-6",
      evaluate: (props: SearchCompiledViewProps) => (props.searchHelpPopoverHtml),
    }
    ],
    bindingMap: compiledBindingMap,
  },
);

export const searchCompiledViewId = searchCompiledArtifact.id;

export function renderSearchCompiledView(props: SearchCompiledViewProps): string {
  return renderCompiledView(searchCompiledArtifact, props);
}

export function buildSearchCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const searchCompiledPatchTable = searchCompiledArtifact.patches;
