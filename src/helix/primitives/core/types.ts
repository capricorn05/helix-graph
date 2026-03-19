import type { Cell } from "../../reactive.js";

export type PrimitivePlacement =
  | "top"
  | "top-start"
  | "top-end"
  | "bottom"
  | "bottom-start"
  | "bottom-end"
  | "left"
  | "right";

export interface PrimitiveStateOptions<T> {
  value?: T;
  defaultValue?: T;
  onChange?: (next: T) => void;
  cell?: Cell<T>;
}

export interface PrimitiveController {
  destroy(): void;
}
