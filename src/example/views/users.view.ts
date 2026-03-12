import { view } from "../../helix/index.js";
import type { UsersPage, User, UserStats } from "../domain.js";
import { escapeHtml } from "../utils/html.js";
import { uiButton, uiInput } from "../../helix/ui.js";
import { uiDataTable } from "../../helix/components/table.js";
import type { UIDataTableColumnDef } from "../../helix/components/table.js";
import { buildAppBindingMap } from "./binding-map.generated.js";
import { renderUsersPageContentCompiledView } from "./compiled/users-page-content.compiled.js";
import { renderUserDetailCompiledView } from "./compiled/user-detail.compiled.js";
import { renderUserEditCompiledView } from "./compiled/user-edit.compiled.js";

const usersTableColumns: UIDataTableColumnDef<User>[] = [
  {
    id: "name",
    header: "Name",
    cell: ({ row }) =>
      `<a data-hx-id="row-${row.id}-name" href="/users/${row.id}">${escapeHtml(row.name)}</a>`,
  },
  {
    id: "email",
    header: "Email",
    accessorKey: "email",
    cellAttrs: ({ row }) => ({ "data-hx-id": `row-${row.id}-email` }),
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    cellAttrs: ({ row }) => ({ "data-hx-id": `row-${row.id}-status` }),
  },
];

function renderUsersSection(usersPage: UsersPage): string {
  const sortNameIndicator =
    usersPage.sortCol === "name"
      ? usersPage.sortDir === "asc"
        ? "▲"
        : "▼"
      : "·";
  const sortEmailIndicator =
    usersPage.sortCol === "email"
      ? usersPage.sortDir === "asc"
        ? "▲"
        : "▼"
      : "·";

  const usersTableHtml = uiDataTable({
    data: usersPage.rows,
    columns: usersTableColumns,
    rowAttrs: (row) => ({ "data-hx-key": row.id }),
    bodyAttrs: {
      "data-hx-id": "users-body",
      "data-hx-list": "users-body",
    },
  });

  return `<section>
  <h2>Users</h2>
  <div class="toolbar">
    ${uiButton({
      bind: "sort-name",
      variant: "secondary",
      attrs: { "data-hx-id": "sort-name-btn" },
      contentHtml: `Name <span data-hx-id="sort-name-indicator">${sortNameIndicator}</span>`,
    })}
    ${uiButton({
      bind: "sort-email",
      variant: "secondary",
      attrs: { "data-hx-id": "sort-email-btn" },
      contentHtml: `Email <span data-hx-id="sort-email-indicator">${sortEmailIndicator}</span>`,
    })}
  </div>
  ${usersTableHtml}
  <div class="pager">
    ${uiButton({
      label: "Prev",
      bind: "page-prev",
      variant: "secondary",
      disabled: usersPage.page <= 1,
      attrs: { "data-hx-id": "prev-btn" },
    })}
    <span data-hx-id="page-label">Page ${usersPage.page} / ${usersPage.totalPages}</span>
    ${uiButton({
      label: "Next",
      bind: "page-next",
      variant: "secondary",
      disabled: usersPage.page >= usersPage.totalPages,
      attrs: { "data-hx-id": "next-btn" },
    })}
    <span
      data-hx-id="users-page-state"
      data-page="${usersPage.page}"
      data-page-size="${usersPage.pageSize}"
      data-total="${usersPage.total}"
      data-total-pages="${usersPage.totalPages}"
      data-sort-col="${usersPage.sortCol}"
      data-sort-dir="${usersPage.sortDir}"
      hidden
    ></span>
  </div>
</section>`;
}

export const usersPageView = view<{ usersPage: UsersPage }>(
  "users-page",
  ({ usersPage }) => {
    return renderUsersSection(usersPage);
  },
);

function renderUserStatusOptionsHtml(status: User["status"]): string {
  const activeSelected = status === "active" ? " selected" : "";
  const pendingSelected = status === "pending" ? " selected" : "";

  return `<option value="active"${activeSelected}>Active</option><option value="pending"${pendingSelected}>Pending</option>`;
}

export function renderUserDetailPage(user: User): string {
  return renderUserDetailCompiledView({
    userName: user.name,
    userEmail: user.email,
    userStatus: user.status,
    userStatusClass: `status-${user.status}`,
    userId: user.id,
  });
}

export function renderUserEditPage(user: User): string {
  return renderUserEditCompiledView({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    statusOptionsHtml: renderUserStatusOptionsHtml(user.status),
  });
}

export function renderUsersPageContent(usersPage: UsersPage): string {
  return renderUsersPageContentCompiledView({
    usersSectionHtml: usersPageView.render({ usersPage }),
    nameInputHtml: uiInput({
      name: "name",
      attrs: { "data-hx-id": "input-name" },
    }),
    emailInputHtml: uiInput({
      name: "email",
      type: "email",
      attrs: { "data-hx-id": "input-email" },
    }),
    submitButtonHtml: uiButton({
      label: "Create User",
      type: "submit",
      attrs: { "data-hx-id": "submit-create" },
    }),
    summaryPanelButtonHtml: uiButton({
      label: "Summary",
      bind: "load-users-panel",
      variant: "secondary",
      attrs: { "data-panel": "summary" },
    }),
    reportsPanelButtonHtml: uiButton({
      label: "Reports",
      bind: "load-users-panel",
      variant: "secondary",
      attrs: { "data-panel": "reports" },
    }),
    externalDataPanelButtonHtml: uiButton({
      label: "External Data",
      bind: "load-users-panel",
      variant: "secondary",
      attrs: { "data-panel": "external-data" },
    }),
    helpPanelButtonHtml: uiButton({
      label: "Help",
      bind: "load-users-panel",
      variant: "secondary",
      attrs: { "data-panel": "help" },
    }),
  });
}

export { buildAppBindingMap };

export const buildUsersBindingMap = buildAppBindingMap;

export type UsersPanelKind = "summary" | "reports" | "external-data" | "help";

export function renderUsersLivePanel(
  panel: UsersPanelKind,
  data: { usersPage: UsersPage; stats: UserStats },
): string {
  if (panel === "reports") {
    const activeOnPage = data.usersPage.rows.filter(
      (row) => row.status === "active",
    ).length;
    const pendingOnPage = data.usersPage.rows.filter(
      (row) => row.status === "pending",
    ).length;

    return `<article>
  <h3>Current page report</h3>
  <p>Page ${data.usersPage.page} has <strong>${activeOnPage}</strong> active and <strong>${pendingOnPage}</strong> pending users.</p>
  <p>Total pages available: <strong>${data.usersPage.totalPages}</strong>.</p>
</article>`;
  }

  if (panel === "help") {
    return `<article>
  <h3>How this works</h3>
  <ul>
    <li>Click a panel button.</li>
    <li>The client fetches HTML from <code>/components/users-panel</code>.</li>
    <li>Only this panel section is replaced, so the page does not reload.</li>
  </ul>
</article>`;
  }

  return `<article>
  <h3>Live summary</h3>
  <dl>
    <dt>Total users</dt><dd>${data.stats.total}</dd>
    <dt>Active users</dt><dd>${data.stats.active}</dd>
    <dt>Pending users</dt><dd>${data.stats.pending}</dd>
  </dl>
</article>`;
}
