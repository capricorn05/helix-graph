import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { cell } from "../helix/reactive.js";
import {
  installRuntimeReactivePatchBindings,
  scheduleRuntimePatchBatch,
  scheduleRuntimeReactivePatches,
  type RuntimePatchScheduler,
  uninstallRuntimeReactivePatchBindings,
} from "../helix/client-reactivity.js";
import type { Lane, PatchOp } from "../helix/types.js";

interface CapturedBatch {
  trigger: string;
  lane: Lane;
  nodes: string[];
  patches: PatchOp[];
  run: (patches: PatchOp[]) => void;
}

interface TestRuntime extends RuntimePatchScheduler {
  captured: CapturedBatch[];
  applied: PatchOp[][];
}

class ManualSource<TValue> {
  private readonly subscribers = new Set<(value: TValue) => void>();

  subscribe(subscriber: (value: TValue) => void): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  emit(value: TValue): void {
    for (const subscriber of this.subscribers) {
      subscriber(value);
    }
  }
}

class ManualOwner {
  readonly id: string;
  private readonly cleanups = new Set<() => void>();

  constructor(id: string) {
    this.id = id;
  }

  onDispose(cleanup: () => void): () => void {
    this.cleanups.add(cleanup);
    return () => {
      this.cleanups.delete(cleanup);
    };
  }

  dispose(): void {
    const callbacks = Array.from(this.cleanups);
    this.cleanups.clear();
    for (const cleanup of callbacks) {
      cleanup();
    }
  }
}

