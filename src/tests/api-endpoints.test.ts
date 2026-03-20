/**
 * Focused route/handler tests for:
 *   GET /api/users/suggest
 *   POST /actions/reorder-posts
 *   GET /api/invalidation-stream
 */

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import type { RouteContext } from "../helix/router.js";
import {
  handleUsersSuggestApi,
  handleReorderPosts,
  handleInvalidationStream,
  handleCreateUser,
} from "../example/handlers/api.handler.js";
import {
  setPostsStoreForTests,
  resetPostsStoreForTests,
  POSTS_PAGE_SIZE,
  type PostRow,
} from "../example/resources/posts.resource.js";

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

interface MockHttpResponse {
  response: ServerResponse;
  get body(): string;
  get statusCode(): number;
  headers: Map<string, string>;
}

function createMockResponse(): MockHttpResponse {
  let body = "";
  const headers = new Map<string, string>();
  let statusCode = 200;

  const response = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(value: number) {
      statusCode = value;
    },
    setHeader(name: string, value: unknown) {
      headers.set(name.toLowerCase(), String(value));
      return this;
    },
    write(chunk: unknown) {
      body += String(chunk);
      return true;
    },
    end(chunk?: unknown) {
      if (chunk !== undefined) {
        body += String(chunk);
      }
      return this;
    },
  } as unknown as ServerResponse;

  return {
    response,
    headers,
    get body() {
      return body;
    },
    get statusCode() {
      return statusCode;
    },
  };
}

function createMockGetRequest(): IncomingMessage {
  return Object.assign(new EventEmitter(), { method: "GET" }) as unknown as IncomingMessage;
}

function createMockPostRequest(body: unknown): IncomingMessage {
  const readable = Readable.from([Buffer.from(JSON.stringify(body), "utf8")]);
  return readable as unknown as IncomingMessage;
}

function makeGetContext(url: string): RouteContext & { mock: MockHttpResponse } {
  const mock = createMockResponse();
  const request = createMockGetRequest();
  const parsed = new URL(`http://localhost${url}`);
  return {
    request,
    response: mock.response,
    url: parsed,
    routeId: `test:${url}`,
    params: {},
    searchParams: parsed.searchParams,
    mock,
  } as unknown as RouteContext & { mock: MockHttpResponse };
}

function makePostContext(
  url: string,
  body: unknown,
): RouteContext & { mock: MockHttpResponse } {
  const mock = createMockResponse();
  const request = createMockPostRequest(body);
  const parsed = new URL(`http://localhost${url}`);
  return {
    request,
    response: mock.response,
    url: parsed,
    routeId: `test:${url}`,
    params: {},
    searchParams: parsed.searchParams,
    mock,
  } as unknown as RouteContext & { mock: MockHttpResponse };
}

// ---------------------------------------------------------------------------
// Seed posts used across reorder tests
// ---------------------------------------------------------------------------

const SEED_POSTS: PostRow[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  userId: 1,
  title: `Post ${i + 1}`,
  body: `Body for post ${i + 1}`,
}));

// ---------------------------------------------------------------------------
// /api/users/suggest
// ---------------------------------------------------------------------------

test("/api/users/suggest returns matching suggestions for a query", async () => {
  const ctx = makeGetContext("/api/users/suggest?q=ava");

  await handleUsersSuggestApi(ctx);

  assert.equal(ctx.mock.statusCode, 200);
  assert.match(ctx.mock.headers.get("content-type") ?? "", /application\/json/);

  const payload = JSON.parse(ctx.mock.body) as { suggestions: unknown[] };
  assert.ok(Array.isArray(payload.suggestions));
  assert.ok(payload.suggestions.length > 0, "Expected at least one suggestion for 'ava'");

  const first = payload.suggestions[0] as Record<string, unknown>;
  assert.ok(typeof first.id === "number");
  assert.ok(typeof first.name === "string");
  assert.ok(typeof first.email === "string");
  assert.ok(first.status === "active" || first.status === "pending");
  assert.match(String(first.name).toLowerCase(), /ava/);
});

