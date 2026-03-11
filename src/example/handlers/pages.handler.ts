import { createGraphSnapshot, streamHtmlSegments } from "../../helix/index.js";
import type { RouteContext } from "../../helix/index.js";
import { usersPageResource } from "../resources/users.resource.js";
import {
  EXTERNAL_PRODUCTS_PAGE_SIZE,
  externalProductsResource,
} from "../resources/external-products.resource.js";
import { getUserStats } from "../domain.js";
import { renderDocumentHead, renderPageEnd } from "../utils/html.js";
import { parsePage, resolveUsersQuery } from "../utils/query.js";
import { renderDashboardPage } from "../views/dashboard.js";
import { renderSettingsPage } from "../views/settings.js";
import { renderAboutPage } from "../views/about.js";
import { renderSearchPage } from "../views/search.js";
import { renderReportsPage } from "../views/reports.js";
import {
  renderExternalProductsPage,
  renderExternalProductsComponent,
} from "../views/external-products.js";
import {
  buildAppBindingMap,
  renderUsersLivePanel,
  renderUsersPageContent,
  type UsersPanelKind,
} from "../views/users.view.js";
import { renderAdminLayout } from "../views/admin-layout.js";
import { POSTS_PAGE_SIZE, postsResource } from "../resources/posts.resource.js";
import { renderPostsPage } from "../views/posts.js";

const appBindingMap = buildAppBindingMap();

interface AdminCoreView {
  title: string;
  content: string;
  snapshotCells: Record<string, unknown>;
}

function parseUsersPanelKind(value: string | null): UsersPanelKind {
  if (value === "reports" || value === "help" || value === "external-data") {
    return value;
  }
  return "summary";
}

function parseCoreTargetUrl(baseUrl: URL, rawPath: string | null): URL | null {
  const path = (rawPath ?? "").trim();
  if (!path.startsWith("/")) {
    return null;
  }

  try {
    return new URL(path, baseUrl);
  } catch {
    return null;
  }
}

async function renderAdminCoreForUrl(url: URL): Promise<AdminCoreView | null> {
  if (url.pathname === "/posts") {
    const page = parsePage(url.searchParams.get("page"));
    const postsPage = await postsResource.read({
      page,
      pageSize: POSTS_PAGE_SIZE,
    });
    return {
      title: "Posts",
      content: renderPostsPage(postsPage),
      snapshotCells: {
        posts: {
          page: postsPage.page,
          pageSize: postsPage.pageSize,
          total: postsPage.total,
          totalPages: postsPage.totalPages,
        },
      },
    };
  }
  if (url.pathname === "/") {
    const usersPage = await usersPageResource.read(resolveUsersQuery(url));

    return {
      title: "Users",
      content: renderUsersPageContent(usersPage),
      snapshotCells: {
        page: usersPage.page,
        pageSize: usersPage.pageSize,
        total: usersPage.total,
        totalPages: usersPage.totalPages,
        sortCol: usersPage.sortCol,
        sortDir: usersPage.sortDir,
      },
    };
  }

  if (url.pathname === "/dashboard") {
    const stats = getUserStats();
    return {
      title: "Dashboard",
      content: renderDashboardPage(stats),
      snapshotCells: { stats },
    };
  }

  if (url.pathname === "/reports") {
    const usersPage = await usersPageResource.read(resolveUsersQuery(url));
    return {
      title: "Reports",
      content: renderReportsPage(usersPage),
      snapshotCells: { usersPage },
    };
  }

  if (url.pathname === "/external-data") {
    const page = parsePage(url.searchParams.get("page"));
    const productsPage = await externalProductsResource.read({
      page,
      pageSize: EXTERNAL_PRODUCTS_PAGE_SIZE,
    });

    return {
      title: "External Data",
      content: renderExternalProductsPage(productsPage),
      snapshotCells: {
        externalData: {
          page: productsPage.page,
          pageSize: productsPage.pageSize,
          total: productsPage.total,
          totalPages: productsPage.totalPages,
        },
      },
    };
  }

  if (url.pathname === "/search") {
    return {
      title: "Search",
      content: renderSearchPage(),
      snapshotCells: {},
    };
  }

  if (url.pathname === "/settings") {
    return {
      title: "Settings",
      content: renderSettingsPage(),
      snapshotCells: {},
    };
  }

  if (url.pathname === "/about") {
    return {
      title: "About",
      content: renderAboutPage(),
      snapshotCells: {},
    };
  }

  return null;
}