function createTestRuntime(): TestRuntime {
  const captured: CapturedBatch[] = [];
  const applied: PatchOp[][] = [];

  return {
    captured,
    applied,
    scheduler: {
      schedule(batch) {
        captured.push(batch);
      },
    },
    patchRuntime: {
      applyBatch(batch) {
        applied.push(batch);
      },
    },
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

test("scheduleRuntimePatchBatch derives nodes when omitted", () => {
  const runtime = createTestRuntime();

  scheduleRuntimePatchBatch(runtime, {
    trigger: "derived-nodes",
    lane: "network",
    patches: [
      { op: "setText", targetId: "alpha", value: "A" },
      { op: "setAttr", targetId: "beta", name: "data-x", value: "1" },
      { op: "setText", targetId: "alpha", value: "B" },
    ],
  });

  assert.equal(runtime.captured.length, 1);
  assert.deepEqual(runtime.captured[0]?.nodes, ["alpha", "beta"]);

  runtime.captured[0]?.run(runtime.captured[0].patches);
  assert.equal(runtime.applied.length, 1);
  assert.equal(runtime.applied[0]?.length, 3);
});

test("scheduleRuntimeReactivePatches filters missing targets", () => {
  const dom = new JSDOM(
    "<!DOCTYPE html><body><div data-hx-id='present'></div></body>",
  );

  const runtime = createTestRuntime();

  scheduleRuntimeReactivePatches(runtime, {
    trigger: "filter-targets",
    patches: [
      { op: "setText", targetId: "present", value: "ok" },
      { op: "setText", targetId: "missing", value: "skip" },
    ],
    root: dom.window.document,
  });

  assert.equal(runtime.captured.length, 1);
  assert.equal(runtime.captured[0]?.patches.length, 1);
  assert.equal(runtime.captured[0]?.patches[0]?.targetId, "present");
});

test("scheduleRuntimeReactivePatches dedupes by latest target-op", () => {
  const dom = new JSDOM(
    "<!DOCTYPE html><body><div data-hx-id='present'></div></body>",
  );

  const runtime = createTestRuntime();

  scheduleRuntimeReactivePatches(runtime, {
    trigger: "dedupe-target-ops",
    patches: [
      { op: "setText", targetId: "present", value: "old" },
      { op: "setText", targetId: "present", value: "new" },
    ],
    root: dom.window.document,
  });

  assert.equal(runtime.captured.length, 1);
  assert.equal(runtime.captured[0]?.patches.length, 1);
  assert.equal(
    runtime.captured[0]?.patches[0] && "value" in runtime.captured[0].patches[0]
      ? runtime.captured[0].patches[0].value
      : null,
    "new",
  );
});

test("scheduleRuntimePatchBatch microtask-coalesces same trigger/lane", async () => {
  const runtime = createTestRuntime();

  scheduleRuntimePatchBatch(runtime, {
    trigger: "coalesced",
    lane: "input",
    flush: "microtask",
    dedupePatches: true,
    patches: [
      { op: "setText", targetId: "alpha", value: "A" },
      { op: "setText", targetId: "beta", value: "B" },
    ],
  });

  scheduleRuntimePatchBatch(runtime, {
    trigger: "coalesced",
    lane: "input",
    flush: "microtask",
    dedupePatches: true,
    patches: [{ op: "setText", targetId: "alpha", value: "A2" }],
  });

  assert.equal(runtime.captured.length, 0);
  await flushMicrotasks();

  assert.equal(runtime.captured.length, 1);
  const firstBatch = runtime.captured[0];
  assert.deepEqual(firstBatch?.nodes, ["alpha", "beta"]);
  assert.equal(firstBatch?.patches.length, 2);

  const alphaPatch = firstBatch?.patches.find(
    (patch) => patch.targetId === "alpha" && patch.op === "setText",
  );
  assert.equal(alphaPatch?.op, "setText");
  assert.equal(alphaPatch?.value, "A2");
});

test("installRuntimeReactivePatchBindings installs once per runtime key", async () => {
  const dom = new JSDOM(
    "<!DOCTYPE html><body><span data-hx-id='value-target'></span></body>",
  );

  const runtime = createTestRuntime();
  const source = cell(1, { clientOnly: true });

  installRuntimeReactivePatchBindings(
    runtime,
    "test-install-key",
    [
      {
        trigger: "source:value",
        source,
        patches: (value) => [
          { op: "setText", targetId: "value-target", value: String(value) },
        ],
      },
    ],
    { root: dom.window.document },
  );

  installRuntimeReactivePatchBindings(
    runtime,
    "test-install-key",
    [
      {
        trigger: "source:value",
        source,
        patches: (value) => [
          { op: "setText", targetId: "value-target", value: String(value) },
        ],
      },
    ],
    { root: dom.window.document },
  );

  assert.equal(runtime.captured.length, 1);
  assert.equal(runtime.captured[0]?.patches[0]?.targetId, "value-target");

  source.set(2);
  await flushMicrotasks();

  assert.equal(runtime.captured.length, 2);
  assert.equal(
    runtime.captured[1]?.patches[0] && "value" in runtime.captured[1].patches[0]
      ? runtime.captured[1].patches[0].value
      : null,
    "2",
  );
});

test("installRuntimeReactivePatchBindings supports distinct-until-changed", () => {
  const dom = new JSDOM(
    "<!DOCTYPE html><body><span data-hx-id='value-target'></span></body>",
  );

  const runtime = createTestRuntime();
  const source = new ManualSource<number>();

  installRuntimeReactivePatchBindings(
    runtime,
    "distinct-runtime-key",
    [
      {
        trigger: "distinct-source:value",
        source,
        distinct: true,
        patches: (value) => [
          { op: "setText", targetId: "value-target", value: String(value) },
        ],
      },
    ],
    { root: dom.window.document },
  );

  source.emit(1);
  source.emit(1);
  source.emit(2);

  assert.equal(runtime.captured.length, 2);
  assert.equal(
    runtime.captured[0]?.patches[0] && "value" in runtime.captured[0].patches[0]
      ? runtime.captured[0].patches[0].value
      : null,
    "1",
  );
  assert.equal(
    runtime.captured[1]?.patches[0] && "value" in runtime.captured[1].patches[0]
      ? runtime.captured[1].patches[0].value
      : null,
    "2",
  );
});

test("uninstallRuntimeReactivePatchBindings removes subscriptions", () => {
  const dom = new JSDOM(
    "<!DOCTYPE html><body><span data-hx-id='value-target'></span></body>",
  );

  const runtime = createTestRuntime();
  const source = new ManualSource<number>();

  installRuntimeReactivePatchBindings(
    runtime,
    "cleanup-runtime-key",
    [
      {
        trigger: "cleanup-source:value",
        source,
        patches: (value) => [
          { op: "setText", targetId: "value-target", value: String(value) },
        ],
      },
    ],
    { root: dom.window.document },
  );

  source.emit(1);
  assert.equal(runtime.captured.length, 1);
  assert.equal(
    uninstallRuntimeReactivePatchBindings(runtime, "cleanup-runtime-key"),
    true,
  );

  source.emit(2);
  assert.equal(runtime.captured.length, 1);
  assert.equal(
    uninstallRuntimeReactivePatchBindings(runtime, "cleanup-runtime-key"),
    false,
  );
});

test("owner disposal cleans installs and allows same-key re-install", () => {
  const dom = new JSDOM(
    "<!DOCTYPE html><body><span data-hx-id='value-target'></span></body>",
  );

  const runtime = createTestRuntime();
  const sourceA = new ManualSource<number>();
  const sourceB = new ManualSource<number>();

  const ownerA = new ManualOwner("view-owner-a");

  installRuntimeReactivePatchBindings(
    runtime,
    "owner-scoped-key",
    [
      {
        trigger: "owner-scoped:value",
        source: sourceA,
        patches: (value) => [
          { op: "setText", targetId: "value-target", value: String(value) },
        ],
      },
    ],
    {
      root: dom.window.document,
      owner: ownerA,
    },
  );

  sourceA.emit(1);
  assert.equal(runtime.captured.length, 1);

  ownerA.dispose();
  sourceA.emit(2);
  assert.equal(runtime.captured.length, 1);
  assert.equal(
    uninstallRuntimeReactivePatchBindings(runtime, "owner-scoped-key"),
    false,
  );

  const ownerB = new ManualOwner("view-owner-b");
  installRuntimeReactivePatchBindings(
    runtime,
    "owner-scoped-key",
    [
      {
        trigger: "owner-scoped:value",
        source: sourceB,
        patches: (value) => [
          { op: "setText", targetId: "value-target", value: String(value) },
        ],
      },
    ],
    {
      root: dom.window.document,
      owner: ownerB,
    },
  );

  sourceB.emit(3);
  assert.equal(runtime.captured.length, 2);
  assert.equal(
    runtime.captured[1]?.patches[0] && "value" in runtime.captured[1].patches[0]
      ? runtime.captured[1].patches[0].value
      : null,
    "3",
  );

  ownerB.dispose();
  sourceB.emit(4);
  assert.equal(runtime.captured.length, 2);
});

test("microtask patch flushes run in the shared reactive task turn", async () => {
  const dom = new JSDOM(
    "<!DOCTYPE html><body><span data-hx-id='value-target'></span></body>",
  );

  const runtime = createTestRuntime();
  const source = cell(0, { clientOnly: true });

  installRuntimeReactivePatchBindings(
    runtime,
    "shared-microtask-turn",
    [
      {
        trigger: "shared-microtask-turn:value",
        source,
        flush: "microtask",
        patches: (value) => [
          { op: "setText", targetId: "value-target", value: String(value) },
        ],
      },
    ],
    { root: dom.window.document },
  );

  await flushMicrotasks();
  await flushMicrotasks();
  runtime.captured.length = 0;

  source.set(1);
  await flushMicrotasks();

  assert.equal(runtime.captured.length, 1);
  assert.equal(
    runtime.captured[0]?.patches[0] && "value" in runtime.captured[0].patches[0]
      ? runtime.captured[0].patches[0].value
      : null,
    "1",
  );
});
