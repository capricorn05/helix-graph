import type { CausalTraceEntry, Lane, PatchOp } from "./types.js";

const LANE_ORDER: Lane[] = ["input", "animation", "viewport", "network", "idle"];

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export interface ScheduledBatch {
  trigger: string;
  lane: Lane;
  nodes: string[];
  patches: PatchOp[];
  run: (patches: PatchOp[]) => void;
}

export class HelixScheduler {
  private readonly queues: Map<Lane, ScheduledBatch[]> = new Map(
    LANE_ORDER.map((lane) => [lane, []])
  );

  private readonly traces: CausalTraceEntry[] = [];
  private flushing = false;
  private readonly sliceBudgetMs: number;
  private readonly maxTraceEntries: number;

  constructor(sliceBudgetMs = 4, maxTraceEntries = 500) {
    this.sliceBudgetMs = sliceBudgetMs;
    this.maxTraceEntries = Math.max(1, Math.floor(maxTraceEntries));
  }

  schedule(batch: ScheduledBatch): void {
    this.queues.get(batch.lane)?.push(batch);
    this.requestFlush();
  }

  getTraces(): readonly CausalTraceEntry[] {
    return this.traces;
  }

  private requestFlush(): void {
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    queueMicrotask(() => this.flush());
  }

  private flush(): void {
    const start = now();

    while (true) {
      const nextBatch = this.dequeueNext();
      if (!nextBatch) {
        this.flushing = false;
        return;
      }

      const batchStart = now();
      nextBatch.run(nextBatch.patches);
      const batchDuration = now() - batchStart;
      this.traces.push({
        trigger: nextBatch.trigger,
        lane: nextBatch.lane,
        patches: nextBatch.patches.length,
        durationMs: Number(batchDuration.toFixed(3)),
        nodes: nextBatch.nodes,
        at: Date.now()
      });
      if (this.traces.length > this.maxTraceEntries) {
        this.traces.splice(0, this.traces.length - this.maxTraceEntries);
      }

      if (now() - start >= this.sliceBudgetMs) {
        setTimeout(() => this.flush(), 0);
        return;
      }
    }
  }

  private dequeueNext(): ScheduledBatch | undefined {
    for (const lane of LANE_ORDER) {
      const queue = this.queues.get(lane);
      if (queue && queue.length > 0) {
        return queue.shift();
      }
    }
    return undefined;
  }
}