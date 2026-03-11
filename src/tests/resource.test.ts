import assert from "node:assert/strict";
import test from "node:test";
import { invalidateResourcesByTags, resource } from "../helix/resource.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

test("resource uses inflight dedupe and cache hits", async () => {
  let fetchCalls = 0;
  const users = resource<number, { page: number }>(
    "users-test-dedupe",
    ({ page }) => ["users-test-dedupe", page],
    async ({ page }) => {
      fetchCalls += 1;
      await sleep(15);
      return page * 100 + fetchCalls;
    },
    {
      where: "any",
      cache: "memory",
      staleMs: 1_000,
      dedupe: "inflight",
      tags: ["users-test-dedupe"],
    },
  );

  const [a, b] = await Promise.all([
    users.read({ page: 1 }),
    users.read({ page: 1 }),
  ]);
  assert.equal(fetchCalls, 1);
  assert.equal(a, b);

  const cached = await users.read({ page: 1 });
  assert.equal(fetchCalls, 1);
  assert.equal(cached, a);
});

test("resource evicts stale entries and refetches", async () => {
  let fetchCalls = 0;
  const r = resource<number, { id: number }>(
    "users-test-stale",
    ({ id }) => ["users-test-stale", id],
    async () => {
      fetchCalls += 1;
      return fetchCalls;
    },
    {
      where: "any",
      cache: "memory",
      staleMs: 10,
      dedupe: "inflight",
      tags: ["users-test-stale"],
    },
  );

  assert.equal(await r.read({ id: 1 }), 1);
  await sleep(15);
  assert.equal(await r.read({ id: 1 }), 2);
  assert.equal(fetchCalls, 2);
});

test("resource invalidates cache by tags", async () => {
  let fetchCalls = 0;
  const tag = `users-test-tags-${Math.random().toString(16).slice(2)}`;
  const r = resource<number, { id: number }>(
    "users-test-tags",
    ({ id }) => ["users-test-tags", id],
    async () => {
      fetchCalls += 1;
      return fetchCalls;
    },
    {
      where: "any",
      cache: "memory",
      staleMs: 1_000,
      dedupe: "inflight",
      tags: [tag],
    },
  );

  assert.equal(await r.read({ id: 1 }), 1);
  invalidateResourcesByTags([tag]);
  assert.equal(await r.read({ id: 1 }), 2);
  assert.equal(fetchCalls, 2);
});

test("resource serves fresh cache while revalidating in background", async () => {
  let fetchCalls = 0;
  const r = resource<number, { id: number }>(
    "users-test-revalidate",
    ({ id }) => ["users-test-revalidate", id],
    async () => {
      fetchCalls += 1;
      await sleep(5);
      return fetchCalls;
    },
    {
      where: "any",
      cache: "memory",
      staleMs: 250,
      revalidateMs: 50,
      dedupe: "inflight",
      tags: ["users-test-revalidate"],
    },
  );

  assert.equal(await r.read({ id: 1 }), 1);
  await sleep(60);

  const servedFromCache = await r.read({ id: 1 });
  assert.equal(servedFromCache, 1);
  assert.equal(fetchCalls, 2);

  await sleep(10);
  assert.equal(await r.read({ id: 1 }), 2);
});
