/**
 * Helix Framework – Scalability Benchmark
 *
 * Measures two subsystems that were refactored for scalability:
 *
 *   1.  Router dispatch    – indexed segment matcher vs prior linear scan
 *   2.  Reactive fanout    – microtask-batched subscriber notifications
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for all enqueued microtasks (and any they spawn) to finish. */
async function awaitMicrotasks(): Promise<void> {
  // The effect queue uses `queueMicrotask`; two ticks guarantees the batch
  // itself plus any derivative notifications have settled.
  await new Promise<void>((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
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
  targetPosition: "first" | "middle" | "last"
): Promise<{ totalMs: number; opsPerSec: number }> {
  const DISPATCHES = 50_000;
  let handled = 0;

  const routes = [];

  const targetIndex =
    targetPosition === "first" ? 0
    : targetPosition === "last" ? routeCount - 1
    : Math.floor(routeCount / 2);

  for (let i = 0; i < routeCount; i++) {
    if (i === targetIndex) {
      routes.push(
        defineRoute("GET", "/bench/:id", (_ctx) => {
          handled++;
        })
      );
    } else {
      routes.push(
        defineRoute("GET", `/route-${i}/:id`, (_ctx) => {})
      );
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
  updates: number
): Promise<{ totalMs: number; opsPerSec: number; notificationsPerSec: number }> {
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
      `(subscribers=${subscriberCount}, updates=${updates})`
    );
  }

  return {
    totalMs: elapsed,
    opsPerSec: (updates / elapsed) * 1000,
    notificationsPerSec: (expectedNotifications / elapsed) * 1000
  };
}

// ---------------------------------------------------------------------------
// 3. Derived Chain Benchmark
// ---------------------------------------------------------------------------

/**
 * A chain of N derived nodes depends on one root cell.
 * Measures re-computation throughput when the root is updated.
 */
async function benchDerivedChain(chainLength: number, updates: number): Promise<{ totalMs: number; opsPerSec: number }> {
  const root = cell<number>(0, { name: `chain-root-${chainLength}` });

  // Build chain: each node adds 1 to its predecessor
  let prev: Derived<number> = derived(() => root.get() + 1, { name: `chain-0-${chainLength}` });
  for (let i = 1; i < chainLength; i++) {
    const source = prev;
    prev = derived(() => source.get() + 1, { name: `chain-${i}-${chainLength}` });
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
      `(chainLength=${chainLength}, updates=${updates})`
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
  const positions: Array<"first" | "middle" | "last"> = ["first", "middle", "last"];

  for (const count of routeCounts) {
    const results = await Promise.all(
      positions.map((pos) => benchRouter(count, pos))
    );
    for (let i = 0; i < positions.length; i++) {
      const { totalMs, opsPerSec } = results[i];
      console.log(
        `  ${String(count).padStart(5)}  │ ${positions[i].padEnd(10)} │ ` +
        `${formatMs(totalMs).padStart(13)} │ ${formatThroughput(50_000, totalMs)}`
      );
    }
    if (count !== routeCounts[routeCounts.length - 1]) {
      console.log(`  ───────┼────────────┼───────────────┼────────────────────`);
    }
  }

  // ── Reactive fanout ────────────────────────────────────────────────────

  header("Reactive Fanout (10 000 cell updates per row)");
  console.log(`\n  Subscribers │ Total time    │ Updates/s          │ Notifications/s`);
  console.log(`  ────────────┼───────────────┼────────────────────┼────────────────────`);

  const subscriberCounts = [1, 10, 50, 100, 500, 1000, 5000];
  const FANOUT_UPDATES = 10_000;

  for (const subs of subscriberCounts) {
    const { totalMs, opsPerSec, notificationsPerSec } = await benchReactiveFanout(subs, FANOUT_UPDATES);
    console.log(
      `  ${String(subs).padStart(11)} │ ${formatMs(totalMs).padStart(13)} │ ` +
      `${formatThroughput(FANOUT_UPDATES, totalMs).padStart(18)} │ ` +
      `${formatThroughput(FANOUT_UPDATES * subs, totalMs)}`
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
      `${formatThroughput(CHAIN_UPDATES, totalMs)}`
    );
  }

  console.log("\n  Done.\n");
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
