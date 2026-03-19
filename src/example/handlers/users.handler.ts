import {
  compiledViewId,
  connectRouteViewResources,
  createGraphSnapshot,
} from "../../helix/index.js";
import type { BindingMap, RouteContext } from "../../helix/index.js";
import {
  usersPageResource,
  userDetailResource,
} from "../resources/users.resource.js";
import {
  buildAppBindingMap,
  renderUserDetailPage,
  renderUserEditPage,
  renderUsersPageContent,
  usersPageView,
} from "../views/users.view.js";
import { renderAdminLayout } from "../views/admin-layout.js";
import { renderDocumentHead, renderPageEnd } from "../utils/html.js";
import { resolveUsersQuery } from "../utils/query.js";
import { streamHtmlSegments } from "../../helix/index.js";

export async function handleHome(ctx: RouteContext): Promise<void> {
  const query = resolveUsersQuery(ctx.url);
  const usersPage = await usersPageResource.read(query);
  const bindingMap = buildAppBindingMap();

  connectRouteViewResources(
    ctx.routeId,
    [compiledViewId("users-page-content"), usersPageView.id],
    [usersPageResource.id],
  );

  const snapshot = createGraphSnapshot(
    {
      page: usersPage.page,
      pageSize: usersPage.pageSize,
      total: usersPage.total,
      totalPages: usersPage.totalPages,
      sortCol: usersPage.sortCol,
      sortDir: usersPage.sortDir,
    },
    { includeGraph: false },
  );

  ctx.response.statusCode = 200;
  ctx.response.setHeader("content-type", "text/html; charset=utf-8");
  await streamHtmlSegments(ctx.response, [
    renderDocumentHead("Users"),
    renderAdminLayout({
      title: "Users",
      activePath: ctx.url.pathname,
      content: renderUsersPageContent(usersPage),
    }),
    renderPageEnd(snapshot, bindingMap),
  ]);
  ctx.response.end();
}

export async function handleUserDetail(
  ctx: RouteContext<{ id: string }>,
): Promise<void> {
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    ctx.response.statusCode = 400;
    ctx.response.end("Invalid user ID");
    return;
  }

  const user = await userDetailResource.read({ id });
  ctx.response.statusCode = user ? 200 : 404;
  ctx.response.setHeader("content-type", "text/html; charset=utf-8");

  if (!user) {
    await streamHtmlSegments(ctx.response, [
      renderDocumentHead("User not found"),
      `<main><nav><a href="/">← All users</a></nav><h1>User not found</h1></main></body></html>`,
    ]);
    ctx.response.end();
    return;
  }

  connectRouteViewResources(
    ctx.routeId,
    [compiledViewId("user-detail")],
    [userDetailResource.id],
  );

  const snapshot = createGraphSnapshot(
    { userId: user.id },
    { includeGraph: false },
  );
  const bindingMap: BindingMap = { events: {}, lists: {} };
  await streamHtmlSegments(ctx.response, [
    renderDocumentHead(user.name),
    renderUserDetailPage(user),
    renderPageEnd(snapshot, bindingMap),
  ]);
  ctx.response.end();
}

export async function handleUserEdit(
  ctx: RouteContext<{ id: string }>,
): Promise<void> {
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    ctx.response.statusCode = 400;
    ctx.response.end("Invalid user ID");
    return;
  }

  const user = await userDetailResource.read({ id });
  ctx.response.statusCode = user ? 200 : 404;
  ctx.response.setHeader("content-type", "text/html; charset=utf-8");

  if (!user) {
    await streamHtmlSegments(ctx.response, [
      renderDocumentHead("User not found"),
      `<main><nav><a href="/">← All users</a></nav><h1>User not found</h1></main></body></html>`,
    ]);
    ctx.response.end();
    return;
  }

  connectRouteViewResources(
    ctx.routeId,
    [compiledViewId("user-edit")],
    [userDetailResource.id],
  );

  const snapshot = createGraphSnapshot(
    { userId: user.id },
    { includeGraph: false },
  );
  const bindingMap: BindingMap = { events: {}, lists: {} };

  await streamHtmlSegments(ctx.response, [
    renderDocumentHead(`Edit ${user.name}`),
    renderUserEditPage(user),
    renderPageEnd(snapshot, bindingMap),
  ]);
  ctx.response.end();
}
