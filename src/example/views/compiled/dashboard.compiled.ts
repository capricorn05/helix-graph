import type { BindingMap } from "../../../helix/types.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
  renderCompiledView,
  serializeClientOnlyProps,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

export type DashboardCompiledViewProps = Parameters<
  typeof import("../../views-tsx/dashboard.view.js").default
>[0];

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {

  },
};

export const dashboardCompiledArtifact: CompiledViewArtifact<DashboardCompiledViewProps> = defineCompiledViewArtifact<DashboardCompiledViewProps>(
  compiledViewId("dashboard"),
  "dashboard",
  {
    template: "<p>System overview and key metrics.</p><section class=\"stats-grid\">__HX_HTML_dashboard_1_hx-dashboard-slot-1____HX_HTML_dashboard_2_hx-dashboard-slot-2____HX_HTML_dashboard_3_hx-dashboard-slot-3____HX_HTML_dashboard_4_hx-dashboard-slot-4__</section>",
    patches: [
    {
      kind: "html",
      token: "__HX_HTML_dashboard_1_hx-dashboard-slot-1__",
      targetId: "hx-dashboard-slot-1",
      evaluate: (props: DashboardCompiledViewProps) => (props.totalUsersCard),
    },
    {
      kind: "html",
      token: "__HX_HTML_dashboard_2_hx-dashboard-slot-2__",
      targetId: "hx-dashboard-slot-2",
      evaluate: (props: DashboardCompiledViewProps) => (props.activeUsersCard),
    },
    {
      kind: "html",
      token: "__HX_HTML_dashboard_3_hx-dashboard-slot-3__",
      targetId: "hx-dashboard-slot-3",
      evaluate: (props: DashboardCompiledViewProps) => (props.pendingUsersCard),
    },
    {
      kind: "html",
      token: "__HX_HTML_dashboard_4_hx-dashboard-slot-4__",
      targetId: "hx-dashboard-slot-4",
      evaluate: (props: DashboardCompiledViewProps) => (props.activationRateCard),
    }
    ],
    bindingMap: compiledBindingMap,
  },
);

export const dashboardCompiledViewId = dashboardCompiledArtifact.id;

export function renderDashboardCompiledView(props: DashboardCompiledViewProps): string {
  return renderCompiledView(dashboardCompiledArtifact, props);
}

export function buildDashboardCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const dashboardCompiledPatchTable = dashboardCompiledArtifact.patches;
