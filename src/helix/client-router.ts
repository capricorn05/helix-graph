/**
 * Client-side Graph Router
 *
 * The active URL is a reactive `cell<URL>` registered as a RouteNode in the
 * UnifiedGraph. This means:
 *   - every `derived` / resource that calls `routeSearchParam()` or `routePathname()`
 *     automatically becomes a graph dependency of the URL
 *   - `navigate()` is just a cell write — no special router event bus needed
 *   - devtools shows the route cell as a first-class node with its dependents
 *
 * Usage in bootstrap:
 *   installPopStateListener();
 *   const clientRouter = createClientRouter([
 *     { pattern: "/users/:id", chunk: "/client/user-detail.js" },
 *   ]);
 *   clientRouter.start();
 *
 * Usage anywhere in client code:
 *   import { navigate, routeSearchParam } from "../../helix/client-router.js";
 *
 *   const currentPage = routeSearchParam("page");   // Derived<string | null>
 *   navigate("/users/42");                          // updates routeCell → invalidates deps
 */

import { cell, derived } from "./reactive.js";
import type { Cell, Derived } from "./reactive.js";
import { runtimeGraph } from "./graph.js";

// ---------------------------------------------------------------------------
// Route cell — the reactive URL
// ---------------------------------------------------------------------------

let _routeCell: Cell<URL> | null = null;
const routeSearchParamCache = new Map<string, Derived<string | null>>();
let routePathnameCache: Derived<string> | null = null;

/**
 * Returns the singleton reactive URL cell.
 * First call initialises it from `window.location` and registers it in the
 * UnifiedGraph as a `RouteNode` (overriding the default `CellNode` type set
 * by the `cell()` constructor).
 */
export function getRouteCell(): Cell<URL> {
  if (!_routeCell) {
    const initial =
      typeof window !== "undefined"
        ? new URL(window.location.href)
        : new URL("http://localhost/");

    _routeCell = cell(initial, { name: "route", scope: "app" });

    // Override type to RouteNode so devtools + graph show it correctly
    runtimeGraph.addNode({
      id: _routeCell.id,
      type: "RouteNode",
      label: "route",
      meta: { clientSide: true, pattern: "*" }
    });
  }
  return _routeCell;
}

// ---------------------------------------------------------------------------
// Derived accessors — reactive values computed from the URL
// ---------------------------------------------------------------------------

/**
 * Returns a derived cell that tracks one URL search parameter.
 * Automatically recomputes when the route changes.
 *
 * @example
 * const page = routeSearchParam("page"); // Derived<string | null>
 * console.log(page.get()); // "2" or null
 */
export function routeSearchParam(name: string): Derived<string | null> {
  const cached = routeSearchParamCache.get(name);
  if (cached) {
    return cached;
  }

  const next = derived(
    () => getRouteCell().get().searchParams.get(name),
    { name: `route.search.${name}` }
  );
  routeSearchParamCache.set(name, next);
  return next;
}

/**
 * Returns a derived cell for the current pathname.
 *
 * @example
 * const path = routePathname(); // Derived<string>
 * console.log(path.get()); // "/users/42"
 */
