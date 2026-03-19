import type { BindingMap } from "../../../helix/types.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
  renderCompiledView,
  serializeClientOnlyProps,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

export type ExternalProductsRichCompiledViewProps = Parameters<
  typeof import("../../views-tsx/external-products-rich.view.js").default
>[0];

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {

  },
};

export const externalProductsRichCompiledArtifact: CompiledViewArtifact<ExternalProductsRichCompiledViewProps> = defineCompiledViewArtifact<ExternalProductsRichCompiledViewProps>(
  compiledViewId("external-products-rich"),
  "external-products-rich",
  {
    template: "<p>Backend source: <strong>DummyJSON Products API</strong>. Same 10,000-row\n        dataset as External Data, but with image cells and heavier conditional\n        row styling to simulate more realistic rendering load.\n      </p>__HX_HTML_external-products-rich_1_hx-external-products-rich-slot-1__",
    patches: [
    {
      kind: "html",
      token: "__HX_HTML_external-products-rich_1_hx-external-products-rich-slot-1__",
      targetId: "hx-external-products-rich-slot-1",
      evaluate: (props: ExternalProductsRichCompiledViewProps) => (props.tableAndModal),
    }
    ],
    bindingMap: compiledBindingMap,
  },
);

export const externalProductsRichCompiledViewId = externalProductsRichCompiledArtifact.id;

export function renderExternalProductsRichCompiledView(props: ExternalProductsRichCompiledViewProps): string {
  return renderCompiledView(externalProductsRichCompiledArtifact, props);
}

export function buildExternalProductsRichCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const externalProductsRichCompiledPatchTable = externalProductsRichCompiledArtifact.patches;
