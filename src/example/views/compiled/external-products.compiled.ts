import type { BindingMap } from "../../../helix/types.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
  renderCompiledView,
  serializeClientOnlyProps,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

export type ExternalProductsCompiledViewProps = Parameters<
  typeof import("../../views-tsx/external-products.view.js").default
>[0];

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {

  },
};

export const externalProductsCompiledArtifact: CompiledViewArtifact<ExternalProductsCompiledViewProps> = defineCompiledViewArtifact<ExternalProductsCompiledViewProps>(
  compiledViewId("external-products"),
  "external-products",
  {
    template: "<p>Backend source: <strong>DummyJSON Products API</strong>. Showing a synthesized<span data-hx-id=\"hx-external-products-slot-1\">__HX_TEXT_external-products_1_hx-external-products-slot-1__</span><strong>10,000-row</strong><span data-hx-id=\"hx-external-products-slot-2\">__HX_TEXT_external-products_2_hx-external-products-slot-2__</span>dataset with 30 rows per page.\n      </p>__HX_HTML_external-products_3_hx-external-products-slot-3__",
    patches: [
    {
      kind: "text",
      token: "__HX_TEXT_external-products_1_hx-external-products-slot-1__",
      targetId: "hx-external-products-slot-1",
      evaluate: (props: ExternalProductsCompiledViewProps) => (" "),
    },
    {
      kind: "text",
      token: "__HX_TEXT_external-products_2_hx-external-products-slot-2__",
      targetId: "hx-external-products-slot-2",
      evaluate: (props: ExternalProductsCompiledViewProps) => (" "),
    },
    {
      kind: "html",
      token: "__HX_HTML_external-products_3_hx-external-products-slot-3__",
      targetId: "hx-external-products-slot-3",
      evaluate: (props: ExternalProductsCompiledViewProps) => (props.tableAndModal),
    }
    ],
    bindingMap: compiledBindingMap,
  },
);

export const externalProductsCompiledViewId = externalProductsCompiledArtifact.id;

export function renderExternalProductsCompiledView(props: ExternalProductsCompiledViewProps): string {
  return renderCompiledView(externalProductsCompiledArtifact, props);
}

export function buildExternalProductsCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const externalProductsCompiledPatchTable = externalProductsCompiledArtifact.patches;
