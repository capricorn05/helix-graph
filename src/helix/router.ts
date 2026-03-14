/**
 * Server-side Graph Router (Section 4.1 / 7.1 RouteNode)
 *
 * Routes are first-class graph nodes. Every `defineRoute()` call registers a
 * RouteNode in the UnifiedGraph with its method and pattern as metadata, so:
 *   - devtools can display the full route table
 *   - the graph knows which views/resources each route activates
 *   - chunk planner (future) can compute per-route activation bundles
 *
 * Usage:
 *   const homeRoute = defineRoute("GET", "/", async ({ response }) => { ... });
 *   const userRoute = defineRoute("GET", "/users/:id", async ({ params }) => { ... });
 *   const router = createRouter([homeRoute, userRoute]);
 *   // In createServer: await router.dispatch(request, response, url)
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { nextNodeId, runtimeGraph } from "./graph.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RouteMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

/** Path parameters extracted from URL pattern segments (e.g. `:id` → `{ id: "42" }`). */
export interface RouteParams {
  [key: string]: string;
}

/** Everything a route handler needs. */
export interface RouteContext<P extends RouteParams = RouteParams> {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  params: P;
  searchParams: URLSearchParams;
}

export type RouteHandler<P extends RouteParams = RouteParams> = (
  ctx: RouteContext<P>,
) => Promise<void> | void;

export interface RouteDefinition<P extends RouteParams = RouteParams> {
  readonly id: string;
  readonly method: RouteMethod | "*";
  readonly pattern: string;
  readonly handler: RouteHandler<P>;
}

// ---------------------------------------------------------------------------
// Pattern compiler
// ---------------------------------------------------------------------------

type SegmentToken =
  | { kind: "static"; value: string }
  | { kind: "param"; name: string }
  | { kind: "wildcard" };

interface CompiledPattern {
  tokens: SegmentToken[];
}

function parsePatternSegments(pattern: string): string[] {
  if (pattern === "/") {
    return [];
  }
  return pattern.split("/").filter((segment) => segment.length > 0);
}

function compilePattern(pattern: string): CompiledPattern {
  const segments = parsePatternSegments(pattern);
  const tokens: SegmentToken[] = segments.map((segment) => {
    if (segment === "*") {
      return { kind: "wildcard" };
    }
    if (segment.startsWith(":")) {
      return { kind: "param", name: segment.slice(1) };
    }
    return { kind: "static", value: segment };
  });
  return { tokens };
}

function pathSegments(pathname: string): string[] {
  if (pathname === "/") {
    return [];
  }
  return pathname.split("/").filter((segment) => segment.length > 0);
}

function matchCompiled(
  tokens: readonly SegmentToken[],
  segments: readonly string[],
): RouteParams | null {
  const params: RouteParams = {};
  let segmentIndex = 0;

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    if (token.kind === "wildcard") {
      if (tokenIndex !== tokens.length - 1) {
        return null;
      }
      return params;
    }

    const segment = segments[segmentIndex];
    if (segment === undefined) {
      return null;
    }

    if (token.kind === "static") {
      if (segment !== token.value) {
        return null;
      }
    } else {
      params[token.name] = decodeURIComponent(segment);
    }
    segmentIndex += 1;
  }

  return segmentIndex === segments.length ? params : null;
}

// ---------------------------------------------------------------------------
// defineRoute
// ---------------------------------------------------------------------------

/**
 * Declare a route as a graph node and return a RouteDefinition.
 *
 * ```ts
 * const usersRoute = defineRoute("GET", "/api/users", async ({ response, searchParams }) => {
 *   const page = Number(searchParams.get("page") ?? "1");
 *   sendJson(response, 200, await getUsers(page));
 * });
 *
 * const userRoute = defineRoute("GET", "/users/:id", async ({ response, params }) => {
 *   const user = getUserById(Number(params.id));
 *   if (!user) { response.statusCode = 404; response.end("Not found"); return; }
 *   await streamHtmlPage(response, userDetailView.render({ user }));
 * });
 * ```
 */
export function defineRoute<P extends RouteParams = RouteParams>(
  method: RouteMethod | "*",
  pattern: string,
  handler: RouteHandler<P>,
): RouteDefinition<P> {
  const id = nextNodeId("route");

  runtimeGraph.addNode({
    id,
    type: "RouteNode",
    label: `${method} ${pattern}`,
    meta: { method, pattern },
  });

  return { id, method, pattern, handler };
}

// ---------------------------------------------------------------------------
// createRouter
// ---------------------------------------------------------------------------

export interface HelixRouter {
  /**
   * Try to match `request` against registered routes.
   * Returns `true` if a route matched and handled the response, `false` otherwise.
   */
  dispatch(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
  ): Promise<boolean>;

