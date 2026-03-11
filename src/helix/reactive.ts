import { nextEdgeId, nextNodeId, runtimeGraph } from "./graph.js";
import type { CellOptions, DerivedOptions } from "./types.js";

type Subscriber<T> = (value: T) => void;

interface DependencySource {
  id: string;
  subscribeDependency: (notify: () => void) => () => void;
}

interface Tracker {
  registerDependency: (source: DependencySource) => void;
}

let activeTracker: Tracker | null = null;

const pendingEffects = new Set<() => void>();
let effectsFlushScheduled = false;

function flushPendingEffects(): void {
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
  if (!effectsFlushScheduled) {
    effectsFlushScheduled = true;
    queueMicrotask(flushPendingEffects);
  }
}

export interface Cell<T> extends DependencySource {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  update(updater: (prev: T) => T): void;
  subscribe(subscriber: Subscriber<T>): () => void;
  readonly name?: string;
}

export interface Derived<T> extends DependencySource {
  get(): T;
  subscribe(subscriber: Subscriber<T>): () => void;
  readonly name?: string;
}

class CellImpl<T> implements Cell<T> {
  readonly id: string;
  readonly name?: string;
  private value: T;
  private readonly subscribers = new Set<Subscriber<T>>();
  private readonly dependencySubscribers = new Set<() => void>();

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
        clientOnly: options?.clientOnly ?? false
      }
    });
  }

  get(): T {
    if (activeTracker) {
      activeTracker.registerDependency(this);
    }
    return this.value;
  }

  set(next: T | ((prev: T) => T)): void {
    const nextValue = typeof next === "function" ? (next as (prev: T) => T)(this.value) : next;
    if (Object.is(nextValue, this.value)) {
      return;
    }
    this.value = nextValue;
    const valueAtSchedule = this.value;
    queueEffect(() => {
      for (const subscriber of this.subscribers) {
        subscriber(valueAtSchedule);
      }
    });
    queueEffect(() => {
      for (const notify of this.dependencySubscribers) {
        notify();
      }
    });
  }

  update(updater: (prev: T) => T): void {
    this.set(updater);
  }

  subscribe(subscriber: Subscriber<T>): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.value);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  subscribeDependency(notify: () => void): () => void {
    this.dependencySubscribers.add(notify);
    return () => {
      this.dependencySubscribers.delete(notify);
    };
  }
}

class DerivedImpl<T> implements Derived<T>, Tracker {
  readonly id: string;
  readonly name?: string;
  private readonly compute: () => T;
  private readonly subscribers = new Set<Subscriber<T>>();
  private readonly dependencySubscribers = new Set<() => void>();
  private readonly dependencies = new Map<string, () => void>();
  private dirty = true;
  private value!: T;

  constructor(compute: () => T, options?: DerivedOptions) {
    this.id = nextNodeId("derived");
    this.name = options?.name;
    this.compute = compute;

    runtimeGraph.addNode({
      id: this.id,
      type: "DerivedNode",
      label: options?.name ?? this.id,
      meta: {
        scope: options?.scope ?? "view"
      }
    });
  }

  private markDirty = (): void => {
    if (this.dirty) {
      return;
    }
    this.dirty = true;
    queueEffect(() => {
      for (const notify of this.dependencySubscribers) {
        notify();
      }
    });
    if (this.subscribers.size > 0) {
      queueEffect(() => {
        if (this.subscribers.size === 0) {
          return;
        }
        const nextValue = this.get();
        for (const subscriber of this.subscribers) {
          subscriber(nextValue);
        }
      });
    }
  };

  registerDependency(source: DependencySource): void {
    if (this.dependencies.has(source.id)) {
      return;
    }

    const unsubscribe = source.subscribeDependency(this.markDirty);
    this.dependencies.set(source.id, unsubscribe);
    runtimeGraph.addEdge({
      id: nextEdgeId("dependsOn"),
      from: this.id,
      to: source.id,
      type: "dependsOn"
    });
  }

  private recompute(): void {
    this.cleanupDependencies();

    const previous = activeTracker;
    activeTracker = this;
    try {
      this.value = this.compute();
      this.dirty = false;
    } finally {
      activeTracker = previous;
    }
  }

  private cleanupDependencies(): void {
    for (const unsubscribe of this.dependencies.values()) {
      unsubscribe();
    }
    this.dependencies.clear();
  }

  get(): T {
    if (activeTracker) {
      activeTracker.registerDependency(this);
    }
    if (this.dirty) {
      this.recompute();
    }
    return this.value;
  }

  subscribe(subscriber: Subscriber<T>): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.get());
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  subscribeDependency(notify: () => void): () => void {
    this.dependencySubscribers.add(notify);
    return () => {
      this.dependencySubscribers.delete(notify);
    };
  }
}

export function cell<T>(initial: T, options?: CellOptions): Cell<T> {
  return new CellImpl(initial, options);
}

export function derived<T>(compute: () => T, options?: DerivedOptions): Derived<T> {
  return new DerivedImpl(compute, options);
}