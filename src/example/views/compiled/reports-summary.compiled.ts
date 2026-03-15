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

export const reportsSummaryCompiledArtifact: CompiledViewArtifact<any> = {
  template: "<section><h2>User Distribution</h2><dl><dt>Active Users</dt><dd><span data-hx-id=\"hx-reports-summary-slot-1\">__HX_TEXT_reports-summary_1_hx-reports-summary-slot-1__</span><span data-hx-id=\"hx-reports-summary-slot-2\">__HX_TEXT_reports-summary_2_hx-reports-summary-slot-2__</span>on current page\n          </dd><dt>Pending Users</dt><dd><span data-hx-id=\"hx-reports-summary-slot-3\">__HX_TEXT_reports-summary_3_hx-reports-summary-slot-3__</span><span data-hx-id=\"hx-reports-summary-slot-4\">__HX_TEXT_reports-summary_4_hx-reports-summary-slot-4__</span>on current page\n          </dd><dt>Total Pages</dt><dd><span data-hx-id=\"hx-reports-summary-slot-5\">__HX_TEXT_reports-summary_5_hx-reports-summary-slot-5__</span></dd></dl></section><section><h2>Sample Users on Page <span data-hx-id=\"hx-reports-summary-slot-6\">__HX_TEXT_reports-summary_6_hx-reports-summary-slot-6__</span></h2></section>",
  patches: [
    {
      kind: "text",
      token: "__HX_TEXT_reports-summary_1_hx-reports-summary-slot-1__",
      targetId: "hx-reports-summary-slot-1",
      evaluate: (props: any) => (props.activeUsersOnPage),
    },
    {
      kind: "text",
      token: "__HX_TEXT_reports-summary_2_hx-reports-summary-slot-2__",
      targetId: "hx-reports-summary-slot-2",
      evaluate: (props: any) => (" "),
    },
    {
      kind: "text",
      token: "__HX_TEXT_reports-summary_3_hx-reports-summary-slot-3__",
      targetId: "hx-reports-summary-slot-3",
      evaluate: (props: any) => (props.pendingUsersOnPage),
    },
    {
      kind: "text",
      token: "__HX_TEXT_reports-summary_4_hx-reports-summary-slot-4__",
      targetId: "hx-reports-summary-slot-4",
      evaluate: (props: any) => (" "),
    },
    {
      kind: "text",
      token: "__HX_TEXT_reports-summary_5_hx-reports-summary-slot-5__",
      targetId: "hx-reports-summary-slot-5",
      evaluate: (props: any) => (props.totalPages),
    },
    {
      kind: "text",
      token: "__HX_TEXT_reports-summary_6_hx-reports-summary-slot-6__",
      targetId: "hx-reports-summary-slot-6",
      evaluate: (props: any) => (props.page),
    }
  ],
  bindingMap: compiledBindingMap,
};

export function renderReportsSummaryCompiledView(props: any): string {
  return renderCompiledView(reportsSummaryCompiledArtifact, props);
}

export function buildReportsSummaryCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const reportsSummaryCompiledPatchTable = reportsSummaryCompiledArtifact.patches;
