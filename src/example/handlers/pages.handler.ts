import {
  compiledViewId,
  connectRouteViewResources,
  createGraphSnapshot,
  streamHtmlSegments,
} from "../../helix/index.js";
import type { RouteContext } from "../../helix/index.js";
import { usersPageResource } from "../resources/users.resource.js";
import {
  EXTERNAL_PRODUCTS_PAGE_SIZE,
  externalProductsResource,
  resolveExternalProductDetails,
} from "../resources/external-products.resource.js";
import { getUserStats } from "../domain.js";
import { renderDocumentHead, renderPageEnd } from "../utils/html.js";
import {
  createExternalProductsQuery,
  parsePage,
  resolveExternalProductsQuery,
  resolveUsersQuery,
} from "../utils/query.js";
import { renderDashboardPage } from "../views/dashboard.js";
import { renderSettingsPage } from "../views/settings.js";
import { renderAboutPage } from "../views/about.js";
import { renderSearchPage } from "../views/search.js";
import { renderReportsPage } from "../views/reports.js";
import {
  renderExternalProductsPage,
  renderExternalProductsComponent,
} from "../views/external-products.js";
import { renderExternalProductsRichPage } from "../views/external-products-rich.js";
import {
  buildAppBindingMap,
  renderUsersLivePanel,
  renderUsersPageContent,
  usersPageView,
  type UsersPanelKind,
} from "../views/users.view.js";
import { renderAdminLayout } from "../views/admin-layout.js";
import { POSTS_PAGE_SIZE, postsResource } from "../resources/posts.resource.js";
import { renderPostsPage } from "../views/posts.js";
import { renderPostsCreatePage } from "../views/posts-create.js";
import { renderInteractionsPage } from "../views/interactions.js";
import { renderExternalGridPage } from "../views/external-grid.js";
import { renderHostListingsPage } from "../views/host-listings.js";
import { renderPrimitivesPage } from "../views/primitives.js";

const appBindingMap = buildAppBindingMap();

interface AdminCoreView {
  title: string;
  content: string;
  snapshotCells: Record<string, unknown>;
  viewIds: string[];
  resourceIds: string[];
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
  if (url.pathname === "/external-grid") {
    const productsPage = await externalProductsResource.read(
      resolveExternalProductsQuery(url, EXTERNAL_PRODUCTS_PAGE_SIZE),
    );

    return {
      title: "External Grid",
      content: renderExternalGridPage(productsPage),
      snapshotCells: {},
      viewIds: [compiledViewId("external-grid")],
      resourceIds: [externalProductsResource.id],
    };
  }

  if (url.pathname === "/interactions") {
    return {
      title: "Interactions",
      content: renderInteractionsPage(),
      snapshotCells: {},
      viewIds: [compiledViewId("interactions")],
      resourceIds: [],
    };
  }

  if (url.pathname === "/primitives") {
    return {
      title: "Primitives",
      content: renderPrimitivesPage(),
      snapshotCells: {},
      viewIds: [compiledViewId("primitives")],
      resourceIds: [],
    };
  }

