/**
 * Drag-and-drop list reorder with optimistic UI and automatic rollback.
 *
 * Manages a `Cell<T[]>` representing the current order of a list.
 * When the user drops an item at a new position:
 *  1. The cell is updated immediately (optimistic).
 *  2. `onReorder` async callback is invoked with the new order.
 *  3. On failure the cell is reverted to the pre-drag order.
 *
 * Example:
 * ```ts
 * const dnd = createDragReorder({
 *   items: cell(userList),
 *   onReorder: async (next) => {
 *     await fetch("/api/users/reorder", { method: "POST", body: JSON.stringify(next) });
 *   },
 * });
 *
 * dnd.move(0, 3);          // move item at index 0 to index 3
 * await dnd.commit();      // apply + fire onReorder (with rollback on failure)
 * ```
 */

import { cell } from "./reactive.js";
import type { Cell } from "./reactive.js";

export interface DragReorderOptions<T> {
  /**
   * Cell holding the current ordered list. The controller reads and writes this
   * cell directly so any subscriber will react to reorders.
   */
  items: Cell<T[]>;

  /**
   * Called with the new order after a successful in-progress `commit()`.
   * If this rejects, the items cell is automatically reverted.
   */
  onReorder: (next: T[]) => Promise<void>;

  /**
   * Optional equality check to skip unnecessary commits when the order has not
   * actually changed. Defaults to reference-equality of every element.
   */
  equals?: (a: T[], b: T[]) => boolean;
}

export interface DragReorderController<T> {
  /** Cell containing the current (potentially optimistic) item order. */
  readonly items: Cell<T[]>;

  /**
   * Compute new order by moving item at `fromIndex` to `toIndex`.
   * Writes to the `items` cell immediately (optimistic).
   * Does nothing if indices are out of range or identical.
   */
  move(fromIndex: number, toIndex: number): void;

  /**
   * Call `onReorder` with the current items order.
   * On failure, reverts the `items` cell to the order before the last `move`.
   * Resolves `true` on success, `false` on failure.
   */
  commit(): Promise<boolean>;

  /**
   * Revert the `items` cell to its state before the most recent `move`.
   * Useful for cancelling a drag without firing `onReorder`.
   */
  rollback(): void;
}

function defaultEquals<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function createDragReorder<T>(
  options: DragReorderOptions<T>,
): DragReorderController<T> {
  const { items: itemsCell, onReorder } = options;
  const equals = options.equals ?? defaultEquals;

  // Snapshot of the order before the most recent optimistic move.
  let preMoveSnapshot: T[] = [...itemsCell.get()];

  return {
    items: itemsCell,

    move(fromIndex: number, toIndex: number): void {
      const current = itemsCell.get();
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return;
      }

      // Capture state before mutating (rollback target)
      preMoveSnapshot = [...current];

      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item!);

      itemsCell.set(next);
    },

    rollback(): void {
      itemsCell.set(preMoveSnapshot);
    },

    async commit(): Promise<boolean> {
      const committed = itemsCell.get();

      // No-op if nothing actually changed
      if (equals(committed, preMoveSnapshot)) {
        return true;
      }

      try {
        await onReorder(committed);
        // Success — update snapshot to the committed order
        preMoveSnapshot = [...committed];
        return true;
      } catch {
        // Failure — revert items cell to pre-move state
        itemsCell.set(preMoveSnapshot);
        return false;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Utility: reorder an array by moving fromIndex → toIndex (non-mutating)
// ---------------------------------------------------------------------------

export function reorderArray<T>(
  arr: readonly T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= arr.length ||
    toIndex >= arr.length
  ) {
    return [...arr];
  }

  const next = [...arr];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item!);
  return next;
}