export function routePathname(): Derived<string> {
  if (!routePathnameCache) {
    routePathnameCache = derived(
      () => getRouteCell().get().pathname,
      { name: "route.pathname" }
    );
  }
  return routePathnameCache;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Navigate to `href`, pushing a new browser history entry.
 * Updates the route cell so all reactive subscribers (derived values, client
 * router chunk loaders, etc.) are notified synchronously.
 *
 * @example
 * navigate("/users/42");
 * navigate("/users?page=2&sortDir=desc");
 */
export function navigate(href: string, state: unknown = null): void {
  const url = new URL(href, window.location.origin);
  history.pushState(state, "", url.toString());
  getRouteCell().set(url);
}

/**
 * Same as `navigate()` but uses `replaceState` — no new history entry.
 *
 * @example
 * replace("/?created=true");  // shows success banner without adding to history
 */
export function replace(href: string, state: unknown = null): void {
  const url = new URL(href, window.location.origin);
  history.replaceState(state, "", url.toString());
  getRouteCell().set(url);
}

// ---------------------------------------------------------------------------
// Pop-state listener
// ---------------------------------------------------------------------------

/**
 * Wire browser back/forward buttons to the route cell.
 * Call once from bootstrap — idempotent.
 */
let popStateInstalled = false;

export function installPopStateListener(): void {
  if (popStateInstalled || typeof window === "undefined") return;
  popStateInstalled = true;

  window.addEventListener("popstate", () => {
    getRouteCell().set(new URL(window.location.href));
  });
}

// ---------------------------------------------------------------------------
// Client router — pattern matching + lazy chunk loading
// ---------------------------------------------------------------------------

export interface ClientRoute {
  /** Path pattern, same syntax as `defineRoute`: `/users/:id`, `/blog/*`, etc. */
  pattern: string;
  /**
   * ES module chunk to `import()` when this route matches.
   * If provided, the chunk is loaded once and cached.
   */
  chunk?: string;
  /**
   * Called when the route is entered with the resolved URL and path params.
   * Receives the loaded chunk module as the third argument.
   */
  onEnter?: (
    url: URL,
    params: Record<string, string>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chunk?: Record<string, any>
  ) => Promise<void> | void;
}

interface CompiledClientRoute {
  route: ClientRoute;
  regex: RegExp;
  paramNames: string[];
}

function compileClientPattern(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const regexStr = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_m, name: string) => {
      paramNames.push(name);
      return "([^/]+)";
    })
    .replace(/\*/g, "(.*)");
  return { regex: new RegExp(`^${regexStr}$`), paramNames };
}

const loadedChunks = new Map<string, Record<string, unknown>>();

export interface HelixClientRouter {
  /** Subscribe to route cell and start dispatching. */
  start(): void;
  /** Manually dispatch for the current URL (useful after start()). */
  dispatch(url: URL): Promise<void>;
}

/**
 * Create a client-side route dispatcher that:
 * 1. Subscribes to the route cell
 * 2. On each URL change, finds the matching route
 * 3. Lazy-loads the declared `chunk` (once, cached)
 * 4. Calls `onEnter` with the URL, params, and loaded module
 *
 * @example
 * const router = createClientRouter([
 *   {
 *     pattern: "/users/:id",
 *     chunk: "/client/user-detail.js",
 *     onEnter: async (url, params, mod) => {
 *       await mod?.renderUserDetail(Number(params.id));
 *     },
 *   },
 * ]);
 * router.start();
 */
export function createClientRouter(routes: ClientRoute[]): HelixClientRouter {
  const compiled: CompiledClientRoute[] = routes.map((route) => {
    const { regex, paramNames } = compileClientPattern(route.pattern);
    return { route, regex, paramNames };
  });

  async function dispatch(url: URL): Promise<void> {
    for (const { route, regex, paramNames } of compiled) {
      const match = regex.exec(url.pathname);
      if (!match) continue;

      const params: Record<string, string> = {};
      paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1] ?? "");
      });

      let chunkModule: Record<string, unknown> | undefined;
      if (route.chunk) {
        if (!loadedChunks.has(route.chunk)) {
          const mod = (await import(route.chunk)) as Record<string, unknown>;
          loadedChunks.set(route.chunk, mod);
        }
        chunkModule = loadedChunks.get(route.chunk);
      }

      await route.onEnter?.(url, params, chunkModule);
      return;
    }
  }

  return {
    start() {
      installPopStateListener();
      getRouteCell().subscribe((url) => {
        dispatch(url).catch((err: unknown) => {
          console.error("[Helix] client router error:", err);
        });
      });
    },
    dispatch
  };
}