  /** All registered route definitions (for introspection / manifest generation). */
  getRoutes(): ReadonlyArray<RouteDefinition<any>>;
}

interface InternalRoute {
  definition: RouteDefinition<any>;
  compiled: CompiledPattern;
  index: number;
}

interface RouteBucket {
  routes: InternalRoute[];
}

function createRouteBucket(): RouteBucket {
  return { routes: [] };
}

function methodKey(method: RouteMethod | "*"): RouteMethod | "*" {
  return method;
}

function firstStaticSegment(
  tokens: readonly SegmentToken[],
): string | undefined {
  for (const token of tokens) {
    if (token.kind === "static") {
      return token.value;
    }
    if (token.kind === "param" || token.kind === "wildcard") {
      return undefined;
    }
  }
  return undefined;
}

function hasWildcard(tokens: readonly SegmentToken[]): boolean {
  return tokens.some((token) => token.kind === "wildcard");
}

function segmentLengthKey(tokens: readonly SegmentToken[]): string {
  if (tokens.length === 0) {
    return "0";
  }
  if (hasWildcard(tokens)) {
    return "*";
  }
  return String(tokens.length);
}

function methodCandidates(method: RouteMethod): Array<RouteMethod | "*"> {
  return [method, "*"];
}

/**
 * Compile a list of route definitions into a dispatchable router.
 * Routes are tested **in declaration order** — put more specific patterns first.
 *
 * ```ts
 * const router = createRouter([
 *   homeRoute,
 *   userDetailRoute,  // /users/:id before wildcard static route
 *   apiUsersRoute,
 *   staticRoute,      // GET * — catch-all for static files
 * ]);
 * ```
 */
export function createRouter(
  routes: ReadonlyArray<RouteDefinition<any>>,
): HelixRouter {
  const internal: InternalRoute[] = routes.map((def, index) => ({
    definition: def,
    compiled: compilePattern(def.pattern),
    index,
  }));

  const indexed = new Map<
    RouteMethod | "*",
    Map<string, Map<string, RouteBucket>>
  >();

  const ensureBucket = (
    method: RouteMethod | "*",
    lengthKey: string,
    staticHead: string,
  ): RouteBucket => {
    let lengthMap = indexed.get(method);
    if (!lengthMap) {
      lengthMap = new Map();
      indexed.set(method, lengthMap);
    }

    let staticMap = lengthMap.get(lengthKey);
    if (!staticMap) {
      staticMap = new Map();
      lengthMap.set(lengthKey, staticMap);
    }

    let bucket = staticMap.get(staticHead);
    if (!bucket) {
      bucket = createRouteBucket();
      staticMap.set(staticHead, bucket);
    }

    return bucket;
  };

  for (const route of internal) {
    const method = methodKey(route.definition.method);
    const lengthKey = segmentLengthKey(route.compiled.tokens);
    const staticHead = firstStaticSegment(route.compiled.tokens) ?? "*";
    const bucket = ensureBucket(method, lengthKey, staticHead);
    bucket.routes.push(route);
  }

  const gatherCandidates = (
    method: RouteMethod,
    pathname: string,
  ): InternalRoute[] => {
    const segments = pathSegments(pathname);
    const head = segments[0] ?? "";
    const candidates: InternalRoute[] = [];

    for (const methodVariant of methodCandidates(method)) {
      const lengthMap = indexed.get(methodVariant);
      if (!lengthMap) {
        continue;
      }

      const lengthKeys = [String(segments.length), "*"];
      for (const lengthKey of lengthKeys) {
        const staticMap = lengthMap.get(lengthKey);
        if (!staticMap) {
          continue;
        }

        const exactBucket = staticMap.get(head);
        if (exactBucket) {
          candidates.push(...exactBucket.routes);
        }

        const wildcardHeadBucket = staticMap.get("*");
        if (wildcardHeadBucket) {
          candidates.push(...wildcardHeadBucket.routes);
        }
      }
    }

    candidates.sort((a, b) => a.index - b.index);
    return candidates;
  };

  return {
    getRoutes: () => routes,

    async dispatch(request, response, url): Promise<boolean> {
      const method = (request.method ?? "GET").toUpperCase() as RouteMethod;
      const segments = pathSegments(url.pathname);
      const candidates = gatherCandidates(method, url.pathname);

      for (const route of candidates) {
        const params = matchCompiled(route.compiled.tokens, segments);
        if (!params) {
          continue;
        }

        await route.definition.handler({
          request,
          response,
          url,
          params: params as Parameters<
            typeof route.definition.handler
          >[0]["params"],
          searchParams: url.searchParams,
        });

        return true;
      }

      return false;
    },
  };
}
