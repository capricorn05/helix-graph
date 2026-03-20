import assert from "node:assert/strict";
import test from "node:test";
import { resetRuntimeGraph, runtimeGraph } from "../helix/graph.js";
import {
  batch,
  cell,
  createReactiveScope,
  derived,
  effect,
  onCleanup,
  peek,
  untracked,
} from "../helix/reactive.js";

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

test("dependency edges point from source to dependent", () => {
  resetRuntimeGraph();

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
  resetRuntimeGraph();

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
  resetRuntimeGraph();

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

test("derived dependency edges reconcile when conditional dependencies change", async () => {
  resetRuntimeGraph();

  const usePrimary = cell(true, { name: "use-primary" });
  const primary = cell("A", { name: "primary-value" });
  const fallback = cell("B", { name: "fallback-value" });

  const selected = derived(
    () => (usePrimary.get() ? primary.get() : fallback.get()),
    { name: "selected-value" },
  );

  assert.equal(selected.get(), "A");

  const initialDependencies = runtimeGraph
    .getDependencies(selected.id)
    .map((node) => node.id);
  assert.ok(initialDependencies.includes(usePrimary.id));
  assert.ok(initialDependencies.includes(primary.id));
  assert.ok(!initialDependencies.includes(fallback.id));

  usePrimary.set(false);
  await flushMicrotasks();

  assert.equal(selected.get(), "B");

  const switchedDependencies = runtimeGraph
    .getDependencies(selected.id)
    .map((node) => node.id);
  assert.ok(switchedDependencies.includes(usePrimary.id));
  assert.ok(switchedDependencies.includes(fallback.id));
  assert.ok(!switchedDependencies.includes(primary.id));

  const primaryDependents = runtimeGraph
    .getDependents(primary.id)
    .map((node) => node.id);
  assert.ok(!primaryDependents.includes(selected.id));
});

test("derived subscribers skip notifications when recompute is equal", async () => {
  resetRuntimeGraph();

  const count = cell(1, { name: "count" });
  const decile = derived(() => Math.floor(count.get() / 10), {
    name: "count-decile",
  });

  const values: number[] = [];
  const unsubscribe = decile.subscribe((value) => {
    values.push(value);
  });

  count.set(2);
  count.set(3);
  await flushMicrotasks();

  assert.deepEqual(values, [0]);

  count.set(11);
  await flushMicrotasks();

  assert.deepEqual(values, [0, 1]);
  unsubscribe();
});

test("batch defers reactive effect delivery until outer transaction exits", async () => {
  resetRuntimeGraph();

  const value = cell(0, { name: "batched-cell" });
  const observed: number[] = [];

  const unsubscribe = value.subscribe((next) => {
    observed.push(next);
  });

  batch(() => {
    value.set(1);
    value.set(2);
  });

  assert.deepEqual(observed, [0]);

  await flushMicrotasks();
  assert.deepEqual(observed, [0, 2]);

  unsubscribe();
});

test("reactive scope disposal tears down owned nodes and ownership edges", () => {
  resetRuntimeGraph();

  const scope = createReactiveScope({ name: "test-scope" });
  const value = cell(1, { name: "scope-value", owner: scope });
  const doubled = derived(() => value.get() * 2, {
    name: "scope-doubled",
    owner: scope,
  });

  assert.equal(doubled.get(), 2);
  const ownedBeforeDispose = runtimeGraph
    .getDependents(scope.id)
    .map((node) => node.id);
  assert.ok(ownedBeforeDispose.includes(value.id));
  assert.ok(ownedBeforeDispose.includes(doubled.id));

  scope.dispose();

  assert.equal(runtimeGraph.hasNode(scope.id), false);
  assert.equal(runtimeGraph.hasNode(value.id), false);
  assert.equal(runtimeGraph.hasNode(doubled.id), false);
  assert.throws(() => value.get(), /disposed cell/);
  assert.throws(() => doubled.get(), /disposed derived/);
});

test("untracked avoids creating dependencies for incidental reads", async () => {
  resetRuntimeGraph();

  const tracked = cell(0, { name: "tracked" });
  const incidental = cell(0, { name: "incidental" });

  const total = derived(
    () => tracked.get() + untracked(() => incidental.get()),
    { name: "tracked-plus-incidental" },
  );

  assert.equal(total.get(), 0);

  const dependencyIds = runtimeGraph
    .getDependencies(total.id)
    .map((node) => node.id);
  assert.ok(dependencyIds.includes(tracked.id));
  assert.ok(!dependencyIds.includes(incidental.id));

  incidental.set(10);
  await flushMicrotasks();
  assert.equal(total.get(), 0);

  tracked.set(1);
  await flushMicrotasks();
  assert.equal(total.get(), 11);
});

test("peek reads without subscribing the caller", async () => {
  resetRuntimeGraph();

  const source = cell(1, { name: "peek-source" });
  const doubled = derived(() => source.get() * 2, { name: "peek-doubled" });
  const outer = derived(() => peek(doubled) + 1, { name: "peek-outer" });

  assert.equal(outer.get(), 3);

  const dependencyIds = runtimeGraph
    .getDependencies(outer.id)
    .map((node) => node.id);
  assert.equal(dependencyIds.length, 0);

  source.set(5);
  await flushMicrotasks();
  assert.equal(outer.get(), 3);
});

test("effect runs immediately and re-runs on dependency updates", async () => {
  resetRuntimeGraph();

  const count = cell(1, { name: "effect-count" });
  const observed: number[] = [];

  const watcher = effect(() => {
    observed.push(count.get() * 2);
  }, { name: "double-watcher" });

  assert.equal(watcher.disposed, false);
  assert.deepEqual(observed, [2]);

  count.set(2);
  count.set(3);
  await flushMicrotasks();
  assert.deepEqual(observed, [2, 6]);

  const dependencyIds = runtimeGraph
    .getDependencies(watcher.id)
    .map((node) => node.id);
  assert.ok(dependencyIds.includes(count.id));

  watcher.dispose();
  assert.equal(watcher.disposed, true);
  assert.equal(runtimeGraph.hasNode(watcher.id), false);

  count.set(4);
  await flushMicrotasks();
  assert.deepEqual(observed, [2, 6]);
});

test("effect dependency edges reconcile when branches switch", async () => {
  resetRuntimeGraph();

  const usePrimary = cell(true, { name: "effect-use-primary" });
  const primary = cell("A", { name: "effect-primary" });
  const fallback = cell("B", { name: "effect-fallback" });
  const seen: string[] = [];

  const watcher = effect(() => {
    seen.push(usePrimary.get() ? primary.get() : fallback.get());
  }, { name: "branch-watcher" });

  const initialDependencies = runtimeGraph
    .getDependencies(watcher.id)
    .map((node) => node.id);
  assert.ok(initialDependencies.includes(usePrimary.id));
  assert.ok(initialDependencies.includes(primary.id));
  assert.ok(!initialDependencies.includes(fallback.id));

  usePrimary.set(false);
  await flushMicrotasks();

  const switchedDependencies = runtimeGraph
    .getDependencies(watcher.id)
    .map((node) => node.id);
  assert.ok(switchedDependencies.includes(usePrimary.id));
  assert.ok(switchedDependencies.includes(fallback.id));
  assert.ok(!switchedDependencies.includes(primary.id));

  const primaryDependents = runtimeGraph
    .getDependents(primary.id)
    .map((node) => node.id);
  assert.ok(!primaryDependents.includes(watcher.id));

  watcher.dispose();
  assert.deepEqual(seen, ["A", "B"]);
});

test("scope disposal disposes owned effects", async () => {
  resetRuntimeGraph();

  const scope = createReactiveScope({ name: "effect-scope" });
  const count = cell(1, { name: "scope-count" });
  const observed: number[] = [];

  const watcher = effect(() => {
    observed.push(count.get());
  }, { name: "scope-watcher", owner: scope });

  count.set(2);
  await flushMicrotasks();
  assert.deepEqual(observed, [1, 2]);

  scope.dispose();
  assert.equal(runtimeGraph.hasNode(watcher.id), false);

  count.set(3);
  await flushMicrotasks();
  assert.deepEqual(observed, [1, 2]);

  count.dispose();
  count.dispose();
});

test("effect returned cleanup is called before each re-run", async () => {
  resetRuntimeGraph();

  const count = cell(0, { name: "cleanup-count" });
  const cleanupCalls: number[] = [];

  const watcher = effect(() => {
    const snapshot = count.get();
    return () => {
      cleanupCalls.push(snapshot);
    };
  }, { name: "cleanup-watcher" });

  // initial run – no cleanup yet
  assert.deepEqual(cleanupCalls, []);

  count.set(1);
  await flushMicrotasks();
  // cleanup from first run (snapshot=0) fired before second run
  assert.deepEqual(cleanupCalls, [0]);

  count.set(2);
  await flushMicrotasks();
  // cleanup from second run (snapshot=1) fired before third run
  assert.deepEqual(cleanupCalls, [0, 1]);

  watcher.dispose();
  // cleanup from third run (snapshot=2) fired on dispose
  assert.deepEqual(cleanupCalls, [0, 1, 2]);

  count.dispose();
});

test("effect returned cleanup is called on dispose even with no re-run", async () => {
  resetRuntimeGraph();

  const count = cell(5, { name: "once-count" });
  let cleaned = false;

  const watcher = effect(() => {
    count.get();
    return () => { cleaned = true; };
  }, { name: "once-watcher" });

  assert.equal(cleaned, false);
  watcher.dispose();
  assert.equal(cleaned, true);

  count.dispose();
});

test("onCleanup() registers teardown within running effect", async () => {
  resetRuntimeGraph();

  const flag = cell(false, { name: "oc-flag" });
  const events: string[] = [];

  const watcher = effect(() => {
    const snapshot = String(flag.get());
    onCleanup(() => events.push("cleanup:" + snapshot));
    events.push("run:" + snapshot);
  }, { name: "oc-watcher" });

  assert.deepEqual(events, ["run:false"]);

  flag.set(true);
  await flushMicrotasks();
  assert.deepEqual(events, ["run:false", "cleanup:false", "run:true"]);

  watcher.dispose();
  assert.deepEqual(events, ["run:false", "cleanup:false", "run:true", "cleanup:true"]);

  flag.dispose();
});

test("multiple onCleanup() calls in one effect all run", async () => {
  resetRuntimeGraph();

  const x = cell(0, { name: "multi-oc-x" });
  const log: string[] = [];

  const watcher = effect(() => {
    x.get();
    onCleanup(() => log.push("a"));
    onCleanup(() => log.push("b"));
  }, { name: "multi-oc-watcher" });

  watcher.dispose();
  assert.deepEqual(log, ["a", "b"]);

  x.dispose();
});

test("onCleanup() outside an effect is a no-op", () => {
  // Should not throw
  onCleanup(() => { /* ignored */ });
});
