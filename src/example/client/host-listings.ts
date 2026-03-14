import {
  buildHostListingsPageHref,
  renderHostListingsCards,
  renderHostListingsPager,
  type HostListingRow,
  type HostListingsPageState,
} from "../shared/host-listings.js";

interface HostListingsApiResponse extends HostListingsPageState {
  rows: HostListingRow[];
}

type HostListingsHistoryMode = "push" | "replace" | "none";

const ROOT_SELECTOR = '[data-hx-id="host-listings-root"]';
const GRID_SELECTOR = '[data-hx-id="host-listings-grid"]';
const PAGER_SELECTOR = ".host-listings-pager";

function isPrimaryNavigationEvent(event: Event): boolean {
  if (!(event instanceof MouseEvent)) {
    return true;
  }

  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function ensureHostListingsRoot(): HTMLElement | null {
  const root = document.querySelector(ROOT_SELECTOR);
  return root instanceof HTMLElement ? root : null;
}

function applyHostListingsPage(
  root: HTMLElement,
  productsPage: HostListingsApiResponse,
): void {
  const grid = root.querySelector(GRID_SELECTOR);
  if (!(grid instanceof HTMLElement)) {
    throw new Error("Missing host listings grid container");
  }

  grid.innerHTML = renderHostListingsCards(productsPage.rows);

  const pager = root.querySelector(PAGER_SELECTOR);
  if (!(pager instanceof HTMLElement)) {
    throw new Error("Missing host listings pager container");
  }

  pager.outerHTML = renderHostListingsPager(productsPage);
}

function buildHistoryUrl(productsPage: HostListingsApiResponse): string {
  return buildHostListingsPageHref(productsPage, productsPage.page);
}

async function navigateHostListingsUrl(
  url: URL,
  historyMode: HostListingsHistoryMode,
): Promise<void> {
  const root = ensureHostListingsRoot();
  if (!root) {
    window.location.assign(url.toString());
    return;
  }

  root.setAttribute("aria-busy", "true");

  try {
    const apiUrl = new URL("/api/host-listings", window.location.origin);
    apiUrl.search = url.search;

    const response = await fetch(apiUrl.toString());
    if (!response.ok) {
      throw new Error(
        `Host listings fetch failed with status ${response.status}`,
      );
    }

    const productsPage = (await response.json()) as HostListingsApiResponse;
    applyHostListingsPage(root, productsPage);

    if (historyMode === "push") {
      window.history.pushState({}, "", buildHistoryUrl(productsPage));
    } else if (historyMode === "replace") {
      window.history.replaceState({}, "", buildHistoryUrl(productsPage));
    }
  } catch {
    window.location.assign(url.toString());
  } finally {
    root.removeAttribute("aria-busy");
  }
}

function shouldHandleHostListingsPopstate(): boolean {
  if (window.location.pathname !== "/host-listings") {
    return false;
  }

  return ensureHostListingsRoot() !== null;
}

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const pagerLink = event.target.closest("a[data-host-listings-page]");
  if (!(pagerLink instanceof HTMLAnchorElement)) {
    return;
  }

  const root = ensureHostListingsRoot();
  if (!root || !root.contains(pagerLink)) {
    return;
  }

  if (!isPrimaryNavigationEvent(event)) {
    return;
  }

  const href = pagerLink.getAttribute("href");
  if (!href || !href.startsWith("/")) {
    return;
  }

  event.preventDefault();
  void navigateHostListingsUrl(new URL(href, window.location.origin), "push");
});

window.addEventListener("popstate", () => {
  if (!shouldHandleHostListingsPopstate()) {
    return;
  }

  const targetUrl = new URL(window.location.href);
  void navigateHostListingsUrl(targetUrl, "none");
});
