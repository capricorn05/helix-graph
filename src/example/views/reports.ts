import type { User, UsersPage } from "../domain.js";
import { uiDataTable } from "../../helix/components/table.js";
import type { UIDataTableColumnDef } from "../../helix/components/table.js";
import { escapeHtml } from "../utils/html.js";
import { renderReportsCompiledView } from "./compiled/reports.compiled.js";
import { renderReportsSummaryCompiledView } from "./compiled/reports-summary.compiled.js";

const reportUserColumns: UIDataTableColumnDef<User>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
  },
  {
    id: "email",
    header: "Email",
    accessorKey: "email",
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) =>
      `<span class="status-${escapeHtml(row.status)}">${escapeHtml(row.status)}</span>`,
  },
];

export function renderReportsPage(usersPage: UsersPage): string {
  const activeUsersOnPage = usersPage.rows.filter(
    (row) => row.status === "active",
  ).length;
  const pendingUsersOnPage = usersPage.rows.filter(
    (row) => row.status === "pending",
  ).length;

  const usersTable = uiDataTable({
    data: usersPage.rows,
    columns: reportUserColumns,
  });

  const summarySection = renderReportsSummaryCompiledView({
    activeUsersOnPage,
    pendingUsersOnPage,
    totalPages: usersPage.totalPages,
    page: usersPage.page,
  });

  return renderReportsCompiledView({
    summarySection,
    usersTable,
  });
}
