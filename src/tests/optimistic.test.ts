import assert from "node:assert/strict";
import test from "node:test";
import {
  withOptimistic,
  TransactionLog,
  type OptimisticRunContext,
} from "../helix/optimistic.js";
import type { PatchOp } from "../helix/types.js";
import type { ScheduledBatch } from "../helix/scheduler.js";

// ---------------------------------------------------------------------------
// Minimal test doubles
// ---------------------------------------------------------------------------

interface ScheduledEntry {
  trigger: string;
  lane: string;
  patches: PatchOp[];
}

function makeCtx(): { ctx: OptimisticRunContext; applied: ScheduledEntry[] } {
  const applied: ScheduledEntry[] = [];

  // currentBatch is set by the scheduler mock so applyBatch can tag entries
  let currentBatch: Omit<ScheduledEntry, "patches"> | null = null;

  const ctx: OptimisticRunContext = {
    patchRuntime: {
      apply(op: PatchOp) {
        applied.push({ trigger: "direct", lane: "direct", patches: [op] });
      },
      applyBatch(patches: PatchOp[]) {
        // Called by withOptimistic via scheduler's run() callback — record it.
        applied.push({
          trigger: currentBatch?.trigger ?? "unknown",
          lane: currentBatch?.lane ?? "unknown",
          patches: [...patches],
        });
      },
    } as unknown as OptimisticRunContext["patchRuntime"],

    scheduler: {
      schedule(batch: ScheduledBatch) {
        // Set currentBatch so applyBatch can tag the entry with trigger/lane
        currentBatch = { trigger: batch.trigger, lane: batch.lane };
        try {
          // Execute immediately so tests don't need to flush microtasks
          batch.run(batch.patches);
        } finally {
          currentBatch = null;
        }
      },
    } as unknown as OptimisticRunContext["scheduler"],
  };

  return { ctx, applied };
}

// ---------------------------------------------------------------------------
// withOptimistic – success path
// ---------------------------------------------------------------------------

test("withOptimistic applies optimistic patches on input lane, then confirm on success", async () => {
  const { ctx, applied } = makeCtx();

  const result = await withOptimistic(
    { id: 1 },
    {
      apply: (input) => [
        { op: "setText", targetId: "status", value: `Saving ${input.id}…` },
      ],
      rollback: (_input, _err) => [
        { op: "setText", targetId: "status", value: "" },
      ],
      confirm: (input, res: { ok: boolean }) => [
        {
          op: "setText",
          targetId: "status",
          value: res.ok ? "Saved!" : "Failed",
        },
      ],
    },
    async () => ({ ok: true }),
    ctx,
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(applied.length, 2);

  // First batch: optimistic apply on "input" lane
  assert.equal(applied[0].trigger, "optimistic:apply");
  assert.equal(applied[0].lane, "input");
  assert.equal(applied[0].patches[0].op, "setText");
  assert.equal((applied[0].patches[0] as { value: string }).value, "Saving 1…");

  // Second batch: confirm on "network" lane
  assert.equal(applied[1].trigger, "optimistic:confirm");
  assert.equal(applied[1].lane, "network");
  assert.equal((applied[1].patches[0] as { value: string }).value, "Saved!");
});

test("withOptimistic applies rollback patches on failure and re-throws", async () => {
  const { ctx, applied } = makeCtx();
  const boom = new Error("network failure");

  await assert.rejects(
    () =>
      withOptimistic(
        { id: 2 },
        {
          apply: (input) => [
            {
              op: "setAttr",
              targetId: "btn",
              name: "disabled",
              value: `${input.id}`,
            },
          ],
          rollback: () => [
            { op: "setAttr", targetId: "btn", name: "disabled", value: null },
          ],
        },
        async () => {
          throw boom;
        },
        ctx,
      ),
    (err) => err === boom,
  );

  assert.equal(applied.length, 2);
  assert.equal(applied[0].trigger, "optimistic:apply");
  assert.equal(applied[1].trigger, "optimistic:rollback");
  assert.equal(applied[1].lane, "input"); // rollback also uses input lane for immediacy

  const rollbackPatch = applied[1].patches[0] as {
    name: string;
    value: unknown;
  };
  assert.equal(rollbackPatch.name, "disabled");
  assert.equal(rollbackPatch.value, null);
});

test("withOptimistic skips confirm batch when config.confirm is omitted", async () => {
  const { ctx, applied } = makeCtx();

  await withOptimistic(
    "payload",
    {
      apply: () => [{ op: "setText", targetId: "el", value: "pending" }],
      rollback: () => [{ op: "setText", targetId: "el", value: "" }],
      // no confirm
    },
    async () => "done",
    ctx,
  );

  // Only the apply batch, no confirm
  assert.equal(applied.length, 1);
  assert.equal(applied[0].trigger, "optimistic:apply");
});

test("withOptimistic skips schedule when apply returns empty patches", async () => {
  const { ctx, applied } = makeCtx();

  await withOptimistic(
    null,
    {
      apply: () => [], // no patches
      rollback: () => [],
      confirm: () => [],
    },
    async () => "noop",
    ctx,
  );

  assert.equal(applied.length, 0);
});

test("withOptimistic forwards the resolved value to the caller", async () => {
  const { ctx } = makeCtx();

  const value = await withOptimistic(
    42,
    { apply: () => [], rollback: () => [] },
    async (n) => n * 2,
    ctx,
  );

  assert.equal(value, 84);
});

// ---------------------------------------------------------------------------
// TransactionLog
// ---------------------------------------------------------------------------

test("TransactionLog getRollbackOps returns entries in reverse insertion order", () => {
  const log = new TransactionLog();
  log.record({ op: "setText", targetId: "a", value: "first" });
  log.record({ op: "setText", targetId: "b", value: "second" });
  log.record({ op: "setText", targetId: "c", value: "third" });

  const ops = log.getRollbackOps();
  assert.equal(ops.length, 3);
  assert.equal((ops[0] as { targetId: string }).targetId, "c");
  assert.equal((ops[1] as { targetId: string }).targetId, "b");
  assert.equal((ops[2] as { targetId: string }).targetId, "a");
});

test("TransactionLog clear empties all recorded entries", () => {
  const log = new TransactionLog();
  log.record({ op: "setText", targetId: "x", value: "v" });
  log.clear();
  assert.deepEqual(log.getRollbackOps(), []);
});

test("TransactionLog rollback applies ops via PatchRuntime and clears entries", () => {
  const applied: PatchOp[] = [];
  const runtime = {
    apply(op: PatchOp) {
      applied.push(op);
    },
  } as unknown as OptimisticRunContext["patchRuntime"];

  const log = new TransactionLog();
  log.record({ op: "setText", targetId: "z", value: "old" });
  log.rollback(runtime);

  assert.equal(applied.length, 1);
  assert.deepEqual(log.getRollbackOps(), []); // cleared after rollback
});

test("TransactionLog record is chainable", () => {
  const log = new TransactionLog();
  const ret = log
    .record({ op: "setText", targetId: "a", value: "v1" })
    .record({ op: "setText", targetId: "b", value: "v2" });

  assert.ok(ret === log); // returns this
  assert.equal(log.getRollbackOps().length, 2);
});
