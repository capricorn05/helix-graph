/**
 * Helix Framework – Scalability Benchmark
 *
 * Measures core scalability and update-path benchmarks:
 *
 *   1.  Router dispatch    – indexed segment matcher vs prior linear scan
 *   2.  Reactive fanout    – microtask-batched subscriber notifications
 *   3.  External updates   – /external-data vs /external-data-rich payload latency
 *
 * Run:
 *   npm run build && node dist/bench/index.js
 *
 * All timings use `performance.now()` for sub-millisecond precision.
 * Reactive tests await a settled microtask queue via `awaitMicrotasks()`.
 */

import { performance } from "node:perf_hooks";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRouter, defineRoute } from "../helix/router.js";
import { cell, derived } from "../helix/reactive.js";
import type { Derived } from "../helix/reactive.js";
import { invalidateResourcesByTags } from "../helix/resource.js";
import {
  EXTERNAL_PRODUCTS_PAGE_SIZE,
  externalProductsResource,
  resolveExternalProductDetails,
  resetExternalProductsSeedCacheForTests,
  setExternalProductSeedsForTests,
} from "../example/resources/external-products.resource.js";
import {
  resolveExternalProductsQuery,
  type ExternalProductsQuery,
} from "../example/utils/query.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for all enqueued microtasks (and any they spawn) to finish. */
async function awaitMicrotasks(): Promise<void> {
  // The effect queue uses `queueMicrotask`; two ticks guarantees the batch
  // itself plus any derivative notifications have settled.
  await new Promise<void>((resolve) =>
    queueMicrotask(() => queueMicrotask(resolve)),
  );
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(1)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatThroughput(ops: number, ms: number): string {
  const perSec = (ops / ms) * 1000;
  if (perSec >= 1_000_000) return `${(perSec / 1_000_000).toFixed(2)} M ops/s`;
  if (perSec >= 1_000) return `${(perSec / 1_000).toFixed(1)} K ops/s`;
  return `${perSec.toFixed(0)} ops/s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  let total = 0;
  for (const value of values) {
    total += value;
  }

  return total / values.length;
}

function percentile(values: readonly number[], rank: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const boundedRank = Math.max(0, Math.min(rank, 1));
  const position = Math.ceil(sorted.length * boundedRank) - 1;
  return sorted[Math.max(0, position)];
}

type ExternalSeedProducts = Parameters<
  typeof setExternalProductSeedsForTests
>[0];

interface ExternalUpdateScenario {
  label: string;
  path: string;
  buildPayload(query: ExternalProductsQuery): Promise<unknown>;
}

interface ExternalUpdateScenarioResult {
  label: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  avgPayloadBytes: number;
}

function createDeterministicExternalSeedProducts(
  count = 100,
): ExternalSeedProducts {
  const categories = [
    "smartphones",
    "laptops",
    "groceries",
    "home-decoration",
    "skincare",
  ] as const;

  const seeds: ExternalSeedProducts = [];
  for (let i = 0; i < count; i++) {
    const id = i + 1;
    const category = categories[i % categories.length];

    seeds.push({
      id,
      title: `Deterministic Product ${String(id).padStart(3, "0")}`,
      brand: `Brand ${String((id % 17) + 1).padStart(2, "0")}`,
      category,
      price: Number((19.5 + (i % 23) * 3.25).toFixed(2)),
      stock: 25 + (i % 41),
      rating: Number((3 + (i % 10) * 0.17).toFixed(1)),
      description: `Deterministic seed ${id} (${category})`,
      thumbnail: `https://assets.example.invalid/products/${id}.png`,
    });
  }

  return seeds;
}

function buildExternalProductsQuery(
  path: string,
  page: number,
): ExternalProductsQuery {
  const url = new URL(`http://bench.local${path}?page=${page}`);
  return resolveExternalProductsQuery(url, EXTERNAL_PRODUCTS_PAGE_SIZE);
}