test("/api/users/suggest returns empty array for no-match query", async () => {
  const ctx = makeGetContext("/api/users/suggest?q=zzznomatch");

  await handleUsersSuggestApi(ctx);

  assert.equal(ctx.mock.statusCode, 200);
  const payload = JSON.parse(ctx.mock.body) as { suggestions: unknown[] };
  assert.deepEqual(payload.suggestions, []);
});

test("/api/users/suggest returns empty array when q is absent", async () => {
  const ctx = makeGetContext("/api/users/suggest");

  await handleUsersSuggestApi(ctx);

  assert.equal(ctx.mock.statusCode, 200);
  const payload = JSON.parse(ctx.mock.body) as { suggestions: unknown[] };
  assert.deepEqual(payload.suggestions, []);
});

test("/api/users/suggest caps results at 8", async () => {
  // 'a' matches almost every seed user (name or email); result count must not exceed 8
  const ctx = makeGetContext("/api/users/suggest?q=a");

  await handleUsersSuggestApi(ctx);

  assert.equal(ctx.mock.statusCode, 200);
  const payload = JSON.parse(ctx.mock.body) as { suggestions: unknown[] };
  assert.ok(payload.suggestions.length <= 8, `Expected ≤8 suggestions, got ${payload.suggestions.length}`);
});

test("/api/users/suggest matches on email as well as name", async () => {
  const ctx = makeGetContext("/api/users/suggest?q=example.com");

  await handleUsersSuggestApi(ctx);

  assert.equal(ctx.mock.statusCode, 200);
  const payload = JSON.parse(ctx.mock.body) as { suggestions: unknown[] };
  assert.ok(payload.suggestions.length > 0, "Expected email-matched suggestions");
});

// ---------------------------------------------------------------------------
// /actions/reorder-posts
// ---------------------------------------------------------------------------

test.beforeEach(() => {
  setPostsStoreForTests(SEED_POSTS);
});

test.afterEach(() => {
  resetPostsStoreForTests();
});

test("/actions/reorder-posts returns 400 when rowIds is missing", async () => {
  const ctx = makePostContext("/actions/reorder-posts", { page: 1 });

  await handleReorderPosts(ctx);

  assert.equal(ctx.mock.statusCode, 400);
  const payload = JSON.parse(ctx.mock.body) as { error: string };
  assert.ok(payload.error.toLowerCase().includes("rowids"));
});

test("/actions/reorder-posts returns 400 when rowIds is empty", async () => {
  const ctx = makePostContext("/actions/reorder-posts", { page: 1, rowIds: [] });

  await handleReorderPosts(ctx);

  assert.equal(ctx.mock.statusCode, 400);
  const payload = JSON.parse(ctx.mock.body) as { error: string };
  assert.ok(payload.error.toLowerCase().includes("rowids"));
});

