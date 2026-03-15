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

export const reportsCompiledArtifact: CompiledViewArtifact<any> = {
  template: "<p>User activity and system reports.</p>__HX_HTML_reports_1_hx-reports-slot-1__<section>__HX_HTML_reports_2_hx-reports-slot-2__</section><section><h2>Export Options</h2><p>Reports are currently view-only. Export to CSV or JSON coming soon.</p></section>",
  patches: [
    {
      kind: "html",
      token: "__HX_HTML_reports_1_hx-reports-slot-1__",
      targetId: "hx-reports-slot-1",
      evaluate: (props: any) => (props.summarySection),
    },
    {
      kind: "html",
      token: "__HX_HTML_reports_2_hx-reports-slot-2__",
      targetId: "hx-reports-slot-2",
      evaluate: (props: any) => (props.usersTable),
    }
  ],
  bindingMap: compiledBindingMap,
};

export function renderReportsCompiledView(props: any): string {
  return renderCompiledView(reportsCompiledArtifact, props);
}

export function buildReportsCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const reportsCompiledPatchTable = reportsCompiledArtifact.patches;
