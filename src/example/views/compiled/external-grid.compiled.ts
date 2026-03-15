import type { BindingMap } from "../../../helix/types.js";
import {
  renderCompiledView,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {

  },
};

export const externalGridCompiledArtifact: CompiledViewArtifact<any> = {
  template: "<p>Spreadsheet-style external data grid: click a cell to edit, click a\n        header to sort.\n      </p><section data-hx-id=\"external-grid-root\"><h2>External Data Grid</h2><p>Loaded <span data-hx-id=\"hx-external-grid-slot-1\">__HX_TEXT_external-grid_1_hx-external-grid-slot-1__</span>rows from page <span data-hx-id=\"hx-external-grid-slot-2\">__HX_TEXT_external-grid_2_hx-external-grid-slot-2__</span>of a <span data-hx-id=\"hx-external-grid-slot-3\">__HX_TEXT_external-grid_3_hx-external-grid-slot-3__</span>-row dataset.\n        </p>__HX_HTML_external-grid_4_hx-external-grid-slot-4__<p data-hx-id=\"external-grid-status\" aria-live=\"polite\">Ready. Click a column header to sort or edit any cell directly.\n        </p></section>",
  patches: [
    {
      kind: "text",
      token: "__HX_TEXT_external-grid_1_hx-external-grid-slot-1__",
      targetId: "hx-external-grid-slot-1",
      evaluate: (props: any) => (props.rowCount),
    },
    {
      kind: "text",
      token: "__HX_TEXT_external-grid_2_hx-external-grid-slot-2__",
      targetId: "hx-external-grid-slot-2",
      evaluate: (props: any) => (props.page),
    },
    {
      kind: "text",
      token: "__HX_TEXT_external-grid_3_hx-external-grid-slot-3__",
      targetId: "hx-external-grid-slot-3",
      evaluate: (props: any) => (props.totalRows),
    },
    {
      kind: "html",
      token: "__HX_HTML_external-grid_4_hx-external-grid-slot-4__",
      targetId: "hx-external-grid-slot-4",
      evaluate: (props: any) => (props.gridTableHtml),
    }
  ],
  bindingMap: compiledBindingMap,
};

export function renderExternalGridCompiledView(props: any): string {
  return renderCompiledView(externalGridCompiledArtifact, props);
}

export function buildExternalGridCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const externalGridCompiledPatchTable = externalGridCompiledArtifact.patches;
