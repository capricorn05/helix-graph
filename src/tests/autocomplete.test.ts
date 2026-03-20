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

test("autocomplete: idle when query is below minLength", async () => {
  resetRuntimeGraph();

  let fetchCount = 0;
  const ac = createAutocomplete({
    fetch: async () => { fetchCount++; return ["a", "b"]; },
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

  await tick(15); // wait for debounce + promise

  assert.equal(ac.status.get(), "ready");
  assert.deepEqual(ac.results.get(), ["foo-1", "foo-2"]);

  ac.destroy();
});

test("autocomplete: caches results and skips fetch on repeated query", async () => {
  resetRuntimeGraph();

  let fetchCount = 0;
  const ac = createAutocomplete({
    fetch: async (q) => { fetchCount++; return [`${q}-result`]; },
    debounceMs: 10,
  });

  ac.setQuery("bar");
  await tick(20);
  assert.equal(fetchCount, 1);
  assert.equal(ac.cacheSize(), 1);

  // Query same value again
  ac.setQuery("");
  await tick();
  ac.setQuery("bar");
  await tick(20);

  assert.equal(fetchCount, 1, "second identical query should use cache");
  assert.deepEqual(ac.results.get(), ["bar-result"]);

  ac.destroy();
});

test("autocomplete: cancels in-flight debounce on rapid query changes", async () => {
  resetRuntimeGraph();

  let fetchCount = 0;
  const ac = createAutocomplete({
    fetch: async (q) => { fetchCount++; return [`${q}`]; },
    debounceMs: 30,
  });

  ac.setQuery("a");
  await tick(5);
  ac.setQuery("ab");
  await tick(5);
  ac.setQuery("abc"); // only this one should actually fire
  await tick(40);

  assert.equal(fetchCount, 1, "only the last query should trigger a fetch");
  assert.deepEqual(ac.results.get(), ["abc"]);

  ac.destroy();
});

test("autocomplete: sets error status when fetch rejects", async () => {
  resetRuntimeGraph();

  const ac = createAutocomplete({
    fetch: async () => { throw new Error("network error"); },
    debounceMs: 10,
  });

  ac.setQuery("fail");
  await tick(20);

  assert.equal(ac.status.get(), "error");
  assert.deepEqual(ac.results.get(), []);

  ac.destroy();
});

test("autocomplete: clearCache removes cached entries", async () => {
  resetRuntimeGraph();

  let fetchCount = 0;
  const ac = createAutocomplete({
    fetch: async (q) => { fetchCount++; return [`${q}`]; },
    debounceMs: 10,
  });

  ac.setQuery("hello");
  await tick(20);
  assert.equal(ac.cacheSize(), 1);

  ac.clearCache();
  assert.equal(ac.cacheSize(), 0);

  // Next fetch should re-execute
  ac.setQuery("");
  await tick();
  ac.setQuery("hello");
  await tick(20);
  assert.equal(fetchCount, 2);

  ac.destroy();
});

test("autocomplete: evicts oldest cache entry when maxCacheSize exceeded", async () => {
  resetRuntimeGraph();

  const ac = createAutocomplete({
    fetch: async (q) => [`${q}`],
    debounceMs: 5,
    maxCacheSize: 2,
  });

  ac.setQuery("a");
  await tick(10);
  ac.setQuery("b");
  await tick(10);
  assert.equal(ac.cacheSize(), 2);

  ac.setQuery("c");
  await tick(10);
  // Cache should still be 2 (oldest "a" evicted)
  assert.equal(ac.cacheSize(), 2);

  ac.destroy();
});

test("autocomplete: destroy stops future fetches", async () => {
  resetRuntimeGraph();

  let fetchCount = 0;
  const ac = createAutocomplete({
    fetch: async (q) => { fetchCount++; return [`${q}`]; },
    debounceMs: 20,
  });

  ac.setQuery("pre");
  ac.destroy(); // destroy before debounce fires

  await tick(30);
  assert.equal(fetchCount, 0, "fetch should not fire after destroy");
});