async function runExternalUpdateScenario(
  scenario: ExternalUpdateScenario,
  warmupPages: readonly number[],
  measuredPages: readonly number[],
  deterministicSeeds: ExternalSeedProducts,
): Promise<ExternalUpdateScenarioResult> {
  resetExternalProductsSeedCacheForTests();
  setExternalProductSeedsForTests(deterministicSeeds);
  invalidateResourcesByTags(["external-products"]);

  for (const page of warmupPages) {
    const query = buildExternalProductsQuery(scenario.path, page);
    await scenario.buildPayload(query);
  }

  const latenciesMs: number[] = [];
  const payloadSizesBytes: number[] = [];
  const startedAt = performance.now();

  for (const page of measuredPages) {
    const query = buildExternalProductsQuery(scenario.path, page);
    const iterationStart = performance.now();
    const payload = await scenario.buildPayload(query);
    const iterationMs = performance.now() - iterationStart;

    latenciesMs.push(iterationMs);
    payloadSizesBytes.push(Buffer.byteLength(JSON.stringify(payload), "utf8"));
  }

  const totalMs = performance.now() - startedAt;

  return {
    label: scenario.label,
    iterations: measuredPages.length,
    totalMs,
    avgMs: average(latenciesMs),
    p95Ms: percentile(latenciesMs, 0.95),
    maxMs: Math.max(...latenciesMs),
    avgPayloadBytes: average(payloadSizesBytes),
  };
}

function header(label: string): void {
  const bar = "═".repeat(60);
  console.log(`\n╔${bar}╗`);
  console.log(`║  ${label.padEnd(58)}║`);
  console.log(`╚${bar}╝`);
}

function row(label: string, value: string): void {
  console.log(`  ${label.padEnd(38)} ${value}`);
}

// ---------------------------------------------------------------------------
// 1. Router Dispatch Benchmark
// ---------------------------------------------------------------------------

/**
 * Build a router with `routeCount` GET routes on distinct static prefixes,
 * plus one target route with a :param segment that will be dispatched.
 *
 * The target route is at `targetPosition` in the registered list (0-based):
 *   "first"  → route 0 in declaration order
 *   "middle" → route ~N/2
 *   "last"   → route N-1
 */
async function benchRouter(
  routeCount: number,
  targetPosition: "first" | "middle" | "last",
): Promise<{ totalMs: number; opsPerSec: number }> {
  const DISPATCHES = 50_000;
  let handled = 0;

  const routes = [];

  const targetIndex =
    targetPosition === "first"
      ? 0
      : targetPosition === "last"
        ? routeCount - 1
        : Math.floor(routeCount / 2);

  for (let i = 0; i < routeCount; i++) {
    if (i === targetIndex) {
      routes.push(
        defineRoute("GET", "/bench/:id", (_ctx) => {
          handled++;
        }),
      );
    } else {
      routes.push(defineRoute("GET", `/route-${i}/:id`, (_ctx) => {}));
    }
  }

  const router = createRouter(routes);

  const mockRequest = { method: "GET" } as IncomingMessage;
  const mockResponse = {} as ServerResponse;
  const url = new URL("http://localhost/bench/42");

  // Warm-up
  for (let i = 0; i < 500; i++) {
    await router.dispatch(mockRequest, mockResponse, url);
  }
  handled = 0;

  const start = performance.now();
  for (let i = 0; i < DISPATCHES; i++) {
    await router.dispatch(mockRequest, mockResponse, url);
  }
  const elapsed = performance.now() - start;

  if (handled !== DISPATCHES) {
    throw new Error(`Expected ${DISPATCHES} handled routes, got ${handled}`);
  }

  return { totalMs: elapsed, opsPerSec: (DISPATCHES / elapsed) * 1000 };
}

// ---------------------------------------------------------------------------
// 2. Reactive Cell Fanout Benchmark
// ---------------------------------------------------------------------------

/**
 * Create a cell with `subscriberCount` subscribers, fire `updates` writes, and
 * wait for all microtask-batched notifications to settle.
 *
 * Returns total wall-clock time including flush wait and ops/s.
 */
