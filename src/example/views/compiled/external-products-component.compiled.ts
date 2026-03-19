import type { BindingMap } from "../../../helix/types.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
  renderCompiledView,
  serializeClientOnlyProps,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

export type ExternalProductsComponentCompiledViewProps = Parameters<
  typeof import("../../views-tsx/external-products-component.view.js").default
>[0];

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {

  },
};

export const externalProductsComponentCompiledArtifact: CompiledViewArtifact<ExternalProductsComponentCompiledViewProps> = defineCompiledViewArtifact<ExternalProductsComponentCompiledViewProps>(
  compiledViewId("external-products-component"),
  "external-products-component",
  {
    template: "<article><h3>External Data View</h3><p>Backend source: <strong>DummyJSON Products API</strong>. Showing a synthesized<span data-hx-id=\"hx-external-products-component-slot-1\">__HX_TEXT_external-products-component_1_hx-external-products-component-slot-1__</span><strong>10,000-row</strong><span data-hx-id=\"hx-external-products-component-slot-2\">__HX_TEXT_external-products-component_2_hx-external-products-component-slot-2__</span>dataset with 30 rows per page.\n      </p>__HX_HTML_external-products-component_3_hx-external-products-component-slot-3__</article>",
    patches: [
    {
      kind: "text",
      token: "__HX_TEXT_external-products-component_1_hx-external-products-component-slot-1__",
      targetId: "hx-external-products-component-slot-1",
      evaluate: (props: ExternalProductsComponentCompiledViewProps) => (" "),
    },
    {
      kind: "text",
      token: "__HX_TEXT_external-products-component_2_hx-external-products-component-slot-2__",
      targetId: "hx-external-products-component-slot-2",
      evaluate: (props: ExternalProductsComponentCompiledViewProps) => (" "),
    },
    {
      kind: "html",
      token: "__HX_HTML_external-products-component_3_hx-external-products-component-slot-3__",
      targetId: "hx-external-products-component-slot-3",
      evaluate: (props: ExternalProductsComponentCompiledViewProps) => (props.tableAndModal),
    }
    ],
    bindingMap: compiledBindingMap,
  },
);

export const externalProductsComponentCompiledViewId = externalProductsComponentCompiledArtifact.id;

export function renderExternalProductsComponentCompiledView(props: ExternalProductsComponentCompiledViewProps): string {
  return renderCompiledView(externalProductsComponentCompiledArtifact, props);
}

export function buildExternalProductsComponentCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const externalProductsComponentCompiledPatchTable = externalProductsComponentCompiledArtifact.patches;
