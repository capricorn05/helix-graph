import type { Lane, PatchOp, ReactiveOwner } from "./types.js";
import { scheduleReactiveTask } from "./reactive.js";

interface SchedulerBatch {
  trigger: string;
  lane: Lane;
  nodes: string[];
  patches: PatchOp[];
  run: (patches: PatchOp[]) => void;
}

export type RuntimePatchFlushMode = "sync" | "microtask" | "animation-frame";

export interface RuntimePatchScheduler {
  scheduler: {
    schedule(batch: SchedulerBatch): void;
  };
  patchRuntime: {
    applyBatch(batch: PatchOp[]): void;
  };
}

export interface ReactivePatchSource<TValue> {
  subscribe(subscriber: (value: TValue) => void): () => void;
}

type DistinctComparator<TValue> = (next: TValue, previous: TValue) => boolean;

export interface RuntimeReactivePatchBinding<TRuntime, TValue> {
  trigger: string;
  source: ReactivePatchSource<TValue>;
  patches: (value: TValue, runtime: TRuntime) => PatchOp[];
  lane?: Lane;
  flush?: RuntimePatchFlushMode;
  distinct?: boolean | DistinctComparator<TValue>;
  dedupePatches?: boolean;
}

export interface RuntimeReactiveInstallOptions {
  root?: ParentNode;
  flush?: RuntimePatchFlushMode;
  dedupePatches?: boolean;
  owner?: ReactiveOwner;
}

interface RuntimeInstallRecord {
  cleanup: () => void;
}

interface QueuedRuntimeBatch {
  trigger: string;
  lane: Lane;
  patches: PatchOp[];
  nodes: Set<string>;
  dedupePatches: boolean;
  flush: RuntimePatchFlushMode;
}

const runtimeInstallRegistry = new WeakMap<
  object,
  Map<string, RuntimeInstallRecord>
>();
const runtimeBatchQueue = new WeakMap<
  object,
  Map<string, QueuedRuntimeBatch>
>();
const runtimeScheduledFlushes = new WeakMap<
  object,
  Set<RuntimePatchFlushMode>
>();

function hasPatchTarget(root: ParentNode, targetId: string): boolean {
  return root.querySelector(`[data-hx-id="${targetId}"]`) !== null;
}

function getPatchNodes(patches: PatchOp[]): string[] {
  return Array.from(new Set(patches.map((patch) => patch.targetId)));
}

