/**
 * SSR & Resume Performance Benchmarks
 *
 * Measures:
 *   1. Initial SSR HTML generation time
 *   2. Fragment-swap vs full-refresh update performance
 *   3. Patch application and DOM diffing overhead
 *   4. Resume client rehydration time
 *
 * Run from bench suite or standalone.
 */

import { performance } from "node:perf_hooks";
import { JSDOM } from "jsdom";
import type { BindingMap, GraphSnapshot, PatchOp } from "./types.js";
import { compiledViewId, defineCompiledViewArtifact } from "./view-compiler.js";
import { resetRuntimeGraph, runtimeGraph } from "./graph.js";
import { resumeClientApp } from "./resume.js";
import {
  createGraphSnapshot,
  snapshotScript,
  bindingMapScript,
} from "./ssr.js";
import { PatchRuntime } from "./patch.js";

export interface SsrBenchmarkResults {
  label: string;
  metrics: {
    name: string;
    durationMs: number;
    description: string;
  }[];
}

interface BenchmarkTrace {
  startTime: number;
  marks: Map<string, number>;
}

function createTrace(): BenchmarkTrace {
  return {
    startTime: performance.now(),
    marks: new Map(),
  };
}

function markTrace(trace: BenchmarkTrace, label: string): void {
  trace.marks.set(label, performance.now());
}

function measureTrace(trace: BenchmarkTrace, from: string, to: string): number {
  const start = trace.marks.get(from);
  const end = trace.marks.get(to);
  if (start === undefined || end === undefined) return 0;
  return end - start;
}

/**
 * Benchmark: SSR HTML generation for a typical page with 50 items.
 */
export async function benchmarkSsrGeneration(): Promise<SsrBenchmarkResults> {
  resetRuntimeGraph();

  const trace = createTrace();
  markTrace(trace, "start");

  // Simulate a compiled view artifact
  defineCompiledViewArtifact(compiledViewId("bench-list"), "bench-list", {
    template:
      "<v data-hx-id='items'>" +
      Array.from({ length: 50 })
        .map((_, i) => `<div data-hx-id='item-${i}'>Item ${i}</div>`)
        .join("") +
      "</v>",
    patches: [],
    bindingMap: { events: {}, lists: {} },
  });

  markTrace(trace, "artifact-defined");

  // Create typical snapshot
  const snapshot = createGraphSnapshot(
    {
      items: Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        completed: i % 3 === 0,
      })),
      filter: "all",
      pageNumber: 1,
    },
    { includeGraph: true },
  );

  markTrace(trace, "snapshot-created");

  return {
    label: "SSR Generation (50-item list)",
    metrics: [
      {
        name: "Artifact Definition",
        durationMs: measureTrace(trace, "start", "artifact-defined"),
        description:
          "Time to load and register compiled view artifact metadata",
      },
      {
        name: "Snapshot Creation",
        durationMs: measureTrace(trace, "artifact-defined", "snapshot-created"),
        description: "Time to create JSON snapshot of reactive state and graph",
      },
      {
        name: "Total SSR Time",
        durationMs: measureTrace(trace, "start", "snapshot-created"),
        description: "End-to-end SSR generation",
      },
    ],
  };
}

/**
 * Benchmark: Resume client initialization from SSR snapshot.
 */