async function benchReactiveFanout(
  subscriberCount: number,
  updates: number,
): Promise<{
  totalMs: number;
  opsPerSec: number;
  notificationsPerSec: number;
}> {
  const c = cell<number>(0, { name: `bench-cell-${subscriberCount}` });
  let receivedCount = 0;

  for (let i = 0; i < subscriberCount; i++) {
    c.subscribe((_v) => {
      receivedCount++;
    });
  }

  // The subscribe() call fires immediately with the initial value; reset count.
  await awaitMicrotasks();
  receivedCount = 0;

  const start = performance.now();

  for (let i = 1; i <= updates; i++) {
    c.set(i);
  }
  await awaitMicrotasks();

  const elapsed = performance.now() - start;

  const expectedNotifications = updates * subscriberCount;
  if (receivedCount !== expectedNotifications) {
    throw new Error(
      `Expected ${expectedNotifications} notifications, got ${receivedCount} ` +
        `(subscribers=${subscriberCount}, updates=${updates})`,
    );
  }

  return {
    totalMs: elapsed,
    opsPerSec: (updates / elapsed) * 1000,
    notificationsPerSec: (expectedNotifications / elapsed) * 1000,
  };
}

// ---------------------------------------------------------------------------
// 3. Derived Chain Benchmark
// ---------------------------------------------------------------------------

/**
 * A chain of N derived nodes depends on one root cell.
 * Measures re-computation throughput when the root is updated.
 */
