import type { BindingMap } from "../../../helix/types.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
  renderCompiledView,
  serializeClientOnlyProps,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

export type ExternalGridCompiledViewProps = Parameters<
  typeof import("../../views-tsx/external-grid.view.js").default
>[0];

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {

  },
};

export const externalGridCompiledArtifact: CompiledViewArtifact<ExternalGridCompiledViewProps> = defineCompiledViewArtifact<ExternalGridCompiledViewProps>(
  compiledViewId("external-grid"),
  "external-grid",
  {
    template: "<p>Spreadsheet-style external data grid: click a cell to edit, click a\n        header to sort.\n      </p><section data-hx-id=\"external-grid-root\"><h2>External Data Grid</h2><p>Loaded <span data-hx-id=\"external-grid-row-count\"><span data-hx-id=\"hx-external-grid-slot-1\">__HX_TEXT_external-grid_1_hx-external-grid-slot-1__</span></span><span data-hx-id=\"hx-external-grid-slot-2\">__HX_TEXT_external-grid_2_hx-external-grid-slot-2__</span>rows from page <span data-hx-id=\"external-grid-summary-page\"><span data-hx-id=\"hx-external-grid-slot-3\">__HX_TEXT_external-grid_3_hx-external-grid-slot-3__</span></span><span data-hx-id=\"hx-external-grid-slot-4\">__HX_TEXT_external-grid_4_hx-external-grid-slot-4__</span>of a <span data-hx-id=\"external-grid-summary-total\"><span data-hx-id=\"hx-external-grid-slot-5\">__HX_TEXT_external-grid_5_hx-external-grid-slot-5__</span></span>-row dataset.\n        </p>__HX_HTML_external-grid_6_hx-external-grid-slot-6__<p data-hx-id=\"external-grid-status\" aria-live=\"polite\">Ready. Click a column header to sort or edit any cell directly.\n        </p></section>",
    patches: [
    {
      kind: "text",
      token: "__HX_TEXT_external-grid_1_hx-external-grid-slot-1__",
      targetId: "hx-external-grid-slot-1",
      evaluate: (props: ExternalGridCompiledViewProps) => (props.rowCount),
    },
    {
      kind: "text",
      token: "__HX_TEXT_external-grid_2_hx-external-grid-slot-2__",
      targetId: "hx-external-grid-slot-2",
      evaluate: (props: ExternalGridCompiledViewProps) => (" "),
    },
    {
      kind: "text",
      token: "__HX_TEXT_external-grid_3_hx-external-grid-slot-3__",
      targetId: "hx-external-grid-slot-3",
      evaluate: (props: ExternalGridCompiledViewProps) => (props.page),
    },
    {
      kind: "text",
      token: "__HX_TEXT_external-grid_4_hx-external-grid-slot-4__",
      targetId: "hx-external-grid-slot-4",
      evaluate: (props: ExternalGridCompiledViewProps) => (" "),
    },
    {
      kind: "text",
      token: "__HX_TEXT_external-grid_5_hx-external-grid-slot-5__",
      targetId: "hx-external-grid-slot-5",
      evaluate: (props: ExternalGridCompiledViewProps) => (props.totalRows),
    },
    {
      kind: "html",
      token: "__HX_HTML_external-grid_6_hx-external-grid-slot-6__",
      targetId: "hx-external-grid-slot-6",
      evaluate: (props: ExternalGridCompiledViewProps) => (props.gridTableHtml),
    }
    ],
    bindingMap: compiledBindingMap,
  },
);

export const externalGridCompiledViewId = externalGridCompiledArtifact.id;

export function renderExternalGridCompiledView(props: ExternalGridCompiledViewProps): string {
  return renderCompiledView(externalGridCompiledArtifact, props);
}

export function buildExternalGridCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const externalGridCompiledPatchTable = externalGridCompiledArtifact.patches;