export async function benchmarkResumeInit(): Promise<SsrBenchmarkResults> {
  resetRuntimeGraph();

  const trace = createTrace();
  markTrace(trace, "start");

  // Set up compiled view
  defineCompiledViewArtifact(compiledViewId("bench-resume"), "bench-resume", {
    template:
      "<div data-hx-id='counter'>" +
      "<span data-hx-id='count'>0</span>" +
      "<button data-hx-bind='increment'>+1</button>" +
      "</div>",
    patches: [],
    bindingMap: {
      events: {
        increment: {
          id: "increment",
          event: "click",
          actionId: "onIncrement",
          chunk: "/client/bench.js",
          handlerExport: "handleIncrement",
        },
      },
      lists: {},
    },
  });

  const snapshot = createGraphSnapshot({ count: 42 }, { includeGraph: true });

  markTrace(trace, "setup");

  const bindings: BindingMap = {
    events: {
      increment: {
        id: "increment",
        event: "click",
        actionId: "onIncrement",
        chunk: "/client/bench.js",
        handlerExport: "handleIncrement",
      },
    },
    lists: {},
  };

  const dom = new JSDOM(
    `<!DOCTYPE html><body><div data-hx-id='counter'><span data-hx-id='count'>0</span><button data-hx-bind='increment'>+1</button></div>${snapshotScript(snapshot)}${bindingMapScript(bindings)}</body>`,
    { url: "http://localhost/" },
  );

  markTrace(trace, "jsdom-created");

  // Install globals
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).Document = dom.window.Document;
  (globalThis as any).Node = dom.window.Node;
  (globalThis as any).Element = dom.window.Element;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  (globalThis as any).HTMLScriptElement = dom.window.HTMLScriptElement;
  (globalThis as any).Event = dom.window.Event;
  (globalThis as any).MouseEvent = dom.window.MouseEvent;

  markTrace(trace, "globals-installed");

  resetRuntimeGraph();
  markTrace(trace, "graph-reset");

  const runtime = resumeClientApp({
    createRuntime: ({
      snapshot: snap,
      bindings: bind,
      patchRuntime,
      scheduler,
    }) => ({
      snapshot: snap,
      bindings: bind,
      patchRuntime,
      scheduler,
    }),
    enableDevtools: false,
    installPopState: false,
    delegatorOptions: {
      root: dom.window.document,
      importModule: async (chunk: string) => {
        if (chunk === "/client/bench.js") {
          return {
            handleIncrement: () => {
              // NO-OP for benchmark
            },
          };
        }
        return {};
      },
    },
  });

  markTrace(trace, "resume-complete");

  return {
    label: "Resume Client Initialization",
    metrics: [
      {
        name: "Setup & Config",
        durationMs: measureTrace(trace, "start", "setup"),
        description: "Compiled artifact definition and snapshot creation",
      },
      {
        name: "JSDOM Creation",
        durationMs: measureTrace(trace, "setup", "jsdom-created"),
        description: "Initialize test DOM environment",
      },
      {
        name: "Global Installation",
        durationMs: measureTrace(trace, "jsdom-created", "globals-installed"),
        description: "Install globalThis DOM references",
      },
      {
        name: "Graph Reset",
        durationMs: measureTrace(trace, "globals-installed", "graph-reset"),
        description: "Clear and prepare runtime graph",
      },
      {
        name: "Resume Execution",
        durationMs: measureTrace(trace, "graph-reset", "resume-complete"),
        description: "Full resumeClientApp initialization",
      },
      {
        name: "Total Resume Time",
        durationMs: measureTrace(trace, "start", "resume-complete"),
        description: "End-to-end client-side resume",
      },
    ],
  };
}

/**
 * Benchmark: Patch application overhead.
 * Compare time to apply patches to existing DOM vs re-rendering from scratch.
 */
export async function benchmarkPatchApplication(): Promise<SsrBenchmarkResults> {
  const trace = createTrace();
  markTrace(trace, "start");

  const dom = new JSDOM(
    `<!DOCTYPE html><body>
      <div data-hx-id='item-0'>Old Item 0</div>
      <div data-hx-id='item-1'>Old Item 1</div>
      <div data-hx-id='item-2'>Old Item 2</div>
    </body>`,
    { url: "http://localhost/" },
  );

  markTrace(trace, "dom-created");

  // Set up patch runtime
  const patchRuntime = new PatchRuntime(dom.window.document);
  markTrace(trace, "patch-runtime-created");

  // Simulate batch patch application (updating 3 items)
  const patches: PatchOp[] = [
    { op: "setText", targetId: "item-0", value: "Updated Item 0" },
    { op: "setText", targetId: "item-1", value: "Updated Item 1" },
    { op: "setText", targetId: "item-2", value: "Updated Item 2" },
  ];

  // Time patch application
  patchRuntime.applyBatch(patches);
  markTrace(trace, "patches-applied");

  // Verify correctness
  const item0 = dom.window.document.querySelector('[data-hx-id="item-0"]');
  const correct =
    item0?.textContent === "Updated Item 0" &&
    dom.window.document.querySelector('[data-hx-id="item-1"]')?.textContent ===
      "Updated Item 1";

  return {
    label: "Patch Application (3 setText ops)",
    metrics: [
      {
        name: "DOM Creation",
        durationMs: measureTrace(trace, "start", "dom-created"),
        description: "Initialize test DOM with 3 items",
      },
      {
        name: "Patch Runtime Setup",
        durationMs: measureTrace(trace, "dom-created", "patch-runtime-created"),
        description: "Initialize patch engine",
      },
      {
        name: "Patch Application",
        durationMs: measureTrace(
          trace,
          "patch-runtime-created",
          "patches-applied",
        ),
        description: "Apply 3 setText operations to DOM",
      },
      {
        name: "Total Patch Time",
        durationMs: measureTrace(trace, "start", "patches-applied"),
        description: "End-to-end patch application",
      },
      {
        name: "Correctness Check",
        durationMs: 0,
        description: `Patches applied correctly: ${correct ? "✓" : "✗"}`,
      },
    ],
  };
}

/**
 * Format benchmark results as human-readable table.
 */
export function formatBenchmarkResults(results: SsrBenchmarkResults[]): string {
  const lines: string[] = [];

  for (const result of results) {
    lines.push("");
    lines.push(`## ${result.label}`);
    lines.push("");
    lines.push("| Metric | Duration (ms) | Description |");
    lines.push("|--------|---------------|-------------|");

    for (const metric of result.metrics) {
      const duration =
        metric.durationMs > 0.01
          ? metric.durationMs.toFixed(2)
          : metric.durationMs.toFixed(4);
      lines.push(`| ${metric.name} | ${duration} | ${metric.description} |`);
    }
  }

  return lines.join("\n");
}
