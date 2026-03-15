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

export const externalProductsRichCompiledArtifact: CompiledViewArtifact<any> = {
  template: "<p>Backend source: <strong>DummyJSON Products API</strong>. Same 10,000-row\n        dataset as External Data, but with image cells and heavier conditional\n        row styling to simulate more realistic rendering load.\n      </p>__HX_HTML_external-products-rich_1_hx-external-products-rich-slot-1__",
  patches: [
    {
      kind: "html",
      token: "__HX_HTML_external-products-rich_1_hx-external-products-rich-slot-1__",
      targetId: "hx-external-products-rich-slot-1",
      evaluate: (props: any) => (props.tableAndModal),
    }
  ],
  bindingMap: compiledBindingMap,
};

export function renderExternalProductsRichCompiledView(props: any): string {
  return renderCompiledView(externalProductsRichCompiledArtifact, props);
}

export function buildExternalProductsRichCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const externalProductsRichCompiledPatchTable = externalProductsRichCompiledArtifact.patches;
