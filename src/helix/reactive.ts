import { nextEdgeId, nextNodeId, runtimeGraph } from "./graph.js";
import type {
  CellOptions,
  DerivedOptions,
  ReactiveOwner,
  Scope,
} from "./types.js";

type Subscriber<T> = (value: T) => void;

interface DependencySource {
  id: string;
  subscribeDependency: (notify: () => void) => () => void;
}

interface Tracker {
  registerDependency: (source: DependencySource) => void;
}

interface OwnedDependencySubscription {
  unsubscribe: () => void;
  edgeId: string;
}

let activeTracker: Tracker | null = null;
/** Set during effect execution so module-level onCleanup() can register teardowns. */
let currentCleanupRegistrar: ((fn: () => void) => void) | null = null;

const pendingEffects = new Set<() => void>();
let effectsFlushScheduled = false;
let batchDepth = 0;

function flushPendingEffects(): void {
  if (batchDepth > 0) {
    return;
  }

  effectsFlushScheduled = false;
  while (pendingEffects.size > 0) {
    const current = Array.from(pendingEffects);
    pendingEffects.clear();
    for (const run of current) {
      run();
    }
  }
}

function queueEffect(run: () => void): void {
  pendingEffects.add(run);
  if (effectsFlushScheduled) {
    return;
  }

  effectsFlushScheduled = true;
  if (batchDepth === 0) {
    queueMicrotask(flushPendingEffects);
  }
}

function flushEffectsAfterBatchIfNeeded(): void {
  if (batchDepth > 0 || pendingEffects.size === 0) {
    return;
  }

  if (!effectsFlushScheduled) {
    effectsFlushScheduled = true;
  }

  queueMicrotask(flushPendingEffects);
}

function bindOwner(
  owner: ReactiveOwner | undefined,
  nodeId: string,
  dispose: () => void,
): (() => void) | null {
  if (!owner) {
    return null;
  }

  const ownershipEdgeId = nextEdgeId("owns");
  runtimeGraph.addEdge({
    id: ownershipEdgeId,
    from: owner.id,
    to: nodeId,
    type: "owns",
  });

  let detached = false;
  const removeOwnerCleanup = owner.onDispose(() => {
    if (detached) {
      return;
    }
    dispose();
  });

  return () => {
    if (detached) {
      return;
    }

    detached = true;
    runtimeGraph.removeEdge(ownershipEdgeId);
    removeOwnerCleanup();
  };
}

function assertActive(
  disposed: boolean,
  kind: "cell" | "derived" | "effect",
  id: string,
  action: string,
): void {
  if (disposed) {
    throw new Error(`Cannot ${action} disposed ${kind} ${id}`);
  }
}

export function scheduleReactiveTask(run: () => void): void {
  queueEffect(run);
}

export function untracked<T>(read: () => T): T {
  const previous = activeTracker;
  activeTracker = null;

  try {
    return read();
  } finally {
    activeTracker = previous;
  }
}

export interface ReadableReactiveValue<T> {
  get(): T;
}

export function peek<T>(source: ReadableReactiveValue<T>): T {
  return untracked(() => source.get());
}

export function batch<T>(run: () => T): T {
  batchDepth += 1;
  try {
    return run();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0) {
      flushEffectsAfterBatchIfNeeded();
    }
  }
}

export interface ReactiveScope extends ReactiveOwner {
  readonly disposed: boolean;
  dispose(): void;
}

class ReactiveScopeImpl implements ReactiveScope {
  readonly id: string;
  private readonly cleanups = new Set<() => void>();
  private disposedState = false;

  constructor(options?: { name?: string; scope?: Scope }) {
    this.id = nextNodeId("scope");

    runtimeGraph.addNode({
      id: this.id,
      type: "EffectNode",
      label: options?.name ?? this.id,
      meta: {
        kind: "reactive-scope",
        scope: options?.scope ?? "view",
      },
    });
  }

  get disposed(): boolean {
    return this.disposedState;
  }

  onDispose(cleanup: () => void): () => void {
    if (this.disposedState) {
      cleanup();
      return () => undefined;
    }

    this.cleanups.add(cleanup);
    return () => {
      this.cleanups.delete(cleanup);
    };
  }

