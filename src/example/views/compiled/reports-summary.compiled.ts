import type { BindingMap } from "../../../helix/types.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
  renderCompiledView,
  serializeClientOnlyProps,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

export type ReportsSummaryCompiledViewProps = Parameters<
  typeof import("../../views-tsx/reports-summary.view.js").default
>[0];

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {

  },
};

export const reportsSummaryCompiledArtifact: CompiledViewArtifact<ReportsSummaryCompiledViewProps> = defineCompiledViewArtifact<ReportsSummaryCompiledViewProps>(
  compiledViewId("reports-summary"),
  "reports-summary",
  {
    template: "<section><h2>User Distribution</h2><dl><dt>Active Users</dt><dd><span data-hx-id=\"hx-reports-summary-slot-1\">__HX_TEXT_reports-summary_1_hx-reports-summary-slot-1__</span><span data-hx-id=\"hx-reports-summary-slot-2\">__HX_TEXT_reports-summary_2_hx-reports-summary-slot-2__</span>on current page\n          </dd><dt>Pending Users</dt><dd><span data-hx-id=\"hx-reports-summary-slot-3\">__HX_TEXT_reports-summary_3_hx-reports-summary-slot-3__</span><span data-hx-id=\"hx-reports-summary-slot-4\">__HX_TEXT_reports-summary_4_hx-reports-summary-slot-4__</span>on current page\n          </dd><dt>Total Pages</dt><dd><span data-hx-id=\"hx-reports-summary-slot-5\">__HX_TEXT_reports-summary_5_hx-reports-summary-slot-5__</span></dd></dl></section><section><h2>Sample Users on Page <span data-hx-id=\"hx-reports-summary-slot-6\">__HX_TEXT_reports-summary_6_hx-reports-summary-slot-6__</span></h2></section>",
    patches: [
    {
      kind: "text",
      token: "__HX_TEXT_reports-summary_1_hx-reports-summary-slot-1__",
      targetId: "hx-reports-summary-slot-1",
      evaluate: (props: ReportsSummaryCompiledViewProps) => (props.activeUsersOnPage),
    },
    {
      kind: "text",
      token: "__HX_TEXT_reports-summary_2_hx-reports-summary-slot-2__",
      targetId: "hx-reports-summary-slot-2",
      evaluate: (props: ReportsSummaryCompiledViewProps) => (" "),
    },
    {
      kind: "text",
      token: "__HX_TEXT_reports-summary_3_hx-reports-summary-slot-3__",
      targetId: "hx-reports-summary-slot-3",
      evaluate: (props: ReportsSummaryCompiledViewProps) => (props.pendingUsersOnPage),
    },
    {
      kind: "text",
      token: "__HX_TEXT_reports-summary_4_hx-reports-summary-slot-4__",
      targetId: "hx-reports-summary-slot-4",
      evaluate: (props: ReportsSummaryCompiledViewProps) => (" "),
    },
    {
      kind: "text",
      token: "__HX_TEXT_reports-summary_5_hx-reports-summary-slot-5__",
      targetId: "hx-reports-summary-slot-5",
      evaluate: (props: ReportsSummaryCompiledViewProps) => (props.totalPages),
    },
    {
      kind: "text",
      token: "__HX_TEXT_reports-summary_6_hx-reports-summary-slot-6__",
      targetId: "hx-reports-summary-slot-6",
      evaluate: (props: ReportsSummaryCompiledViewProps) => (props.page),
    }
    ],
    bindingMap: compiledBindingMap,
  },
);

export const reportsSummaryCompiledViewId = reportsSummaryCompiledArtifact.id;

export function renderReportsSummaryCompiledView(props: ReportsSummaryCompiledViewProps): string {
  return renderCompiledView(reportsSummaryCompiledArtifact, props);
}

export function buildReportsSummaryCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const reportsSummaryCompiledPatchTable = reportsSummaryCompiledArtifact.patches;
