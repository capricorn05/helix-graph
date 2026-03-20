import assert from "node:assert/strict";
import test from "node:test";
import { resetRuntimeGraph } from "../helix/graph.js";
import { createAutocomplete } from "../helix/autocomplete.js";

/** Advance fake timers and flush microtasks. */
async function tick(ms: number = 0): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
  // Flush microtasks from promise chains
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}

async function waitFor(
  predicate: () => boolean,
  message: string,
  timeoutMs: number = 250,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(message);
    }

    await tick(5);
  }
}

test("autocomplete: idle when query is below minLength", async () => {
  resetRuntimeGraph();

  let fetchCount = 0;
  const ac = createAutocomplete({
    fetch: async () => {
      fetchCount++;
      return ["a", "b"];
    },
    debounceMs: 10,
    minLength: 2,
  });

  ac.setQuery("x");
  await tick(20);

  assert.equal(ac.status.get(), "idle");
  assert.deepEqual(ac.results.get(), []);
  assert.equal(fetchCount, 0, "fetch should not be called for short queries");

  ac.destroy();
});

test("autocomplete: fetches and returns results after debounce", async () => {
  resetRuntimeGraph();

  const ac = createAutocomplete({
    fetch: async (q) => [`${q}-1`, `${q}-2`],
    debounceMs: 10,
  });

  ac.setQuery("foo");
  // status goes loading while debouncing
  await tick(); // flush microtask for effect
  assert.equal(ac.status.get(), "loading");

  await waitFor(
    () => ac.status.get() === "ready",
    "expected autocomplete query 'foo' to resolve",
  );

  assert.equal(ac.status.get(), "ready");
  assert.deepEqual(ac.results.get(), ["foo-1", "foo-2"]);

  ac.destroy();
});

test("autocomplete: caches results and skips fetch on repeated query", async () => {
  resetRuntimeGraph();

  let fetchCount = 0;
  const ac = createAutocomplete({
    fetch: async (q) => {
      fetchCount++;
      return [`${q}-result`];
    },
    debounceMs: 10,
  });

  ac.setQuery("bar");
  await waitFor(
    () => fetchCount === 1 && ac.cacheSize() === 1,
    "expected first autocomplete query to populate the cache",
  );
  assert.equal(fetchCount, 1);
  assert.equal(ac.cacheSize(), 1);

  // Query same value again
  ac.setQuery("");
  await tick();
  ac.setQuery("bar");
  await waitFor(
    () => ac.status.get() === "ready",
    "expected cached autocomplete query to resolve immediately",
  );

  assert.equal(fetchCount, 1, "second identical query should use cache");
  assert.deepEqual(ac.results.get(), ["bar-result"]);

  ac.destroy();
});

test("autocomplete: cancels in-flight debounce on rapid query changes", async () => {
  resetRuntimeGraph();

  let fetchCount = 0;
  const ac = createAutocomplete({
    fetch: async (q) => {
      fetchCount++;
      return [`${q}`];
    },
    debounceMs: 30,
  });

  ac.setQuery("a");
  await tick(5);
  ac.setQuery("ab");
  await tick(5);
  ac.setQuery("abc"); // only this one should actually fire
  await waitFor(
    () => fetchCount === 1 && ac.status.get() === "ready",
    "expected only the last autocomplete query to fetch",
  );

  assert.equal(fetchCount, 1, "only the last query should trigger a fetch");
  assert.deepEqual(ac.results.get(), ["abc"]);

  ac.destroy();
});

test("autocomplete: sets error status when fetch rejects", async () => {
  resetRuntimeGraph();

  const ac = createAutocomplete({
    fetch: async () => {
      throw new Error("network error");
    },
    debounceMs: 10,
  });

  ac.setQuery("fail");
  await waitFor(
    () => ac.status.get() === "error",
    "expected autocomplete to enter error state after a rejected fetch",
  );

  assert.equal(ac.status.get(), "error");
  assert.deepEqual(ac.results.get(), []);

  ac.destroy();
});

test("autocomplete: clearCache removes cached entries", async () => {
  resetRuntimeGraph();

  let fetchCount = 0;
  const ac = createAutocomplete({
    fetch: async (q) => {
      fetchCount++;
      return [`${q}`];
    },
    debounceMs: 10,
  });

  ac.setQuery("hello");
  await waitFor(
    () => ac.cacheSize() === 1,
    "expected autocomplete cache to contain the first query",
  );
  assert.equal(ac.cacheSize(), 1);

  ac.clearCache();
  assert.equal(ac.cacheSize(), 0);

  // Next fetch should re-execute
  ac.setQuery("");
  await tick();
  ac.setQuery("hello");
  await waitFor(
    () => fetchCount === 2,
    "expected autocomplete to refetch after clearing the cache",
  );
  assert.equal(fetchCount, 2);

  ac.destroy();
});

test("autocomplete: evicts oldest cache entry when maxCacheSize exceeded", async () => {
  resetRuntimeGraph();

  let fetchCount = 0;
  const ac = createAutocomplete({
    fetch: async (q) => {
      fetchCount++;
      return [`${q}`];
    },
    debounceMs: 5,
    maxCacheSize: 2,
  });

  ac.setQuery("a");
  await waitFor(
    () => fetchCount === 1 && ac.cacheSize() === 1,
    "expected autocomplete cache to contain query 'a'",
  );

  ac.setQuery("b");
  await waitFor(
    () => fetchCount === 2 && ac.cacheSize() === 2,
    "expected autocomplete cache to contain queries 'a' and 'b'",
  );
  assert.equal(ac.cacheSize(), 2);

  ac.setQuery("c");
  await waitFor(
    () => fetchCount === 3 && ac.cacheSize() === 2,
    "expected autocomplete cache to stay capped after query 'c'",
  );
  assert.equal(ac.cacheSize(), 2);

  ac.setQuery("");
  await tick();
  ac.setQuery("a");
  await waitFor(
    () => fetchCount === 4 && ac.status.get() === "ready",
    "expected oldest cache entry to be evicted and refetched",
  );
  assert.equal(ac.cacheSize(), 2);

  ac.destroy();
});

test("autocomplete: destroy stops future fetches", async () => {
  resetRuntimeGraph();

  let fetchCount = 0;
  const ac = createAutocomplete({
    fetch: async (q) => {
      fetchCount++;
      return [`${q}`];
    },
    debounceMs: 20,
  });

  ac.setQuery("pre");
  ac.destroy(); // destroy before debounce fires

  await tick(30);
  assert.equal(fetchCount, 0, "fetch should not fire after destroy");
});
