import type { Cell } from "../../reactive.js";
import type { PrimitiveStateOptions } from "./types.js";

export function createControllableState<T>(options: PrimitiveStateOptions<T>): {
  get(): T;
  set(next: T): void;
} {
  const { value: controlledValue, defaultValue, onChange, cell } = options;

  // Internal state for uncontrolled mode
  let internalValue: T | undefined = defaultValue;

  // Subscription cleanup if using Cell
  let unsubscribeCell: (() => void) | undefined;

  // If cell is provided, sync with it bidirectionally
  if (cell) {
    internalValue = cell.get();
    unsubscribeCell = cell.subscribe((newValue) => {
      internalValue = newValue;
    });
  }

  return {
    get(): T {
      // Controlled: return the prop value
      if (controlledValue !== undefined) {
        return controlledValue;
      }
      // Cell mode: get from cell
      if (cell) {
        return cell.get();
      }
      // Uncontrolled: return internal state
      return internalValue as T;
    },

    set(next: T): void {
      // Controlled mode: only fire onChange, don't update internal state
      if (controlledValue !== undefined) {
        onChange?.(next);
        return;
      }

      // Cell mode: update cell (subscription will sync internalValue)
      if (cell) {
        cell.set(next);
        onChange?.(next);
        return;
      }

      // Uncontrolled mode: update internal state and fire onChange
      internalValue = next;
      onChange?.(next);
    },
  };
}