  dispose(): void {
    if (this.disposedState) {
      return;
    }

    this.disposedState = true;
    const callbacks = Array.from(this.cleanups);
    this.cleanups.clear();

    for (const cleanup of callbacks) {
      cleanup();
    }

    runtimeGraph.removeNode(this.id);
  }
}

export function createReactiveScope(options?: {
  name?: string;
  scope?: Scope;
}): ReactiveScope {
  return new ReactiveScopeImpl(options);
}

export interface Cell<T> extends DependencySource {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  update(updater: (prev: T) => T): void;
  subscribe(subscriber: Subscriber<T>): () => void;
  dispose(): void;
  readonly disposed: boolean;
  readonly name?: string;
}

export interface Derived<T> extends DependencySource {
  get(): T;
  subscribe(subscriber: Subscriber<T>): () => void;
  dispose(): void;
  readonly disposed: boolean;
  readonly name?: string;
}

export interface Effect {
  readonly id: string;
  readonly name?: string;
  readonly disposed: boolean;
  dispose(): void;
}

export interface EffectOptions {
  scope?: Scope;
  name?: string;
  owner?: ReactiveOwner;
}

class CellImpl<T> implements Cell<T> {
  readonly id: string;
  readonly name?: string;
  private value: T;
  private readonly subscribers = new Set<Subscriber<T>>();
  private readonly dependencySubscribers = new Set<() => void>();
  private subscriberFlushQueued = false;
  private dependencyFlushQueued = false;
  private disposedState = false;
  private ownerCleanup: (() => void) | null = null;

  constructor(initial: T, options?: CellOptions) {
    this.id = nextNodeId("cell");
    this.name = options?.name;
    this.value = initial;

    runtimeGraph.addNode({
      id: this.id,
      type: "CellNode",
      label: options?.name ?? this.id,
      meta: {
        scope: options?.scope ?? "view",
        serializable: options?.serializable ?? true,
        secure: options?.secure ?? false,
        clientOnly: options?.clientOnly ?? false,
      },
    });

    this.ownerCleanup = bindOwner(options?.owner, this.id, () =>
      this.dispose(),
    );
  }

  get disposed(): boolean {
    return this.disposedState;
  }

  get(): T {
    assertActive(this.disposedState, "cell", this.id, "read from");

    if (activeTracker) {
      activeTracker.registerDependency(this);
    }
    return this.value;
  }

  set(next: T | ((prev: T) => T)): void {
    assertActive(this.disposedState, "cell", this.id, "write to");

    const nextValue =
      typeof next === "function" ? (next as (prev: T) => T)(this.value) : next;
    if (Object.is(nextValue, this.value)) {
      return;
    }

    this.value = nextValue;

    if (!this.subscriberFlushQueued) {
      this.subscriberFlushQueued = true;
      queueEffect(() => {
        this.subscriberFlushQueued = false;
        if (this.disposedState) {
          return;
        }

        const latestValue = this.value;
        for (const subscriber of this.subscribers) {
          subscriber(latestValue);
        }
      });
    }

    if (!this.dependencyFlushQueued) {
      this.dependencyFlushQueued = true;
      queueEffect(() => {
        this.dependencyFlushQueued = false;
        if (this.disposedState) {
          return;
        }

        for (const notify of this.dependencySubscribers) {
          notify();
        }
      });
    }
  }

  update(updater: (prev: T) => T): void {
    assertActive(this.disposedState, "cell", this.id, "update");
    this.set(updater);
  }

  subscribe(subscriber: Subscriber<T>): () => void {
    assertActive(this.disposedState, "cell", this.id, "subscribe to");

    this.subscribers.add(subscriber);
    subscriber(this.value);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  subscribeDependency(notify: () => void): () => void {
    assertActive(
      this.disposedState,
      "cell",
      this.id,
      "subscribe to dependency of",
    );

    this.dependencySubscribers.add(notify);
    return () => {
      this.dependencySubscribers.delete(notify);
    };
  }

  dispose(): void {
    if (this.disposedState) {
      return;
    }

    this.disposedState = true;
    this.subscribers.clear();
    this.dependencySubscribers.clear();

    if (this.ownerCleanup) {
      const cleanup = this.ownerCleanup;
      this.ownerCleanup = null;
      cleanup();
    }

    runtimeGraph.removeNode(this.id);
  }
}

class DerivedImpl<T> implements Derived<T>, Tracker {
  readonly id: string;
  readonly name?: string;
  private readonly compute: () => T;
  private readonly equals: (next: T, previous: T) => boolean;
  private readonly subscribers = new Set<Subscriber<T>>();
  private readonly dependencySubscribers = new Set<() => void>();
  private readonly dependencies = new Map<
    string,
    OwnedDependencySubscription
  >();
  private dirty = true;
  private hasValue = false;
  private value!: T;
  private disposedState = false;
  private ownerCleanup: (() => void) | null = null;

