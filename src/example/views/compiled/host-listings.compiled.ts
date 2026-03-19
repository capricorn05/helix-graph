import type { BindingMap } from "../../../helix/types.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
  renderCompiledView,
  serializeClientOnlyProps,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

export type HostListingsCompiledViewProps = Parameters<
  typeof import("../../views-tsx/host-listings.view.js").default
>[0];

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {
    "host-listings-grid": {
      listId: "host-listings-grid",
      keyAttr: "data-hx-key",
    }
  },
};

export const hostListingsCompiledArtifact: CompiledViewArtifact<HostListingsCompiledViewProps> = defineCompiledViewArtifact<HostListingsCompiledViewProps>(
  compiledViewId("host-listings"),
  "host-listings",
  {
    template: "<div data-hx-id=\"host-listings-root\" class=\"host-listings-root\"><section class=\"host-listings-hero\"><h2>Product Host Listings</h2><p>Airbnb-style card layout for external products with fast server-side paging.</p><p>Source: DummyJSON seed products, expanded to <strong><span data-hx-id=\"hx-host-listings-slot-1\">__HX_TEXT_host-listings_1_hx-host-listings-slot-1__</span></strong>synthetic listings.\n        </p></section><section><div class=\"host-listings-grid\" data-hx-id=\"host-listings-grid\" data-hx-list=\"host-listings-grid\">__HX_HTML_host-listings_2_hx-host-listings-slot-2__</div>__HX_HTML_host-listings_3_hx-host-listings-slot-3__</section></div>",
    patches: [
    {
      kind: "text",
      token: "__HX_TEXT_host-listings_1_hx-host-listings-slot-1__",
      targetId: "hx-host-listings-slot-1",
      evaluate: (props: HostListingsCompiledViewProps) => (props.totalListings.toLocaleString()),
    },
    {
      kind: "html",
      token: "__HX_HTML_host-listings_2_hx-host-listings-slot-2__",
      targetId: "hx-host-listings-slot-2",
      evaluate: (props: HostListingsCompiledViewProps) => (props.listingsGridHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_host-listings_3_hx-host-listings-slot-3__",
      targetId: "hx-host-listings-slot-3",
      evaluate: (props: HostListingsCompiledViewProps) => (props.pagerHtml),
    }
    ],
    bindingMap: compiledBindingMap,
  },
);

export const hostListingsCompiledViewId = hostListingsCompiledArtifact.id;

export function renderHostListingsCompiledView(props: HostListingsCompiledViewProps): string {
  return renderCompiledView(hostListingsCompiledArtifact, props);
}

export function buildHostListingsCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const hostListingsCompiledPatchTable = hostListingsCompiledArtifact.patches;
