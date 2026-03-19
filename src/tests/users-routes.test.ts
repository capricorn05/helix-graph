import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import {
  handleUserDetail,
  handleUserEdit,
} from "../example/handlers/users.handler.js";
import type { RouteContext } from "../helix/router.js";

interface MockHttpResponse {
  response: ServerResponse;
  body: string;
  headers: Map<string, string>;
  get statusCode(): number;
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

function createRouteContext(
  pathname: string,
  params: { id: string },
): RouteContext<{ id: string }> & { mockResponse: MockHttpResponse } {
  const request = { method: "GET" } as IncomingMessage;
  const mockResponse = createMockResponse();
  const url = new URL(`http://localhost${pathname}`);

  return {
    request,
    response: mockResponse.response,
    url,
    routeId: `test:${pathname}`,
    params,
    searchParams: url.searchParams,
    mockResponse,
  };
}

test("/users/:id returns compiled detail page HTML", async () => {
  const ctx = createRouteContext("/users/1", { id: "1" });

  await handleUserDetail(ctx);

  assert.equal(ctx.mockResponse.statusCode, 200);
  assert.match(
    ctx.mockResponse.headers.get("content-type") ?? "",
    /text\/html/,
  );
  assert.ok(ctx.mockResponse.body.includes("<h1>"));
  assert.ok(ctx.mockResponse.body.includes("Ava Kim"));
  assert.ok(ctx.mockResponse.body.includes('class="status-active"'));
  assert.ok(ctx.mockResponse.body.includes("ava.kim@example.com"));
});

test("/users/:id/edit returns compiled edit page HTML", async () => {
  const ctx = createRouteContext("/users/1/edit", { id: "1" });

  await handleUserEdit(ctx);

  assert.equal(ctx.mockResponse.statusCode, 200);
  assert.match(
    ctx.mockResponse.headers.get("content-type") ?? "",
    /text\/html/,
  );
  assert.ok(ctx.mockResponse.body.includes("<h2>Edit User</h2>"));
  assert.ok(ctx.mockResponse.body.includes('action="/api/users/1"'));
  assert.ok(ctx.mockResponse.body.includes('value="ava.kim@example.com"'));
  assert.ok(ctx.mockResponse.body.includes('option value="active" selected'));
  assert.ok(ctx.mockResponse.body.includes("Save Changes"));
});

test("/users/:id returns 400 for invalid ID", async () => {
  const ctx = createRouteContext("/users/not-a-number", { id: "not-a-number" });

  await handleUserDetail(ctx);

  assert.equal(ctx.mockResponse.statusCode, 400);
  assert.equal(ctx.mockResponse.body, "Invalid user ID");
});

test("/users/:id/edit returns 400 for invalid ID", async () => {
  const ctx = createRouteContext("/users/not-a-number/edit", {
    id: "not-a-number",
  });

  await handleUserEdit(ctx);

  assert.equal(ctx.mockResponse.statusCode, 400);
  assert.equal(ctx.mockResponse.body, "Invalid user ID");
});

test("/users/:id returns 404 for missing user", async () => {
  const ctx = createRouteContext("/users/999999", { id: "999999" });

  await handleUserDetail(ctx);

  assert.equal(ctx.mockResponse.statusCode, 404);
  assert.match(
    ctx.mockResponse.headers.get("content-type") ?? "",
    /text\/html/,
  );
  assert.ok(ctx.mockResponse.body.includes("User not found"));
});

test("/users/:id/edit returns 404 for missing user", async () => {
  const ctx = createRouteContext("/users/999999/edit", { id: "999999" });

  await handleUserEdit(ctx);

  assert.equal(ctx.mockResponse.statusCode, 404);
  assert.match(
    ctx.mockResponse.headers.get("content-type") ?? "",
    /text\/html/,
  );
  assert.ok(ctx.mockResponse.body.includes("User not found"));
});