  constructor(compute: () => T, options?: DerivedOptions<T>) {
    this.id = nextNodeId("derived");
    this.name = options?.name;
    this.compute = compute;
    this.equals = options?.equals ?? Object.is;

    runtimeGraph.addNode({
      id: this.id,
      type: "DerivedNode",
      label: options?.name ?? this.id,
      meta: {
        scope: options?.scope ?? "view",
      },
    });

    this.ownerCleanup = bindOwner(options?.owner, this.id, () =>
      this.dispose(),
    );
  }

  get disposed(): boolean {
    return this.disposedState;
  }

  private markDirty = (): void => {
    if (this.disposedState || this.dirty) {
      return;
    }

    this.dirty = true;
    queueEffect(() => {
      if (this.disposedState) {
        return;
      }

      for (const notify of this.dependencySubscribers) {
        notify();
      }
    });

    if (this.subscribers.size > 0) {
      queueEffect(() => {
        if (this.disposedState || this.subscribers.size === 0) {
          return;
        }

        const changed = this.recomputeIfDirty();
        if (!changed) {
          return;
        }

        const nextValue = this.value;
        for (const subscriber of this.subscribers) {
          subscriber(nextValue);
        }
      });
    }
  };

  registerDependency(source: DependencySource): void {
    assertActive(
      this.disposedState,
      "derived",
      this.id,
      "track dependencies for",
    );

    if (this.dependencies.has(source.id)) {
      return;
    }

    const unsubscribe = source.subscribeDependency(this.markDirty);
    const edgeId = nextEdgeId("dependsOn");
    this.dependencies.set(source.id, { unsubscribe, edgeId });

    runtimeGraph.addEdge({
      id: edgeId,
      from: source.id,
      to: this.id,
      type: "dependsOn",
    });
  }

  private recompute(): boolean {
    this.cleanupDependencies();

    const previous = activeTracker;
    activeTracker = this;

    let nextValue!: T;
    try {
      nextValue = this.compute();
    } finally {
      activeTracker = previous;
    }

    const changed = !this.hasValue || !this.equals(nextValue, this.value);
    this.value = nextValue;
    this.hasValue = true;
    this.dirty = false;
    return changed;
  }

  private recomputeIfDirty(): boolean {
    if (!this.dirty) {
      return false;
    }

    return this.recompute();
  }

  private cleanupDependencies(): void {
    for (const { unsubscribe, edgeId } of this.dependencies.values()) {
      unsubscribe();
      runtimeGraph.removeEdge(edgeId);
    }

    this.dependencies.clear();
  }

  get(): T {
    assertActive(this.disposedState, "derived", this.id, "read from");

    if (activeTracker) {
      activeTracker.registerDependency(this);
    }

    if (this.dirty) {
      this.recompute();
    }

    return this.value;
  }

  subscribe(subscriber: Subscriber<T>): () => void {
    assertActive(this.disposedState, "derived", this.id, "subscribe to");

    this.subscribers.add(subscriber);
    subscriber(this.get());
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  subscribeDependency(notify: () => void): () => void {
    assertActive(
      this.disposedState,
      "derived",
      this.id,
      "subscribe to dependency of",
    );

    this.dependencySubscribers.add(notify);
    return () => {
      this.dependencySubscribers.delete(notify);
    };
  }

  dispose(): void {
    if (this.disposedState) {
      return;
    }

    this.disposedState = true;
    this.cleanupDependencies();
    this.subscribers.clear();
    this.dependencySubscribers.clear();

    if (this.ownerCleanup) {
      const cleanup = this.ownerCleanup;
      this.ownerCleanup = null;
      cleanup();
    }

    runtimeGraph.removeNode(this.id);
  }
}

class EffectImpl implements Effect, Tracker {
  readonly id: string;
  readonly name?: string;
  private readonly runEffect: () => void | (() => void);
  private readonly dependencies = new Map<
    string,
    OwnedDependencySubscription
  >();
  private dirty = true;
  private scheduled = false;
  private disposedState = false;
  private ownerCleanup: (() => void) | null = null;
  private pendingCleanup: (() => void) | null = null;

