import { PatchRuntime } from "../../helix/patch.js";
import { HelixScheduler } from "../../helix/scheduler.js";
import type { BindingMap, GraphSnapshot, HelixEventBinding } from "../../helix/types.js";

export interface UsersClientState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortCol: "name" | "email";
  sortDir: "asc" | "desc";
}

export interface HelixClientRuntime {
  snapshot: GraphSnapshot;
  bindings: BindingMap;
  state: UsersClientState;
  patchRuntime: PatchRuntime;
  scheduler: HelixScheduler;
}

export interface HelixClientHandlerContext {
  event: Event;
  element: HTMLElement;
  binding: HelixEventBinding;
  runtime: HelixClientRuntime;
}

declare global {
  interface Window {
    __HELIX_RUNTIME__?: HelixClientRuntime;
  }
}

export function makeInitialState(snapshot: GraphSnapshot): UsersClientState {
  const cells = snapshot.cells;
  return {
    page: Number(cells.page ?? 1),
    pageSize: Number(cells.pageSize ?? 6),
    total: Number(cells.total ?? 0),
    totalPages: Number(cells.totalPages ?? 1),
    sortCol: cells.sortCol === "email" ? "email" : "name",
    sortDir: cells.sortDir === "desc" ? "desc" : "asc"
  };
}