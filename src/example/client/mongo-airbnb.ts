import {
  buildMongoAirbnbPageHref,
  renderMongoAirbnbCards,
  renderMongoAirbnbControls,
  renderMongoAirbnbPager,
  type MongoAirbnbListingRow,
  type MongoAirbnbPageState,
} from "../shared/mongo-airbnb.js";

type MongoAirbnbHistoryMode = "push" | "replace" | "none";

interface MongoAirbnbApiResponse extends MongoAirbnbPageState {
  rows: MongoAirbnbListingRow[];
}

const ROOT_SELECTOR = '[data-hx-id="airbnb-mongo-root"]';
const GRID_SELECTOR = '[data-hx-id="airbnb-mongo-grid"]';
const CONTROLS_SELECTOR = '[data-hx-id="airbnb-mongo-controls"]';
const PAGER_SELECTOR = ".airbnb-mongo-pager";

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

function ensureRoot(): HTMLElement | null {
  const root = document.querySelector(ROOT_SELECTOR);
  return root instanceof HTMLElement ? root : null;
}

function applyAirbnbMongoPage(
  root: HTMLElement,
  page: MongoAirbnbApiResponse,
): void {
  const controls = root.querySelector(CONTROLS_SELECTOR);
  if (!(controls instanceof HTMLElement)) {
    throw new Error("Missing Airbnb Mongo controls container");
  }

  controls.outerHTML = renderMongoAirbnbControls(page);

  const grid = root.querySelector(GRID_SELECTOR);
  if (!(grid instanceof HTMLElement)) {
    throw new Error("Missing Airbnb Mongo grid container");
  }

  grid.innerHTML = renderMongoAirbnbCards(page.rows);

  const pager = root.querySelector(PAGER_SELECTOR);
  if (!(pager instanceof HTMLElement)) {
    throw new Error("Missing Airbnb Mongo pager container");
  }

  pager.outerHTML = renderMongoAirbnbPager(page);
}

function buildHistoryUrl(page: MongoAirbnbApiResponse): string {
  return buildMongoAirbnbPageHref(page);
}

async function navigateToUrl(
  url: URL,
  historyMode: MongoAirbnbHistoryMode,
): Promise<void> {
  const root = ensureRoot();
  if (!root) {
    window.location.assign(url.toString());
    return;
  }

  root.setAttribute("aria-busy", "true");

  try {
    const apiUrl = new URL("/api/airbnb-mongo", window.location.origin);
    apiUrl.search = url.search;

    const response = await fetch(apiUrl.toString());
    if (!response.ok) {
      throw new Error(
        `Airbnb Mongo fetch failed with status ${response.status}`,
      );
    }

    const page = (await response.json()) as MongoAirbnbApiResponse;
    applyAirbnbMongoPage(root, page);

    if (historyMode === "push") {
      window.history.pushState({}, "", buildHistoryUrl(page));
    } else if (historyMode === "replace") {
      window.history.replaceState({}, "", buildHistoryUrl(page));
    }
  } catch {
    window.location.assign(url.toString());
  } finally {
    root.removeAttribute("aria-busy");
  }
}

function shouldHandlePopstate(): boolean {
  if (window.location.pathname !== "/airbnb-mongo") {
    return false;
  }

  return ensureRoot() !== null;
}

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const link = event.target.closest("a[data-airbnb-mongo-nav]");
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }

  const root = ensureRoot();
  if (!root || !root.contains(link)) {
    return;
  }

  if (!isPrimaryNavigationEvent(event)) {
    return;
  }

  const href = link.getAttribute("href");
  if (!href || !href.startsWith("/")) {
    return;
  }

  event.preventDefault();
  void navigateToUrl(new URL(href, window.location.origin), "push");
});

window.addEventListener("popstate", () => {
  if (!shouldHandlePopstate()) {
    return;
  }

  void navigateToUrl(new URL(window.location.href), "none");
});
