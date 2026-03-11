import { view } from "../../helix/index.js";
import type { BindingMap } from "../../helix/index.js";
import type { UsersPage, User, UserStats } from "../domain.js";
import { escapeHtml } from "../utils/html.js";
import { uiButton, uiInput } from "../../helix/ui.js";
import { uiDataTable } from "../../helix/components/table.js";
import type { UIDataTableColumnDef } from "../../helix/components/table.js";

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

export const userDetailView = view<{ user: User }>(
  "user-detail",
  ({ user }) => {
    return `<main>
  <nav><a href="/">← All users</a></nav>
  <h1>${escapeHtml(user.name)}</h1>
  <dl>
    <dt>Email</dt>  <dd>${escapeHtml(user.email)}</dd>
    <dt>Status</dt> <dd><span class="status-${escapeHtml(user.status)}">${escapeHtml(user.status)}</span></dd>
    <dt>ID</dt>     <dd>${user.id}</dd>
  </dl>
</main>`;
  },
);

export function renderUsersPageContent(usersPage: UsersPage): string {
  return `<p>Streaming SSR + resumable activation + patch-first updates.</p>

${usersPageView.render({ usersPage })}

<section>
  <h2>Add user</h2>
  <form data-hx-id="create-user-form" data-hx-bind="create-user" novalidate>
    <label>Name${uiInput({ name: "name", attrs: { "data-hx-id": "input-name" } })}</label>
    <p class="error" data-hx-id="error-name"></p>
    <label>Email${uiInput({ name: "email", type: "email", attrs: { "data-hx-id": "input-email" } })}</label>
    <p class="error" data-hx-id="error-email"></p>
    ${uiButton({
      label: "Create User",
      type: "submit",
      attrs: { "data-hx-id": "submit-create" },
    })}
    <p class="error" data-hx-id="error-form"></p>
    <p data-hx-id="form-status"></p>
  </form>
</section>

<section>
  <h2>Live component load</h2>
  <p>Load server-rendered content into this section without a full page reload.</p>
  <div class="toolbar">
    ${uiButton({ label: "Summary", bind: "load-users-panel", variant: "secondary", attrs: { "data-panel": "summary" } })}
    ${uiButton({ label: "Reports", bind: "load-users-panel", variant: "secondary", attrs: { "data-panel": "reports" } })}
    ${uiButton({ label: "External Data", bind: "load-users-panel", variant: "secondary", attrs: { "data-panel": "external-data" } })}
    ${uiButton({ label: "Help", bind: "load-users-panel", variant: "secondary", attrs: { "data-panel": "help" } })}
  </div>
  <div data-hx-id="users-live-panel" aria-live="polite">
    <p>Select a panel above to load this section in place.</p>
  </div>
</section>`;
}

export function buildAppBindingMap(): BindingMap {
  return {
    events: {
      "app-nav": {
        id: "app-nav",
        event: "click",
        actionId: "navigate",
        chunk: "/client/actions.js",
        handlerExport: "onAppNavigate",
        preventDefault: true,
      },
      "page-prev": {
        id: "page-prev",
        event: "click",
        actionId: "setPage",
        chunk: "/client/actions.js",
        handlerExport: "onPrevPage",
      },
      "page-next": {
        id: "page-next",
        event: "click",
        actionId: "setPage",
        chunk: "/client/actions.js",
        handlerExport: "onNextPage",
      },
      "sort-name": {
        id: "sort-name",
        event: "click",
        actionId: "setSort",
        chunk: "/client/actions.js",
        handlerExport: "onSortByName",
      },
      "sort-email": {
        id: "sort-email",
        event: "click",
        actionId: "setSort",
        chunk: "/client/actions.js",
        handlerExport: "onSortByEmail",
      },
      "create-user": {
        id: "create-user",
        event: "submit",
        actionId: "createUser",
        chunk: "/client/actions.js",
        handlerExport: "onCreateUser",
      },
      "load-users-panel": {
        id: "load-users-panel",
        event: "click",
        actionId: "loadUsersPanel",
        chunk: "/client/actions.js",
        handlerExport: "onLoadUsersPanel",
      },
      "external-page-prev": {
        id: "external-page-prev",
        event: "click",
        actionId: "external-page",
        chunk: "/client/actions.js",
        handlerExport: "onExternalPagePrev",
      },
      "external-page-next": {
        id: "external-page-next",
        event: "click",
        actionId: "external-page",
        chunk: "/client/actions.js",
        handlerExport: "onExternalPageNext",
      },
      "external-detail-open": {
        id: "external-detail-open",
        event: "click",
        actionId: "external-detail",
        chunk: "/client/actions.js",
        handlerExport: "onExternalDetailOpen",
      },
      "external-detail-close": {
        id: "external-detail-close",
        event: "click",
        actionId: "external-detail",
        chunk: "/client/actions.js",
        handlerExport: "onExternalDetailClose",
      },
      "posts-page-prev": {
        id: "posts-page-prev",
        event: "click",
        actionId: "posts-page",
        chunk: "/client/actions.js",
        handlerExport: "onPostsPagePrev",
      },
      "posts-page-next": {
        id: "posts-page-next",
        event: "click",
        actionId: "posts-page",
        chunk: "/client/actions.js",
        handlerExport: "onPostsPageNext",
      },
    },
    lists: {
      "users-body": { listId: "users-body", keyAttr: "data-hx-key" },
      "external-products-body": {
        listId: "external-products-body",
        keyAttr: "data-hx-key",
      },
      "posts-body": { listId: "posts-body", keyAttr: "data-hx-key" },
    },
  };
}

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