  constructor(runEffect: () => void | (() => void), options?: EffectOptions) {
    this.id = nextNodeId("effect");
    this.name = options?.name;
    this.runEffect = runEffect;

    runtimeGraph.addNode({
      id: this.id,
      type: "EffectNode",
      label: options?.name ?? this.id,
      meta: {
        scope: options?.scope ?? "view",
      },
    });

    this.ownerCleanup = bindOwner(options?.owner, this.id, () =>
      this.dispose(),
    );
    this.execute();
  }

  get disposed(): boolean {
    return this.disposedState;
  }

  registerDependency(source: DependencySource): void {
    assertActive(
      this.disposedState,
      "effect",
      this.id,
      "track dependencies for",
    );

    if (this.dependencies.has(source.id)) {
      return;
    }

    const unsubscribe = source.subscribeDependency(this.markDirty);
    const edgeId = nextEdgeId("dependsOn");
    this.dependencies.set(source.id, { unsubscribe, edgeId });

    runtimeGraph.addEdge({
      id: edgeId,
      from: source.id,
      to: this.id,
      type: "dependsOn",
    });
  }

  private readonly markDirty = (): void => {
    if (this.disposedState) {
      return;
    }

    this.dirty = true;
    if (this.scheduled) {
      return;
    }

    this.scheduled = true;
    queueEffect(() => {
      this.scheduled = false;
      if (this.disposedState || !this.dirty) {
        return;
      }

      this.execute();
    });
  };

  private execute(): void {
    assertActive(this.disposedState, "effect", this.id, "run");

    if (this.pendingCleanup) {
      const cleanup = this.pendingCleanup;
      this.pendingCleanup = null;
      try {
        cleanup();
      } catch {
        /* best-effort */
      }
    }

    this.cleanupDependencies();

    const previous = activeTracker;
    const previousRegistrar = currentCleanupRegistrar;
    activeTracker = this;
    currentCleanupRegistrar = (fn) => {
      const prev = this.pendingCleanup;
      this.pendingCleanup = prev
        ? () => {
            prev();
            fn();
          }
        : fn;
    };
    try {
      const teardown = this.runEffect();
      if (typeof teardown === "function") {
        this.pendingCleanup = teardown;
      }
      this.dirty = false;
    } finally {
      activeTracker = previous;
      currentCleanupRegistrar = previousRegistrar;
    }
  }

  private cleanupDependencies(): void {
    for (const { unsubscribe, edgeId } of this.dependencies.values()) {
      unsubscribe();
      runtimeGraph.removeEdge(edgeId);
    }

    this.dependencies.clear();
  }

  dispose(): void {
    if (this.disposedState) {
      return;
    }

    this.disposedState = true;
    if (this.pendingCleanup) {
      const cleanup = this.pendingCleanup;
      this.pendingCleanup = null;
      try {
        cleanup();
      } catch {
        /* best-effort */
      }
    }
    this.cleanupDependencies();

    if (this.ownerCleanup) {
      const cleanup = this.ownerCleanup;
      this.ownerCleanup = null;
      cleanup();
    }

    runtimeGraph.removeNode(this.id);
  }
}

export function cell<T>(initial: T, options?: CellOptions): Cell<T> {
  return new CellImpl(initial, options);
}

export function derived<T>(
  compute: () => T,
  options?: DerivedOptions<T>,
): Derived<T> {
  return new DerivedImpl(compute, options);
}

export function onCleanup(fn: () => void): void {
  currentCleanupRegistrar?.(fn);
}

export function effect(
  runEffect: () => void | (() => void),
  options?: EffectOptions,
): Effect {
  return new EffectImpl(runEffect, options);
}
