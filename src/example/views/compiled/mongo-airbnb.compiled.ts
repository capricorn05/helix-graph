import type { BindingMap } from "../../../helix/types.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
  renderCompiledView,
  serializeClientOnlyProps,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

export type MongoAirbnbCompiledViewProps = Parameters<
  typeof import("../../views-tsx/mongo-airbnb.view.js").default
>[0];

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {
    "airbnb-mongo-grid": {
      listId: "airbnb-mongo-grid",
      keyAttr: "data-hx-key",
    }
  },
};

export const mongoAirbnbCompiledArtifact: CompiledViewArtifact<MongoAirbnbCompiledViewProps> = defineCompiledViewArtifact<MongoAirbnbCompiledViewProps>(
  compiledViewId("mongo-airbnb"),
  "mongo-airbnb",
  {
    template: "<div data-hx-id=\"airbnb-mongo-root\" class=\"airbnb-mongo-root\"><section class=\"airbnb-mongo-hero\"><p class=\"airbnb-mongo-hero__eyebrow\">MongoDB sample_airbnb</p><h2>Stay Discovery, Reimagined</h2><p>Airbnb-style discovery UI backed by a MongoDB dataset, optimized with\n          server-first rendering and lightweight client paging updates.\n        </p><p>Showing <strong><span data-hx-id=\"hx-mongo-airbnb-slot-1\">__HX_TEXT_mongo-airbnb_1_hx-mongo-airbnb-slot-1__</span></strong>matching\n          stays. <strong><span data-hx-id=\"hx-mongo-airbnb-slot-2\">__HX_TEXT_mongo-airbnb_2_hx-mongo-airbnb-slot-2__</span></strong></p></section><section class=\"airbnb-mongo-panel\">__HX_HTML_mongo-airbnb_3_hx-mongo-airbnb-slot-3__</section><section class=\"airbnb-mongo-panel airbnb-mongo-panel--grid\"><div class=\"airbnb-mongo-grid\" data-hx-id=\"airbnb-mongo-grid\" data-hx-list=\"airbnb-mongo-grid\">__HX_HTML_mongo-airbnb_4_hx-mongo-airbnb-slot-4__</div>__HX_HTML_mongo-airbnb_5_hx-mongo-airbnb-slot-5__</section></div>",
    patches: [
    {
      kind: "text",
      token: "__HX_TEXT_mongo-airbnb_1_hx-mongo-airbnb-slot-1__",
      targetId: "hx-mongo-airbnb-slot-1",
      evaluate: (props: MongoAirbnbCompiledViewProps) => (props.totalListings.toLocaleString()),
    },
    {
      kind: "text",
      token: "__HX_TEXT_mongo-airbnb_2_hx-mongo-airbnb-slot-2__",
      targetId: "hx-mongo-airbnb-slot-2",
      evaluate: (props: MongoAirbnbCompiledViewProps) => (props.sourceLabel),
    },
    {
      kind: "html",
      token: "__HX_HTML_mongo-airbnb_3_hx-mongo-airbnb-slot-3__",
      targetId: "hx-mongo-airbnb-slot-3",
      evaluate: (props: MongoAirbnbCompiledViewProps) => (props.controlsHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_mongo-airbnb_4_hx-mongo-airbnb-slot-4__",
      targetId: "hx-mongo-airbnb-slot-4",
      evaluate: (props: MongoAirbnbCompiledViewProps) => (props.listingsGridHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_mongo-airbnb_5_hx-mongo-airbnb-slot-5__",
      targetId: "hx-mongo-airbnb-slot-5",
      evaluate: (props: MongoAirbnbCompiledViewProps) => (props.pagerHtml),
    }
    ],
    bindingMap: compiledBindingMap,
  },
);

export const mongoAirbnbCompiledViewId = mongoAirbnbCompiledArtifact.id;

export function renderMongoAirbnbCompiledView(props: MongoAirbnbCompiledViewProps): string {
  return renderCompiledView(mongoAirbnbCompiledArtifact, props);
}

export function buildMongoAirbnbCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const mongoAirbnbCompiledPatchTable = mongoAirbnbCompiledArtifact.patches;