async function benchDerivedChain(
  chainLength: number,
  updates: number,
): Promise<{ totalMs: number; opsPerSec: number }> {
  const root = cell<number>(0, { name: `chain-root-${chainLength}` });

  // Build chain: each node adds 1 to its predecessor
  let prev: Derived<number> = derived(() => root.get() + 1, {
    name: `chain-0-${chainLength}`,
  });
  for (let i = 1; i < chainLength; i++) {
    const source = prev;
    prev = derived(() => source.get() + 1, {
      name: `chain-${i}-${chainLength}`,
    });
  }

  const tip = prev;
  let lastValue = 0;

  tip.subscribe((v) => {
    lastValue = v;
  });

  // Flush initial subscription notification
  await awaitMicrotasks();
  lastValue = 0;

  const expectedFinalValue = updates + chainLength;
  const start = performance.now();
  for (let i = 1; i <= updates; i++) {
    root.set(i);
  }
  await awaitMicrotasks();

  const elapsed = performance.now() - start;

  if (lastValue !== expectedFinalValue) {
    throw new Error(
      `Derived chain value mismatch: expected ${expectedFinalValue}, got ${lastValue} ` +
        `(chainLength=${chainLength}, updates=${updates})`,
    );
  }

  return { totalMs: elapsed, opsPerSec: (updates / elapsed) * 1000 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("\n  Helix Framework — Scalability Benchmark");
  console.log(`  Node ${process.version}   ${new Date().toISOString()}`);

  // ── Router ─────────────────────────────────────────────────────────────

  header("Router Dispatch (50 000 dispatches per cell)");
  console.log(`\n  Routes │ Target pos │ Total time    │ Throughput`);
  console.log(`  ───────┼────────────┼───────────────┼────────────────────`);

  const routeCounts = [10, 50, 100, 200, 500, 1000];
  const positions: Array<"first" | "middle" | "last"> = [
    "first",
    "middle",
    "last",
  ];

  for (const count of routeCounts) {
    const results = await Promise.all(
      positions.map((pos) => benchRouter(count, pos)),
    );
    for (let i = 0; i < positions.length; i++) {
      const { totalMs, opsPerSec } = results[i];
      console.log(
        `  ${String(count).padStart(5)}  │ ${positions[i].padEnd(10)} │ ` +
          `${formatMs(totalMs).padStart(13)} │ ${formatThroughput(50_000, totalMs)}`,
      );
    }
    if (count !== routeCounts[routeCounts.length - 1]) {
      console.log(
        `  ───────┼────────────┼───────────────┼────────────────────`,
      );
    }
  }

  // ── Reactive fanout ────────────────────────────────────────────────────

  header("Reactive Fanout (10 000 cell updates per row)");
  console.log(
    `\n  Subscribers │ Total time    │ Updates/s          │ Notifications/s`,
  );
  console.log(
    `  ────────────┼───────────────┼────────────────────┼────────────────────`,
  );

  const subscriberCounts = [1, 10, 50, 100, 500, 1000, 5000];
  const FANOUT_UPDATES = 10_000;

  for (const subs of subscriberCounts) {
    const { totalMs, opsPerSec, notificationsPerSec } =
      await benchReactiveFanout(subs, FANOUT_UPDATES);
    console.log(
      `  ${String(subs).padStart(11)} │ ${formatMs(totalMs).padStart(13)} │ ` +
        `${formatThroughput(FANOUT_UPDATES, totalMs).padStart(18)} │ ` +
        `${formatThroughput(FANOUT_UPDATES * subs, totalMs)}`,
    );
  }

  // ── Derived chain ──────────────────────────────────────────────────────

  header("Derived Chain Re-computation (5 000 root updates per row)");
  console.log(`\n  Chain depth │ Total time    │ Root updates/s`);
  console.log(`  ────────────┼───────────────┼────────────────────`);

  const chainLengths = [1, 5, 10, 20, 50, 100];
  const CHAIN_UPDATES = 5_000;

  for (const depth of chainLengths) {
    const { totalMs } = await benchDerivedChain(depth, CHAIN_UPDATES);
    console.log(
      `  ${String(depth).padStart(11)} │ ${formatMs(totalMs).padStart(13)} │ ` +
        `${formatThroughput(CHAIN_UPDATES, totalMs)}`,
    );
  }

  // ── External update payload latency ───────────────────────────────────

  header("External Update Payload Latency (warm 1-3, test 4-33)");
  console.log(
    `\n  Variant             │ Avg      │ P95      │ Max      │ Throughput │ Avg size`,
  );
  console.log(
    `  ────────────────────┼──────────┼──────────┼──────────┼────────────┼──────────`,
  );

  const warmupPages = [1, 2, 3] as const;
  const measuredPages = Array.from({ length: 30 }, (_, index) => index + 4);
  const deterministicSeeds = createDeterministicExternalSeedProducts();

  const scenarios: ExternalUpdateScenario[] = [
    {
      label: "/external-data",
      path: "/external-data",
      buildPayload: (query) => externalProductsResource.read(query),
    },
    {
      label: "/external-data-rich",
      path: "/external-data-rich",
      buildPayload: async (query) => {
        const plainPayload = await externalProductsResource.read(query);
        const rows = await resolveExternalProductDetails(plainPayload.rows);
        return {
          ...plainPayload,
          rows,
        };
      },
    },
  ];

  const results: ExternalUpdateScenarioResult[] = [];
  for (const scenario of scenarios) {
    const result = await runExternalUpdateScenario(
      scenario,
      warmupPages,
      measuredPages,
      deterministicSeeds,
    );
    results.push(result);

    console.log(
      `  ${scenario.label.padEnd(19)} │ ${formatMs(result.avgMs).padStart(8)} │ ` +
        `${formatMs(result.p95Ms).padStart(8)} │ ${formatMs(result.maxMs).padStart(8)} │ ` +
        `${formatThroughput(result.iterations, result.totalMs).padStart(10)} │ ` +
        `${formatBytes(result.avgPayloadBytes)}`,
    );
  }

  const plainResult = results.find(
    (result) => result.label === "/external-data",
  );
  const richResult = results.find(
    (result) => result.label === "/external-data-rich",
  );

  if (plainResult && richResult && plainResult.avgMs > 0) {
    const slowdown = richResult.avgMs / plainResult.avgMs;
    const percentDelta = Math.abs((slowdown - 1) * 100);
    const direction =
      slowdown > 1 ? "slower" : slowdown < 1 ? "faster" : "equal latency";
    console.log(
      `\n  Relative latency (/external-data-rich vs /external-data): ` +
        `${slowdown.toFixed(2)}x (${percentDelta.toFixed(1)}% ${direction} by avg latency)`,
    );
  }

  // ── SSR & Resume Benchmarks ────────────────────────────────────────────

  // Import SSR benchmarks
  const {
    benchmarkSsrGeneration,
    benchmarkResumeInit,
    benchmarkPatchApplication,
    formatBenchmarkResults,
  } = await import("../helix/ssr-bench.js");

  header("SSR & Resume Performance");

  const ssrGenResults = await benchmarkSsrGeneration();
  console.log(formatBenchmarkResults([ssrGenResults]));

  header("Client Resume Initialization");

  const resumeResults = await benchmarkResumeInit();
  console.log(formatBenchmarkResults([resumeResults]));

  header("Patch Application (Incremental DOM Updates)");

  const patchResults = await benchmarkPatchApplication();
  console.log(formatBenchmarkResults([patchResults]));

  console.log("\n  Done.\n");
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
