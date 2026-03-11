import assert from "node:assert/strict";
import test from "node:test";
import { runtimeGraph } from "../helix/graph.js";
import { cell, derived } from "../helix/reactive.js";

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

test("dependency edges point from source to dependent", () => {
  const count = cell(1, { name: "count" });
  const doubled = derived(() => count.get() * 2, { name: "doubled" });

  assert.equal(doubled.get(), 2);

  const dependentIds = runtimeGraph
    .getDependents(count.id)
    .map((node) => node.id);
  const dependencyIds = runtimeGraph
    .getDependencies(doubled.id)
    .map((node) => node.id);

  assert.ok(dependentIds.includes(doubled.id));
  assert.ok(dependencyIds.includes(count.id));
});

test("derived values are marked dirty and recompute lazily once", async () => {
  const count = cell(1);
  let computeCalls = 0;

  const doubled = derived(() => {
    computeCalls += 1;
    return count.get() * 2;
  });

  assert.equal(doubled.get(), 2);
  assert.equal(computeCalls, 1);

  count.set(2);
  count.set(3);
  count.set(4);
  await flushMicrotasks();

  assert.equal(computeCalls, 1);
  assert.equal(doubled.get(), 8);
  assert.equal(computeCalls, 2);
});

test("derived subscribers receive one update for batched writes", async () => {
  const count = cell(1);
  const doubled = derived(() => count.get() * 2);
  const values: number[] = [];

  const unsubscribe = doubled.subscribe((value) => {
    values.push(value);
  });

  count.set(2);
  count.set(3);
  count.set(4);
  await flushMicrotasks();

  assert.deepEqual(values, [2, 8]);
  unsubscribe();
});