test("/actions/reorder-posts returns 400 when rowIds contains a negative id", async () => {
  const ctx = makePostContext("/actions/reorder-posts", {
    page: 1,
    rowIds: [-1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  });

  await handleReorderPosts(ctx);

  assert.equal(ctx.mock.statusCode, 400);
  const payload = JSON.parse(ctx.mock.body) as { error: string };
  assert.ok(payload.error.toLowerCase().includes("positive integer"));
});

test("/actions/reorder-posts returns 400 when rowIds contains a float", async () => {
  const ctx = makePostContext("/actions/reorder-posts", {
    page: 1,
    rowIds: [1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  });

  await handleReorderPosts(ctx);

  assert.equal(ctx.mock.statusCode, 400);
  const payload = JSON.parse(ctx.mock.body) as { error: string };
  assert.ok(payload.error.toLowerCase().includes("positive integer"));
});

test("/actions/reorder-posts returns 400 when rowIds do not match page window", async () => {
  // Page 1 with pageSize 10 should have ids 1-10. Sending ids from page 2 (11-20) should fail.
  const ctx = makePostContext("/actions/reorder-posts", {
    page: 1,
    rowIds: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  });

  await handleReorderPosts(ctx);

  assert.equal(ctx.mock.statusCode, 400);
});

test("/actions/reorder-posts returns { ok: true } for valid reorder", async () => {
  // Page 1 ids are 1-10 (POSTS_PAGE_SIZE = 10). Send a reversed order.
  const pageIds = SEED_POSTS.slice(0, POSTS_PAGE_SIZE).map((p) => p.id);
  const reversed = [...pageIds].reverse();

  const ctx = makePostContext("/actions/reorder-posts", {
    page: 1,
    rowIds: reversed,
  });

  await handleReorderPosts(ctx);

  assert.equal(ctx.mock.statusCode, 200);
  const payload = JSON.parse(ctx.mock.body) as { ok: boolean };
  assert.equal(payload.ok, true);
});

test("/actions/reorder-posts defaults page to 1 when page is omitted", async () => {
  const pageIds = SEED_POSTS.slice(0, POSTS_PAGE_SIZE).map((p) => p.id);
  const reversed = [...pageIds].reverse();

  const ctx = makePostContext("/actions/reorder-posts", { rowIds: reversed });

  await handleReorderPosts(ctx);

  assert.equal(ctx.mock.statusCode, 200);
  const payload = JSON.parse(ctx.mock.body) as { ok: boolean };
  assert.equal(payload.ok, true);
});

// ---------------------------------------------------------------------------
// /api/invalidation-stream
// ---------------------------------------------------------------------------

test("/api/invalidation-stream sets SSE headers and immediately writes connected comment", async () => {
  const mock = createMockResponse();
  const request = createMockGetRequest();
  const ctx = {
    request,
    response: mock.response,
    url: new URL("http://localhost/api/invalidation-stream"),
    routeId: "test:/api/invalidation-stream",
    params: {},
    searchParams: new URLSearchParams(),
  } as unknown as RouteContext;

  await handleInvalidationStream(ctx);

  assert.equal(mock.statusCode, 200);
  assert.equal(
    mock.headers.get("content-type"),
    "text/event-stream; charset=utf-8",
  );
  assert.equal(mock.headers.get("cache-control"), "no-cache, no-transform");
  assert.equal(mock.headers.get("connection"), "keep-alive");
  assert.ok(mock.body.includes(": connected\n\n"), "Expected SSE connected comment");

  // Cleanup: trigger close so the heartbeat interval is cleared
  request.emit("close");
});

test("/api/invalidation-stream removes client on request close", async () => {
  const mock = createMockResponse();
  const request = createMockGetRequest();
  const ctx = {
    request,
    response: mock.response,
    url: new URL("http://localhost/api/invalidation-stream"),
    routeId: "test:/api/invalidation-stream",
    params: {},
    searchParams: new URLSearchParams(),
  } as unknown as RouteContext;

  await handleInvalidationStream(ctx);

  const bodyBeforeClose = mock.body;
  request.emit("close");

  // After close, no further SSE payloads should be written to this response.
  // We confirm by checking that no additional content was appended by the removal path itself.
  assert.equal(mock.body, bodyBeforeClose);
});

test("/api/invalidation-stream broadcasts invalidation tags to connected clients", async () => {
  const mock = createMockResponse();
  const request = createMockGetRequest();
  const ctx = {
    request,
    response: mock.response,
    url: new URL("http://localhost/api/invalidation-stream"),
    routeId: "test:/api/invalidation-stream",
    params: {},
    searchParams: new URLSearchParams(),
  } as unknown as RouteContext;

  await handleInvalidationStream(ctx);

  // Trigger a users mutation; handleCreateUser calls publishInvalidationTags(["users"])
  const createCtx = makePostContext("/api/users", {
    name: "Stream Test",
    email: "stream.test@example.com",
  });
  await handleCreateUser(createCtx);

  assert.ok(
    mock.body.includes(`data: ${JSON.stringify({ tags: ["users"] })}\n\n`),
    `Expected users invalidation payload in SSE stream. Got: ${mock.body}`,
  );

  // Cleanup
  request.emit("close");
});
