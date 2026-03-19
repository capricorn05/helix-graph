import { escapeHtml } from "../../helix/index.js";

interface AdminNavItem {
  href: string;
  label: string;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/", label: "Users" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reports", label: "Reports" },
  { href: "/primitives", label: "Primitives" },
  { href: "/interactions", label: "Interactions" },
  { href: "/external-grid", label: "External Grid" },
  { href: "/external-data", label: "External Data" },
  { href: "/external-data-rich", label: "External Data Rich" },
  { href: "/host-listings", label: "Host Listings" },
  { href: "/posts", label: "Posts" },
  { href: "/posts/new", label: "New Post" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
  { href: "/about", label: "About" },
];

function normalizeActivePath(pathname: string): string {
  if (pathname === "/users" || pathname.startsWith("/users/")) {
    return "/";
  }

  const directMatch = ADMIN_NAV_ITEMS.find((item) => item.href === pathname);
  return directMatch ? directMatch.href : "/";
}

function renderNavLinks(activePath: string, location: "top" | "side"): string {
  return ADMIN_NAV_ITEMS.map((item) => {
    const isActive = item.href === activePath;
    const activeClass = isActive ? " is-active" : "";
    const ariaCurrent = isActive ? ' aria-current="page"' : "";

    return `<a href="${escapeHtml(item.href)}" class="admin-nav-link${activeClass}" data-nav-link data-nav-location="${location}" data-nav-path="${escapeHtml(item.href)}" data-hx-bind="app-nav"${ariaCurrent}>${escapeHtml(item.label)}</a>`;
  }).join("");
}

export interface AdminLayoutOptions {
  title: string;
  activePath: string;
  content: string;
}

export function renderAdminLayout(options: AdminLayoutOptions): string {
  const activePath = normalizeActivePath(options.activePath);

  return `<main class="admin-shell">
  <header class="admin-topbar">
    <div class="admin-brand">Helix Admin</div>
    <nav class="admin-topnav" aria-label="Top menu">
      ${renderNavLinks(activePath, "top")}
    </nav>
  </header>

  <div class="admin-body">
    <aside class="admin-sidebar">
      <h2 class="admin-sidebar-title">Navigation</h2>
      <nav class="admin-sidenav" aria-label="Side menu">
        ${renderNavLinks(activePath, "side")}
      </nav>
    </aside>

    <section class="admin-core-shell">
      <header class="admin-core-header">
        <h1 data-hx-id="app-core-title">${escapeHtml(options.title)}</h1>
      </header>
      <div class="admin-core" data-hx-id="app-core" aria-live="polite">
        ${options.content}
      </div>
    </section>
  </div>
</main>`;
}
