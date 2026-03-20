/**
 * Headless autocomplete island.
 *
 * Wraps query state + debounce + result cache into a reactive bundle.
 * The caller supplies a `fetch` function; results appear in a `Cell<T[]>`.
 *
 * Uses `onCleanup` to cancel in-flight debounce timers on each re-run,
 * ensuring the fetch is only triggered `debounceMs` after the last keystroke.
 *
 * Example:
 * ```ts
 * const ac = createAutocomplete({
 *   fetch: async (q) => searchUsers(q),
 *   debounceMs: 200,
 * });
 *
 * effect(() => {
 *   renderList(ac.results.get());
 * });
 *
 * inputEl.addEventListener("input", (e) => {
 *   ac.setQuery((e.target as HTMLInputElement).value);
 * });
 * ```
 */

import { cell, effect, onCleanup, untracked } from "./reactive.js";
import type { Cell } from "./reactive.js";
import type { ReactiveOwner } from "./types.js";

export type AutocompleteStatus = "idle" | "loading" | "ready" | "error";

export interface AutocompleteOptions<T> {
  /** Async function that returns results for a query string. */
  fetch: (query: string) => Promise<T[]>;
  /** Milliseconds to wait after typing stops before firing `fetch`. Default: 150. */
  debounceMs?: number;
  /** Minimum query length before `fetch` is triggered. Default: 1. */
  minLength?: number;
  /** Maximum number of distinct queries to keep in the result cache. Default: 50. */
  maxCacheSize?: number;
  /** Reactive owner — disposes the autocomplete when the owner is disposed. */
  owner?: ReactiveOwner;
}

export interface AutocompleteController<T> {
  /** Current query string cell. */
  readonly query: Cell<string>;
  /** Current result list cell (empty array when loading or idle). */
  readonly results: Cell<T[]>;
  /** Current status cell. */
  readonly status: Cell<AutocompleteStatus>;
  /** Update the query (triggers debounced fetch). */
  setQuery(query: string): void;
  /** Number of cached query results. */
  cacheSize(): number;
  /** Clear the result cache. */
  clearCache(): void;
  /** Destroy the autocomplete island and clean up reactive effects. */
  destroy(): void;
}

export function createAutocomplete<T>(
  options: AutocompleteOptions<T>,
): AutocompleteController<T> {
  const debounceMs = options.debounceMs ?? 150;
  const minLength = options.minLength ?? 1;
  const maxCacheSize = options.maxCacheSize ?? 50;

  const queryCell = cell<string>("");
  const resultsCell = cell<T[]>([]);
  const statusCell = cell<AutocompleteStatus>("idle");

  // Cache: query string → results
  const cache = new Map<string, T[]>();

  const fx = effect(
    () => {
      const query = queryCell.get();

      if (query.length < minLength) {
        untracked(() => {
          resultsCell.set([]);
          statusCell.set("idle");
        });
        return;
      }

      // Check cache before debouncing
      if (cache.has(query)) {
        const cached = cache.get(query)!;
        untracked(() => {
          resultsCell.set(cached);
          statusCell.set("ready");
        });
        return;
      }

      untracked(() => statusCell.set("loading"));

      // Each time the effect runs with a new query, `cancelled` is set to true
      // by the onCleanup teardown, preventing stale fetch responses from landing.
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });

      const timerId = setTimeout(() => {
        options
          .fetch(query)
          .then((items) => {
            if (cancelled) return;

            // Evict oldest entry when cache is full
            if (cache.size >= maxCacheSize) {
              const oldest = cache.keys().next().value;
              if (oldest !== undefined) {
                cache.delete(oldest);
              }
            }

            cache.set(query, items);
            resultsCell.set(items);
            statusCell.set("ready");
          })
          .catch(() => {
            if (cancelled) return;
            resultsCell.set([]);
            statusCell.set("error");
          });
      }, debounceMs);

      // Cancel the pending debounce timer if the effect re-runs before it fires.
      onCleanup(() => clearTimeout(timerId));
    },
    { owner: options.owner },
  );

  return {
    query: queryCell,
    results: resultsCell,
    status: statusCell,

    setQuery(query: string): void {
      queryCell.set(query);
    },

    cacheSize(): number {
      return cache.size;
    },

    clearCache(): void {
      cache.clear();
    },

    destroy(): void {
      fx.dispose();
    },
  };
}
