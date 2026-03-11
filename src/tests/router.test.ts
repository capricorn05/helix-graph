import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import { createRouter, defineRoute } from "../helix/router.js";

function request(method: string): IncomingMessage {
  return { method } as IncomingMessage;
}

function response(): ServerResponse {
  return {} as ServerResponse;
}

test("router matches static routes", async () => {
  let matched = false;

  const router = createRouter([
    defineRoute("GET", "/health", () => {
      matched = true;
    }),
  ]);

  const handled = await router.dispatch(
    request("GET"),
    response(),
    new URL("http://localhost/health"),
  );
  assert.equal(handled, true);
  assert.equal(matched, true);
});

test("router matches parameterized routes and extracts params", async () => {
  let capturedId: string | null = null;

  const router = createRouter([
    defineRoute("GET", "/users/:id", ({ params }) => {
      capturedId = params.id;
    }),
  ]);

  const handled = await router.dispatch(
    request("GET"),
    response(),
    new URL("http://localhost/users/42"),
  );
  assert.equal(handled, true);
  assert.equal(capturedId, "42");
});

test("router matches wildcard routes", async () => {
  let matched = false;

  const router = createRouter([
    defineRoute("GET", "/assets/*", () => {
      matched = true;
    }),
  ]);

  const handled = await router.dispatch(
    request("GET"),
    response(),
    new URL("http://localhost/assets/js/app.bundle.js"),
  );

  assert.equal(handled, true);
  assert.equal(matched, true);
});
