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

export const externalProductsCompiledArtifact: CompiledViewArtifact<any> = {
  template: "<p>Backend source: <strong>DummyJSON Products API</strong>. Showing a synthesized<span data-hx-id=\"hx-external-products-slot-1\">__HX_TEXT_external-products_1_hx-external-products-slot-1__</span><strong>10,000-row</strong><span data-hx-id=\"hx-external-products-slot-2\">__HX_TEXT_external-products_2_hx-external-products-slot-2__</span>dataset with 30 rows per page.\n      </p>__HX_HTML_external-products_3_hx-external-products-slot-3__",
  patches: [
    {
      kind: "text",
      token: "__HX_TEXT_external-products_1_hx-external-products-slot-1__",
      targetId: "hx-external-products-slot-1",
      evaluate: (props: any) => (" "),
    },
    {
      kind: "text",
      token: "__HX_TEXT_external-products_2_hx-external-products-slot-2__",
      targetId: "hx-external-products-slot-2",
      evaluate: (props: any) => (" "),
    },
    {
      kind: "html",
      token: "__HX_HTML_external-products_3_hx-external-products-slot-3__",
      targetId: "hx-external-products-slot-3",
      evaluate: (props: any) => (props.tableAndModal),
    }
  ],
  bindingMap: compiledBindingMap,
};

export function renderExternalProductsCompiledView(props: any): string {
  return renderCompiledView(externalProductsCompiledArtifact, props);
}

export function buildExternalProductsCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const externalProductsCompiledPatchTable = externalProductsCompiledArtifact.patches;
