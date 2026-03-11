import assert from "node:assert/strict";
import test from "node:test";
import { action } from "../helix/action.js";
import { runtimeGraph } from "../helix/graph.js";
import { resource } from "../helix/resource.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

test("action idempotency deduplicates concurrent inflight runs", async () => {
  let handlerCalls = 0;

  const createUser = action<{ email: string }, { ok: true }>(
    "create-user-idempotency-test",
    async () => {
      handlerCalls += 1;
      await sleep(20);
      return { ok: true };
    },
    {
      where: "any",
      idempotency: "create-user",
    },
  );

  const [a, b] = await Promise.all([
    createUser.run({ email: "a@example.com" }, {}),
    createUser.run({ email: "a@example.com" }, {}),
  ]);

  assert.deepEqual(a, { ok: true });
  assert.deepEqual(b, { ok: true });
  assert.equal(handlerCalls, 1);
});

test("action invalidation is wired through graph resource edges", async () => {
  const tag = `users-action-tag-${Math.random().toString(16).slice(2)}`;
  let fetchCalls = 0;

  const users = resource<number, { page: number }>(
    "users-action-resource",
    ({ page }) => ["users-action-resource", page],
    async () => {
      fetchCalls += 1;
      return fetchCalls;
    },
    {
      where: "any",
      cache: "memory",
      staleMs: 10_000,
      dedupe: "inflight",
      tags: [tag],
    },
  );

  const mutateUsers = action<{ id: number }, { ok: true }>(
    "users-action-invalidates-test",
    async () => ({ ok: true }),
    {
      where: "any",
      invalidates: [tag],
    },
  );

  assert.equal(await users.read({ page: 1 }), 1);
  assert.equal(fetchCalls, 1);

  await mutateUsers.run({ id: 1 }, {});

  const actionDependents = runtimeGraph
    .getDependents(mutateUsers.id)
    .map((node) => node.id);

  assert.ok(actionDependents.includes(users.id));

  assert.equal(await users.read({ page: 1 }), 2);
  assert.equal(fetchCalls, 2);
});
