import assert from "node:assert/strict";
import test from "node:test";
import { invalidateResourcesByTags, resource } from "../helix/resource.js";
import {
  POSTS_PAGE_SIZE,
  postsResource,
  resetPostsStoreForTests,
} from "../example/resources/posts.resource.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withClientWindow<T>(run: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    value: {},
    configurable: true,
    writable: true,
  });

  try {
    return await run();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "window", descriptor);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  }
}

function mockGlobalValue<K extends keyof typeof globalThis>(
  key: K,
  value: (typeof globalThis)[K],
): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor);
    } else {
      delete (globalThis as Record<string, unknown>)[key as string];
    }
  };
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

test("resource with where=server rejects client runtime", async () => {
  const serverOnly = resource<number, { id: number }>(
    "users-test-server-only",
    ({ id }) => ["users-test-server-only", id],
    async () => 1,
    {
      where: "server",
      cache: "none",
      dedupe: "none",
    },
  );

  await withClientWindow(async () => {
    await assert.rejects(
      () => serverOnly.read({ id: 1 }),
      /Invalid resource placement/,
    );
  });
});

test("posts resource falls back to offline seeds when fetch fails", async () => {
  resetPostsStoreForTests();

  const restoreFetch = mockGlobalValue("fetch", (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch);
  const warnings: string[] = [];
  const restoreWarn = mockGlobalValue("console", {
    ...console,
    warn: (...args: unknown[]) => {
      warnings.push(args.map((value) => String(value)).join(" "));
    },
  } as typeof console);

  try {
    const page = await postsResource.read({
      page: 1,
      pageSize: POSTS_PAGE_SIZE,
    });

    assert.equal(page.page, 1);
    assert.equal(page.rows.length, POSTS_PAGE_SIZE);
    assert.equal(page.total, 100);
    assert.equal(page.totalPages, 10);
    assert.equal(page.rows[0]?.id, 1);
    assert.match(page.rows[0]?.title ?? "", /^Offline demo post 1:/);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? "", /Falling back to offline seed posts/);
  } finally {
    restoreWarn();
    restoreFetch();
    resetPostsStoreForTests();
  }
});