  if (url.pathname === "/posts/new") {
    return {
      title: "Create Post",
      content: renderPostsCreatePage(),
      snapshotCells: {},
      viewIds: [compiledViewId("posts-create")],
      resourceIds: [],
    };
  }

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
      viewIds: [compiledViewId("posts")],
      resourceIds: [postsResource.id],
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
      viewIds: [compiledViewId("users-page-content"), usersPageView.id],
      resourceIds: [usersPageResource.id],
    };
  }

  if (url.pathname === "/dashboard") {
    const stats = getUserStats();
    return {
      title: "Dashboard",
      content: renderDashboardPage(stats),
      snapshotCells: { stats },
      viewIds: [compiledViewId("dashboard")],
      resourceIds: [],
    };
  }

  if (url.pathname === "/reports") {
    const usersPage = await usersPageResource.read(resolveUsersQuery(url));
    return {
      title: "Reports",
      content: renderReportsPage(usersPage),
      snapshotCells: { usersPage },
      viewIds: [compiledViewId("reports"), compiledViewId("reports-summary")],
      resourceIds: [usersPageResource.id],
    };
  }

  if (url.pathname === "/external-data") {
    const productsPage = await externalProductsResource.read(
      resolveExternalProductsQuery(url, EXTERNAL_PRODUCTS_PAGE_SIZE),
    );

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
      viewIds: [compiledViewId("external-products")],
      resourceIds: [externalProductsResource.id],
    };
  }

  if (url.pathname === "/external-data-rich") {
    const productsPage = await externalProductsResource.read(
      resolveExternalProductsQuery(url, EXTERNAL_PRODUCTS_PAGE_SIZE),
    );
    const rows = await resolveExternalProductDetails(productsPage.rows);

    return {
      title: "External Data Rich",
      content: renderExternalProductsRichPage(productsPage, rows),
      snapshotCells: {
        externalDataRich: {
          page: productsPage.page,
          pageSize: productsPage.pageSize,
          total: productsPage.total,
          totalPages: productsPage.totalPages,
        },
      },
      viewIds: [compiledViewId("external-products-rich")],
      resourceIds: [externalProductsResource.id],
    };
  }

  if (url.pathname === "/host-listings") {
    const productsPage = await externalProductsResource.read(
      resolveExternalProductsQuery(url, EXTERNAL_PRODUCTS_PAGE_SIZE),
    );
    const rows = await resolveExternalProductDetails(productsPage.rows);

    return {
      title: "Host Listings",
      content: renderHostListingsPage(productsPage, rows),
      snapshotCells: {
        hostListings: {
          page: productsPage.page,
          pageSize: productsPage.pageSize,
          total: productsPage.total,
          totalPages: productsPage.totalPages,
        },
      },
      viewIds: [compiledViewId("host-listings")],
      resourceIds: [externalProductsResource.id],
    };
  }

  if (url.pathname === "/search") {
    return {
      title: "Search",
      content: renderSearchPage(),
      snapshotCells: {},
      viewIds: [compiledViewId("search")],
      resourceIds: [],
    };
  }

  if (url.pathname === "/settings") {
    return {
      title: "Settings",
      content: renderSettingsPage(),
      snapshotCells: {},
      viewIds: [compiledViewId("settings")],
      resourceIds: [],
    };
  }

  if (url.pathname === "/about") {
    return {
      title: "About",
      content: renderAboutPage(),
      snapshotCells: {},
      viewIds: [compiledViewId("about")],
      resourceIds: [],
    };
  }

  return null;
}

async function sendAdminPage(
  ctx: RouteContext,
  view: AdminCoreView,
): Promise<void> {
  connectRouteViewResources(ctx.routeId, view.viewIds, view.resourceIds);

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

async function handleAdminPageRoute(ctx: RouteContext): Promise<void> {
  const view = await renderAdminCoreForUrl(ctx.url);
  if (!view) {
    ctx.response.statusCode = 404;
    ctx.response.end("Not found");
    return;
  }

  await sendAdminPage(ctx, view);
}

export const handlePosts = handleAdminPageRoute;
export const handlePostsNew = handleAdminPageRoute;
export const handleInteractions = handleAdminPageRoute;
export const handleExternalGrid = handleAdminPageRoute;
export const handleDashboard = handleAdminPageRoute;
export const handleSettings = handleAdminPageRoute;
export const handleAbout = handleAdminPageRoute;
export const handleSearch = handleAdminPageRoute;
export const handleReports = handleAdminPageRoute;
export const handleExternalData = handleAdminPageRoute;
export const handleExternalDataRich = handleAdminPageRoute;
export const handleHostListings = handleAdminPageRoute;
export const handlePrimitives = handleAdminPageRoute;

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
  connectRouteViewResources(ctx.routeId, view.viewIds, view.resourceIds);
  await streamHtmlSegments(ctx.response, [view.content]);
  ctx.response.end();
}

export async function handleUsersPanelComponent(
  ctx: RouteContext,
): Promise<void> {
  const panel = parseUsersPanelKind(ctx.url.searchParams.get("panel"));

  if (panel === "external-data") {
    const externalPage = parsePage(ctx.url.searchParams.get("externalPage"));
    const productsPage = await externalProductsResource.read(
      createExternalProductsQuery(EXTERNAL_PRODUCTS_PAGE_SIZE, {
        page: externalPage,
      }),
    );

    connectRouteViewResources(
      ctx.routeId,
      [compiledViewId("external-products-component")],
      [externalProductsResource.id],
    );

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
