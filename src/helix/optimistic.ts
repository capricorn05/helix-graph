/**
 * Optimistic Updates with Rollback (Section 13.3)
 *
 * Pattern:
 *   1. Apply optimistic patch ops immediately on the input lane
 *   2. Run the async action
 *   3. On success: apply confirm patches (or nothing if the normal refresh handles it)
 *   4. On failure: apply rollback patches to restore prior state + surface error
 *
 * The TransactionLog is a low-level escape hatch for cases where callers want to
 * record arbitrary rollback ops incrementally rather than computing them upfront.
 */
import type { PatchOp } from "./types.js";
import type { PatchRuntime } from "./patch.js";
import type { HelixScheduler } from "./scheduler.js";

// ---------------------------------------------------------------------------
// TransactionLog
// ---------------------------------------------------------------------------

/**
 * Records rollback patch ops so that a sequence of optimistic DOM mutations
 * can be undone in reverse order on failure.
 *
 * Usage:
 *   const log = new TransactionLog();
 *   log.record({ op: "setText", targetId: "foo", value: "previous text" });
 *   log.record({ op: "setAttr", targetId: "btn", name: "disabled", value: null });
 *   // ... apply optimistic changes ...
 *   // on failure:
 *   log.rollback(patchRuntime);
 */
export class TransactionLog {
  private readonly entries: PatchOp[] = [];

  /**
   * Record a patch op that will undo an optimistic change.
   * Should capture the *current* (pre-optimistic) state.
   */
  record(rollbackOp: PatchOp): this {
    this.entries.push(rollbackOp);
    return this;
  }

  /**
   * Returns all recorded rollback ops in reverse insertion order
   * (last change undone first).
   */
  getRollbackOps(): PatchOp[] {
    return [...this.entries].reverse();
  }

  /** Discard all recorded entries (call after a successful commit). */
  clear(): void {
    this.entries.length = 0;
  }

  /** Apply all rollback ops directly via a PatchRuntime (no scheduler). */
  rollback(patchRuntime: PatchRuntime): void {
    for (const op of this.getRollbackOps()) {
      try {
        patchRuntime.apply(op);
      } catch {
        // Best-effort — don't let a single failed rollback stop the rest.
      }
    }
    this.clear();
  }
}

// ---------------------------------------------------------------------------
// withOptimistic
// ---------------------------------------------------------------------------

/**
 * Configuration for a single optimistic action invocation.
 *
 * @template I  Action input type
 * @template O  Action output type
 */
export interface OptimisticConfig<I, O = unknown> {
  /**
   * Return the patch ops to apply immediately before the action runs.
   * These are scheduled on the `input` lane for instant feedback.
   */
  apply: (input: I) => PatchOp[];

  /**
   * Return the patch ops to apply when the action fails, in addition to any
   * cell/state rollback the caller performs.
   * Scheduled on the `input` lane so the UI snaps back immediately.
   */
  rollback: (input: I, error: unknown) => PatchOp[];

  /**
   * Optional: return patch ops to apply when the action succeeds.
   * Scheduled on the `network` lane.  Omit if the normal post-action
   * refresh (re-fetch + reconcile) already updates the UI.
   */
  confirm?: (input: I, result: O) => PatchOp[];
}

/** Minimal runtime context needed by withOptimistic. */
export interface OptimisticRunContext {
  patchRuntime: PatchRuntime;
  scheduler: HelixScheduler;
}

/**
 * Runs an async action with optimistic UI updates and automatic rollback.
 *
 * ```ts
 * const result = await withOptimistic(
 *   payload,
 *   {
 *     apply: (input) => [
 *       { op: "setText", targetId: "form-status", value: "Saving…" },
 *       { op: "setAttr", targetId: "submit-btn", name: "disabled", value: "disabled" },
 *     ],
 *     rollback: (_input, _err) => [
 *       { op: "setText", targetId: "form-status", value: "" },
 *       { op: "setAttr", targetId: "submit-btn", name: "disabled", value: null },
 *     ],
 *     confirm: (_input, _result) => [
 *       { op: "setText", targetId: "form-status", value: "Saved!" },
 *       { op: "setAttr", targetId: "submit-btn", name: "disabled", value: null },
 *     ],
 *   },
 *   (input) => fetch("/api/save", { method: "POST", body: JSON.stringify(input) }),
 *   { patchRuntime, scheduler },
 * );
 * ```
 */
export async function withOptimistic<I, O>(
  input: I,
  config: OptimisticConfig<I, O>,
  action: (input: I) => Promise<O>,
  ctx: OptimisticRunContext
): Promise<O> {
  // 1. Apply optimistic patches immediately on the highest-priority lane
  const optimisticPatches = config.apply(input);
  if (optimisticPatches.length > 0) {
    ctx.scheduler.schedule({
      trigger: "optimistic:apply",
      lane: "input",
      patches: optimisticPatches,
      nodes: [],
      run: (batch) => ctx.patchRuntime.applyBatch(batch)
    });
  }

  try {
    const result = await action(input);

    // 2. On success: apply confirm patches if provided
    if (config.confirm) {
      const confirmPatches = config.confirm(input, result);
      if (confirmPatches.length > 0) {
        ctx.scheduler.schedule({
          trigger: "optimistic:confirm",
          lane: "network",
          patches: confirmPatches,
          nodes: [],
          run: (batch) => ctx.patchRuntime.applyBatch(batch)
        });
      }
    }

    return result;
  } catch (error) {
    // 3. On failure: roll back optimistic state immediately
    const rollbackPatches = config.rollback(input, error);
    if (rollbackPatches.length > 0) {
      ctx.scheduler.schedule({
        trigger: "optimistic:rollback",
        lane: "input", // input lane = highest priority, user sees it instantly
        patches: rollbackPatches,
        nodes: [],
        run: (batch) => ctx.patchRuntime.applyBatch(batch)
      });
    }

    throw error;
  }
}
