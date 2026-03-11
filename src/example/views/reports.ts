import type { User, UsersPage } from "../domain.js";
import { uiDataTable } from "../../helix/components/table.js";
import type { UIDataTableColumnDef } from "../../helix/components/table.js";
import { escapeHtml } from "../utils/html.js";

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

  return `
  <p>User activity and system reports.</p>

  <section>
    <h2>User Distribution</h2>
    <dl>
      <dt>Active Users</dt>
      <dd>${activeUsersOnPage} on current page</dd>
      <dt>Pending Users</dt>
      <dd>${pendingUsersOnPage} on current page</dd>
      <dt>Total Pages</dt>
      <dd>${usersPage.totalPages}</dd>
    </dl>
  </section>

  <section>
    <h2>Sample Users on Page ${usersPage.page}</h2>
    ${usersTable}
  </section>

  <section>
    <h2>Export Options</h2>
    <p>
      Reports are currently view-only. Export to CSV or JSON coming soon.
    </p>
  </section>`;
}
