import { nextNodeId, runtimeGraph } from "./graph.js";
import type { GraphSnapshot, ResourcePolicy } from "./types.js";

type MaybePromise<T> = T | Promise<T>;

export type ResourceContext = object;

interface ResourceCacheEntry<T> {
  value: T;
  updatedAt: number;
  tags: string[];
}

interface ResourceStoreEntry<T> {
  cacheEntry?: ResourceCacheEntry<T>;
  inflight?: Promise<T>;
}

interface ResourceRegistryEntry {
  invalidateByTags(tags: readonly string[]): void;
  snapshotInto(snapshot: GraphSnapshot): void;
}

const resourceRegistry = new Map<string, ResourceRegistryEntry>();

function stableKeyToString(key: unknown): string {
  return JSON.stringify(key);
}

class ResourceImpl<T, Ctx extends ResourceContext = ResourceContext> {
  readonly id: string;
  readonly label: string;
  private readonly keyFn: (ctx: Ctx) => unknown;
  private readonly fetcher: (ctx: Ctx) => Promise<T>;
  private readonly policy: ResourcePolicy;
  private readonly store = new Map<string, ResourceStoreEntry<T>>();
  private readonly keyToTags = new Map<string, string[]>();

  private deleteKey(key: string): void {
    this.store.delete(key);
    this.keyToTags.delete(key);
  }

  constructor(
    label: string,
    keyFn: (ctx: Ctx) => unknown,
    fetcher: (ctx: Ctx) => MaybePromise<T>,
    policy: ResourcePolicy
  ) {
    this.id = nextNodeId("resource");
    this.label = label;
    this.keyFn = keyFn;
    this.fetcher = async (ctx: Ctx) => fetcher(ctx);
    this.policy = policy;

    runtimeGraph.addNode({
      id: this.id,
      type: "ResourceNode",
      label,
      meta: {
        policy
      }
    });

    resourceRegistry.set(this.id, this);
  }

  private getTags(ctx: Ctx): string[] {
    if (!this.policy.tags) {
      return [];
    }
    return typeof this.policy.tags === "function" ? this.policy.tags(ctx) : this.policy.tags;
  }

  private isFresh(entry: ResourceCacheEntry<T>): boolean {
    if (!this.policy.staleMs || this.policy.cache === "none") {
      return this.policy.cache !== "none";
    }
    return Date.now() - entry.updatedAt < this.policy.staleMs;
  }

  private pruneExpiredEntries(now: number): void {
    if (!this.policy.staleMs || this.policy.cache === "none") {
      return;
    }

    for (const [key, entry] of this.store) {
      if (entry.inflight || !entry.cacheEntry) {
        continue;
      }
      if (now - entry.cacheEntry.updatedAt >= this.policy.staleMs) {
        this.deleteKey(key);
      }
    }
  }

  private enforceMaxEntries(): void {
    const maxEntries = this.policy.maxEntries;
    if (!maxEntries || maxEntries < 1 || this.store.size <= maxEntries) {
      return;
    }

    for (const [key, entry] of this.store) {
      if (this.store.size <= maxEntries) {
        return;
      }
      if (entry.inflight) {
        continue;
      }
      this.deleteKey(key);
    }
  }

  async read(ctx: Ctx): Promise<T> {
    const key = stableKeyToString(this.keyFn(ctx));
    const now = Date.now();
    this.pruneExpiredEntries(now);
    const current = this.store.get(key);

    if (current?.cacheEntry && this.isFresh(current.cacheEntry)) {
      this.store.delete(key);
      this.store.set(key, current);
      return current.cacheEntry.value;
    }

    if (this.policy.dedupe !== "none" && current?.inflight) {
      return current.inflight;
    }

    const inflight = this.fetcher(ctx).then((value) => {
      const tags = this.getTags(ctx);
      const cacheEntry =
        this.policy.cache === "none"
          ? undefined
          : {
              value,
              updatedAt: Date.now(),
              tags
            };
      const nextEntry: ResourceStoreEntry<T> = {
        cacheEntry
      };
      this.store.set(key, nextEntry);
      if (cacheEntry) {
        this.keyToTags.set(key, tags);
      } else {
        this.keyToTags.delete(key);
      }
      this.enforceMaxEntries();
      return value;
    });

    this.store.set(key, {
      ...current,
      inflight
    });

    try {
      return await inflight;
    } finally {
      const settled = this.store.get(key);
      if (settled?.cacheEntry) {
        this.store.set(key, {
          cacheEntry: settled.cacheEntry
        });
        this.enforceMaxEntries();
      } else if (settled) {
        this.deleteKey(key);
      }
    }
  }

  invalidateByTags(tags: readonly string[]): void {
    if (tags.length === 0) {
      return;
    }

    const tagSet = new Set(tags);
    for (const [key, savedTags] of this.keyToTags) {
      if (savedTags.some((tag) => tagSet.has(tag))) {
        this.deleteKey(key);
      }
    }
  }

  snapshotInto(snapshot: GraphSnapshot): void {
    for (const [key, entry] of this.store) {
      if (!entry.cacheEntry) {
        continue;
      }
      snapshot.resources[`${this.id}:${key}`] = entry.cacheEntry.value;
      snapshot.tags[`${this.id}:${key}`] = entry.cacheEntry.tags;
    }
  }
}

export interface ResourceHandle<T, Ctx extends ResourceContext = ResourceContext> {
  id: string;
  read(ctx: Ctx): Promise<T>;
}

export function resource<T, Ctx extends ResourceContext = ResourceContext>(
  label: string,
  keyFn: (ctx: Ctx) => unknown,
  fetcher: (ctx: Ctx) => MaybePromise<T>,
  policy: ResourcePolicy
): ResourceHandle<T, Ctx> {
  const impl = new ResourceImpl<T, Ctx>(label, keyFn, fetcher, policy);
  return {
    id: impl.id,
    read: (ctx: Ctx) => impl.read(ctx)
  };
}

export function invalidateResourcesByTags(tags: readonly string[]): void {
  for (const resourceImpl of resourceRegistry.values()) {
    resourceImpl.invalidateByTags(tags);
  }
}

export function writeResourcesIntoSnapshot(snapshot: GraphSnapshot): void {
  for (const resourceImpl of resourceRegistry.values()) {
    resourceImpl.snapshotInto(snapshot);
  }
}