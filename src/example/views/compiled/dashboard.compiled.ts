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

export const dashboardCompiledArtifact: CompiledViewArtifact<any> = {
  template: "<p>System overview and key metrics.</p><section class=\"stats-grid\">__HX_HTML_dashboard_1_hx-dashboard-slot-1____HX_HTML_dashboard_2_hx-dashboard-slot-2____HX_HTML_dashboard_3_hx-dashboard-slot-3____HX_HTML_dashboard_4_hx-dashboard-slot-4__</section>",
  patches: [
    {
      kind: "html",
      token: "__HX_HTML_dashboard_1_hx-dashboard-slot-1__",
      targetId: "hx-dashboard-slot-1",
      evaluate: (props: any) => (props.totalUsersCard),
    },
    {
      kind: "html",
      token: "__HX_HTML_dashboard_2_hx-dashboard-slot-2__",
      targetId: "hx-dashboard-slot-2",
      evaluate: (props: any) => (props.activeUsersCard),
    },
    {
      kind: "html",
      token: "__HX_HTML_dashboard_3_hx-dashboard-slot-3__",
      targetId: "hx-dashboard-slot-3",
      evaluate: (props: any) => (props.pendingUsersCard),
    },
    {
      kind: "html",
      token: "__HX_HTML_dashboard_4_hx-dashboard-slot-4__",
      targetId: "hx-dashboard-slot-4",
      evaluate: (props: any) => (props.activationRateCard),
    }
  ],
  bindingMap: compiledBindingMap,
};

export function renderDashboardCompiledView(props: any): string {
  return renderCompiledView(dashboardCompiledArtifact, props);
}

export function buildDashboardCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const dashboardCompiledPatchTable = dashboardCompiledArtifact.patches;