function patchDedupeKey(patch: PatchOp): string {
  switch (patch.op) {
    case "setText":
      return `${patch.op}:${patch.targetId}`;
    case "setAttr":
      return `${patch.op}:${patch.targetId}:${patch.name}`;
    case "toggleClass":
      return `${patch.op}:${patch.targetId}:${patch.className}`;
    case "setValue":
      return `${patch.op}:${patch.targetId}`;
    case "setChecked":
      return `${patch.op}:${patch.targetId}`;
    case "setStyle":
      return `${patch.op}:${patch.targetId}:${patch.prop}`;
    default: {
      const exhaustive: never = patch;
      throw new Error(`Unhandled patch variant: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function dedupePatchOps(patches: PatchOp[]): PatchOp[] {
  if (patches.length < 2) {
    return patches;
  }

  const seen = new Set<string>();
  const deduped: PatchOp[] = [];

  for (let index = patches.length - 1; index >= 0; index -= 1) {
    const patch = patches[index];
    if (!patch) {
      continue;
    }

    const key = patchDedupeKey(patch);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(patch);
  }

  deduped.reverse();
  return deduped;
}

function patchOpsEqual(left: PatchOp[], right: PatchOp[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftPatch = left[index];
    const rightPatch = right[index];

    if (!leftPatch || !rightPatch) {
      return false;
    }

    if (
      leftPatch.op !== rightPatch.op ||
      leftPatch.targetId !== rightPatch.targetId
    ) {
      return false;
    }

    switch (leftPatch.op) {
      case "setText":
        if (
          rightPatch.op !== "setText" ||
          leftPatch.value !== rightPatch.value
        ) {
          return false;
        }
        break;
      case "setValue":
        if (
          rightPatch.op !== "setValue" ||
          leftPatch.value !== rightPatch.value
        ) {
          return false;
        }
        break;
      case "setChecked":
        if (
          rightPatch.op !== "setChecked" ||
          leftPatch.value !== rightPatch.value
        ) {
          return false;
        }
        break;
      case "setAttr":
        if (
          rightPatch.op !== "setAttr" ||
          leftPatch.name !== rightPatch.name ||
          leftPatch.value !== rightPatch.value
        ) {
          return false;
        }
        break;
      case "toggleClass":
        if (
          rightPatch.op !== "toggleClass" ||
          leftPatch.className !== rightPatch.className ||
          leftPatch.enabled !== rightPatch.enabled
        ) {
          return false;
        }
        break;
      case "setStyle":
        if (
          rightPatch.op !== "setStyle" ||
          leftPatch.prop !== rightPatch.prop ||
          leftPatch.value !== rightPatch.value
        ) {
          return false;
        }
        break;
      default: {
        const exhaustive: never = leftPatch;
        throw new Error(
          `Unhandled patch variant: ${JSON.stringify(exhaustive)}`,
        );
      }
    }
  }

  return true;
}

function getRuntimeInstallMap(
  runtime: object,
): Map<string, RuntimeInstallRecord> {
  const current = runtimeInstallRegistry.get(runtime);
  if (current) {
    return current;
  }

  const created = new Map<string, RuntimeInstallRecord>();
  runtimeInstallRegistry.set(runtime, created);
  return created;
}

function getRuntimeBatchMap(runtime: object): Map<string, QueuedRuntimeBatch> {
  const current = runtimeBatchQueue.get(runtime);
  if (current) {
    return current;
  }

  const created = new Map<string, QueuedRuntimeBatch>();
  runtimeBatchQueue.set(runtime, created);
  return created;
}

function getRuntimeScheduledFlushes(
  runtime: object,
): Set<RuntimePatchFlushMode> {
  const current = runtimeScheduledFlushes.get(runtime);
  if (current) {
    return current;
  }

  const created = new Set<RuntimePatchFlushMode>();
  runtimeScheduledFlushes.set(runtime, created);
  return created;
}

function cleanupRuntimeQueuesIfEmpty(runtime: object): void {
  const queue = runtimeBatchQueue.get(runtime);
  if (queue && queue.size === 0) {
    runtimeBatchQueue.delete(runtime);
  }

  const scheduled = runtimeScheduledFlushes.get(runtime);
  if (scheduled && scheduled.size === 0) {
    runtimeScheduledFlushes.delete(runtime);
  }
}

function runtimeBatchQueueKey(
  trigger: string,
  lane: Lane,
  flush: RuntimePatchFlushMode,
): string {
  return `${flush}:${lane}:${trigger}`;
}

function flushQueuedRuntimeBatches<
  TRuntime extends object & RuntimePatchScheduler,
>(runtime: TRuntime, flush: RuntimePatchFlushMode): void {
  const queue = runtimeBatchQueue.get(runtime);
  const scheduled = runtimeScheduledFlushes.get(runtime);
  scheduled?.delete(flush);

  if (!queue || queue.size === 0) {
    cleanupRuntimeQueuesIfEmpty(runtime);
    return;
  }

  const pending: QueuedRuntimeBatch[] = [];

  for (const [key, batch] of queue) {
    if (batch.flush !== flush) {
      continue;
    }

    queue.delete(key);
    pending.push(batch);
  }

  for (const batch of pending) {
    const patches = batch.dedupePatches
      ? dedupePatchOps(batch.patches)
      : batch.patches;
    if (patches.length === 0) {
      continue;
    }

    const nodes =
      batch.nodes.size > 0 ? Array.from(batch.nodes) : getPatchNodes(patches);

    runtime.scheduler.schedule({
      trigger: batch.trigger,
      lane: batch.lane,
      patches,
      nodes,
      run: (patchesToApply) => runtime.patchRuntime.applyBatch(patchesToApply),
    });
  }

  cleanupRuntimeQueuesIfEmpty(runtime);
}

function scheduleQueuedRuntimeFlush<
  TRuntime extends object & RuntimePatchScheduler,
>(runtime: TRuntime, flush: RuntimePatchFlushMode): void {
  if (flush === "microtask") {
    scheduleReactiveTask(() => flushQueuedRuntimeBatches(runtime, flush));
    return;
  }

  const host = globalThis as typeof globalThis & {
    requestAnimationFrame?: (callback: () => void) => number;
  };

  if (typeof host.requestAnimationFrame === "function") {
    host.requestAnimationFrame(() => flushQueuedRuntimeBatches(runtime, flush));
    return;
  }

  setTimeout(() => flushQueuedRuntimeBatches(runtime, flush), 16);
}

function enqueueRuntimePatchBatch<
  TRuntime extends object & RuntimePatchScheduler,
>(
  runtime: TRuntime,
  options: {
    trigger: string;
    lane: Lane;
    patches: PatchOp[];
    nodes: string[];
    flush: RuntimePatchFlushMode;
    dedupePatches: boolean;
  },
): void {
  const queue = getRuntimeBatchMap(runtime);
  const queueKey = runtimeBatchQueueKey(
    options.trigger,
    options.lane,
    options.flush,
  );

  const existing = queue.get(queueKey);
  if (existing) {
    existing.patches.push(...options.patches);
    for (const node of options.nodes) {
      existing.nodes.add(node);
    }
    existing.dedupePatches = existing.dedupePatches || options.dedupePatches;
  } else {
    queue.set(queueKey, {
      trigger: options.trigger,
      lane: options.lane,
      patches: [...options.patches],
      nodes: new Set(options.nodes),
      dedupePatches: options.dedupePatches,
      flush: options.flush,
    });
  }

  const scheduled = getRuntimeScheduledFlushes(runtime);
  if (scheduled.has(options.flush)) {
    return;
  }

  scheduled.add(options.flush);
  scheduleQueuedRuntimeFlush(runtime, options.flush);
}

function shouldSkipDistinctValue<TValue>(
  distinctOption: RuntimeReactivePatchBinding<
    object & RuntimePatchScheduler,
    TValue
  >["distinct"],
  nextValue: TValue,
  previousValue: TValue | undefined,
  hasPreviousValue: boolean,
): boolean {
  const distinct = distinctOption ?? true;
  if (!hasPreviousValue || distinct === false) {
    return false;
  }

  if (typeof distinct === "function") {
    return distinct(nextValue, previousValue as TValue);
  }

  return Object.is(nextValue, previousValue);
}

export function scheduleRuntimePatchBatch<
  TRuntime extends object & RuntimePatchScheduler,
>(
  runtime: TRuntime,
  options: {
    trigger: string;
    lane: Lane;
    patches: PatchOp[];
    nodes?: readonly string[];
    flush?: RuntimePatchFlushMode;
    dedupePatches?: boolean;
  },
): void {
  if (options.patches.length === 0) {
    return;
  }

  const flush = options.flush ?? "sync";
  const dedupePatchesEnabled = options.dedupePatches ?? false;
  const nodes = options.nodes
    ? Array.from(options.nodes)
    : getPatchNodes(options.patches);

  if (flush !== "sync") {
    enqueueRuntimePatchBatch(runtime, {
      trigger: options.trigger,
      lane: options.lane,
      patches: options.patches,
      nodes,
      flush,
      dedupePatches: dedupePatchesEnabled,
    });
    return;
  }

  const patches = dedupePatchesEnabled
    ? dedupePatchOps(options.patches)
    : options.patches;
  if (patches.length === 0) {
    return;
  }

  const resolvedNodes = options.nodes ? nodes : getPatchNodes(patches);

  runtime.scheduler.schedule({
    trigger: options.trigger,
    lane: options.lane,
    patches,
    nodes: resolvedNodes,
    run: (batch) => runtime.patchRuntime.applyBatch(batch),
  });
}

export function scheduleRuntimeReactivePatches<
  TRuntime extends RuntimePatchScheduler,
>(
  runtime: TRuntime,
  options: {
    trigger: string;
    patches: PatchOp[];
    lane?: Lane;
    root?: ParentNode;
    flush?: RuntimePatchFlushMode;
    dedupePatches?: boolean;
  },
): void {
  const root = options.root ?? document;
  const presentPatches = options.patches.filter((patch) =>
    hasPatchTarget(root, patch.targetId),
  );

  if (presentPatches.length === 0) {
    return;
  }

  scheduleRuntimePatchBatch(runtime, {
    trigger: options.trigger,
    lane: options.lane ?? "input",
    patches: presentPatches,
    flush: options.flush ?? "sync",
    dedupePatches: options.dedupePatches ?? true,
  });
}

export function installRuntimeReactivePatchBindings<
  TRuntime extends object & RuntimePatchScheduler,
>(
  runtime: TRuntime,
  installKey: string,
  bindings: readonly RuntimeReactivePatchBinding<TRuntime, any>[],
  options?: RuntimeReactiveInstallOptions,
): () => void {
  const installMap = getRuntimeInstallMap(runtime);
  const existing = installMap.get(installKey);
  if (existing) {
    return existing.cleanup;
  }

  const unsubscribers: Array<() => void> = [];
  let disposed = false;
  let removeOwnerCleanup: (() => void) | null = null;

  for (const binding of bindings) {
    let hasPreviousValue = false;
    let previousValue: unknown;
    let previousPatches: PatchOp[] = [];

    const unsubscribe = binding.source.subscribe((value) => {
      if (disposed) {
        return;
      }

      if (
        shouldSkipDistinctValue(
          binding.distinct,
          value,
          previousValue,
          hasPreviousValue,
        )
      ) {
        previousValue = value;
        hasPreviousValue = true;
        return;
      }

      const patches = binding.patches(value, runtime);
      const dedupePatches =
        binding.dedupePatches ?? options?.dedupePatches ?? true;

      if (dedupePatches && patchOpsEqual(previousPatches, patches)) {
        previousValue = value;
        hasPreviousValue = true;
        return;
      }

      previousValue = value;
      hasPreviousValue = true;
      previousPatches = patches;

      scheduleRuntimeReactivePatches(runtime, {
        trigger: binding.trigger,
        lane: binding.lane,
        patches,
        root: options?.root,
        flush: binding.flush ?? options?.flush,
        dedupePatches,
      });
    });

    unsubscribers.push(unsubscribe);
  }

  const cleanup = () => {
    if (disposed) {
      return;
    }

    disposed = true;

    if (removeOwnerCleanup) {
      const cleanupOwner = removeOwnerCleanup;
      removeOwnerCleanup = null;
      cleanupOwner();
    }

    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }

    const currentInstallMap = runtimeInstallRegistry.get(runtime);
    const currentRecord = currentInstallMap?.get(installKey);
    if (currentRecord?.cleanup === cleanup) {
      currentInstallMap?.delete(installKey);
      if (currentInstallMap && currentInstallMap.size === 0) {
        runtimeInstallRegistry.delete(runtime);
      }
    }
  };

  if (options?.owner) {
    const detachOwnerCleanup = options.owner.onDispose(cleanup);
    removeOwnerCleanup = () => {
      detachOwnerCleanup();
    };
  }

  installMap.set(installKey, { cleanup });
  return cleanup;
}

export function uninstallRuntimeReactivePatchBindings(
  runtime: object,
  installKey: string,
): boolean {
  const installMap = runtimeInstallRegistry.get(runtime);
  const record = installMap?.get(installKey);
  if (!record) {
    return false;
  }

  record.cleanup();
  return true;
}