async function sendAdminPage(
  ctx: RouteContext,
  view: AdminCoreView,
): Promise<void> {
  const snapshot = createGraphSnapshot(view.snapshotCells, {
    includeGraph: false,
  });

  ctx.response.statusCode = 200;
  ctx.response.setHeader("content-type", "text/html; charset=utf-8");
  await streamHtmlSegments(ctx.response, [
    renderDocumentHead(view.title),
    renderAdminLayout({
      title: view.title,
      activePath: ctx.url.pathname,
      content: view.content,
    }),
    renderPageEnd(snapshot, appBindingMap),
  ]);
  ctx.response.end();
}

export async function handlePosts(ctx: RouteContext): Promise<void> {
  const view = await renderAdminCoreForUrl(ctx.url);
  if (!view) {
    ctx.response.statusCode = 404;
    ctx.response.end("Not found");
    return;
  }

  await sendAdminPage(ctx, view);
}

export async function handleDashboard(ctx: RouteContext): Promise<void> {
  const view = await renderAdminCoreForUrl(ctx.url);
  if (!view) {
    ctx.response.statusCode = 404;
    ctx.response.end("Not found");
    return;
  }

  await sendAdminPage(ctx, view);
}

export async function handleSettings(ctx: RouteContext): Promise<void> {
  const view = await renderAdminCoreForUrl(ctx.url);
  if (!view) {
    ctx.response.statusCode = 404;
    ctx.response.end("Not found");
    return;
  }

  await sendAdminPage(ctx, view);
}

export async function handleAbout(ctx: RouteContext): Promise<void> {
  const view = await renderAdminCoreForUrl(ctx.url);
  if (!view) {
    ctx.response.statusCode = 404;
    ctx.response.end("Not found");
    return;
  }

  await sendAdminPage(ctx, view);
}

export async function handleSearch(ctx: RouteContext): Promise<void> {
  const view = await renderAdminCoreForUrl(ctx.url);
  if (!view) {
    ctx.response.statusCode = 404;
    ctx.response.end("Not found");
    return;
  }

  await sendAdminPage(ctx, view);
}

export async function handleReports(ctx: RouteContext): Promise<void> {
  const view = await renderAdminCoreForUrl(ctx.url);
  if (!view) {
    ctx.response.statusCode = 404;
    ctx.response.end("Not found");
    return;
  }

  await sendAdminPage(ctx, view);
}

export async function handleExternalData(ctx: RouteContext): Promise<void> {
  const view = await renderAdminCoreForUrl(ctx.url);
  if (!view) {
    ctx.response.statusCode = 404;
    ctx.response.end("Not found");
    return;
  }

  await sendAdminPage(ctx, view);
}

export async function handleAppCoreComponent(ctx: RouteContext): Promise<void> {
  const targetUrl = parseCoreTargetUrl(
    ctx.url,
    ctx.url.searchParams.get("path"),
  );
  if (!targetUrl) {
    ctx.response.statusCode = 400;
    ctx.response.end("Invalid path");
    return;
  }

  const view = await renderAdminCoreForUrl(targetUrl);
  if (!view) {
    ctx.response.statusCode = 404;
    ctx.response.end("Not found");
    return;
  }

  ctx.response.statusCode = 200;
  ctx.response.setHeader("content-type", "text/html; charset=utf-8");
  ctx.response.setHeader("x-helix-title", view.title);
  await streamHtmlSegments(ctx.response, [view.content]);
  ctx.response.end();
}

export async function handleUsersPanelComponent(
  ctx: RouteContext,
): Promise<void> {
  const panel = parseUsersPanelKind(ctx.url.searchParams.get("panel"));

  if (panel === "external-data") {
    const externalPage = parsePage(ctx.url.searchParams.get("externalPage"));
    const productsPage = await externalProductsResource.read({
      page: externalPage,
      pageSize: EXTERNAL_PRODUCTS_PAGE_SIZE,
    });

    ctx.response.statusCode = 200;
    ctx.response.setHeader("content-type", "text/html; charset=utf-8");
    await streamHtmlSegments(ctx.response, [
      renderExternalProductsComponent(productsPage),
    ]);
    ctx.response.end();
    return;
  }

  const usersPage = await usersPageResource.read(resolveUsersQuery(ctx.url));
  const stats = getUserStats();

  ctx.response.statusCode = 200;
  ctx.response.setHeader("content-type", "text/html; charset=utf-8");
  await streamHtmlSegments(ctx.response, [
    renderUsersLivePanel(panel, { usersPage, stats }),
  ]);
  ctx.response.end();
}
