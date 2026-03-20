import { cell } from "../../helix/reactive.js";
import type { Cell } from "../../helix/reactive.js";
import { createDragReorder } from "../../helix/drag-reorder.js";

interface ReorderPostsRequest {
  page: number;
  rowIds: number[];
}

interface ReorderPostsResponse {
  ok: boolean;
}

interface PostsReorderMount {
  container: HTMLElement;
  orderCell: Cell<number[]>;
  dispose: () => void;
  controller: ReturnType<typeof createDragReorder<number>>;
}

let postsReorderMount: PostsReorderMount | null = null;
let draggingPostId: number | null = null;
let draggingRow: HTMLElement | null = null;

function setPostsReorderStatus(value: string): void {
  const statusEl = document.querySelector('[data-hx-id="posts-reorder-status"]');
  if (statusEl instanceof HTMLElement) {
    statusEl.textContent = value;
  }
}

function readPostsRowIds(container: HTMLElement): number[] {
  const rows = container.querySelectorAll<HTMLElement>("tr[data-post-id]");
  const ids: number[] = [];

  for (const row of rows) {
    row.draggable = true;
    const id = Number(row.dataset.postId ?? "");
    if (!Number.isFinite(id) || id <= 0) {
      continue;
    }
    ids.push(id);
  }

  return ids;
}

function applyPostsOrder(container: HTMLElement, orderedIds: readonly number[]): void {
  const rowById = new Map<number, HTMLElement>();
  for (const row of container.querySelectorAll<HTMLElement>("tr[data-post-id]")) {
    const id = Number(row.dataset.postId ?? "");
    if (!Number.isFinite(id) || id <= 0) {
      continue;
    }
    rowById.set(id, row);
  }

  for (const id of orderedIds) {
    const row = rowById.get(id);
    if (!row) {
      continue;
    }
    container.appendChild(row);
  }
}

function sameNumericOrder(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function syncPostsOrderFromDom(mount: PostsReorderMount): void {
  const domOrder = readPostsRowIds(mount.container);
  if (sameNumericOrder(domOrder, mount.orderCell.get())) {
    return;
  }

  mount.orderCell.set(domOrder);
}

function resolvePostsPageFromDom(): number {
  const stateEl = document.querySelector('[data-hx-id="posts-page-state"]');
  if (!(stateEl instanceof HTMLElement)) {
    return 1;
  }

  const page = Number(stateEl.dataset.page ?? "1");
  if (!Number.isFinite(page) || page <= 0) {
    return 1;
  }

  return Math.floor(page);
}

async function persistPostsOrder(nextOrder: number[]): Promise<void> {
  const requestBody: ReorderPostsRequest = {
    page: resolvePostsPageFromDom(),
    rowIds: nextOrder,
  };

  const response = await fetch("/actions/reorder-posts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Reorder failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ReorderPostsResponse;
  if (!payload.ok) {
    throw new Error("Reorder request did not succeed");
  }
}

function destroyPostsReorderMount(mount: PostsReorderMount | null): void {
  if (!mount) {
    return;
  }

  mount.dispose();
}

function ensurePostsReorderMount(): PostsReorderMount | null {
  const container = document.querySelector('[data-hx-id="posts-body"]');
  if (!(container instanceof HTMLElement)) {
    destroyPostsReorderMount(postsReorderMount);
    postsReorderMount = null;
    return null;
  }

  if (
    postsReorderMount &&
    postsReorderMount.container.isConnected &&
    postsReorderMount.container === container
  ) {
    return postsReorderMount;
  }

  destroyPostsReorderMount(postsReorderMount);

  const initialOrder = readPostsRowIds(container);
  const orderCell = cell<number[]>(initialOrder, {
    scope: "view",
    name: "posts-reorder-order",
    clientOnly: true,
    serializable: false,
  });

  const controller = createDragReorder<number>({
    items: orderCell,
    onReorder: persistPostsOrder,
  });

  const unsubscribe = orderCell.subscribe((nextOrder) => {
    applyPostsOrder(container, nextOrder);
  });

  postsReorderMount = {
    container,
    orderCell,
    controller,
    dispose: () => {
      unsubscribe();
    },
  };

  setPostsReorderStatus("Drag rows to reorder posts on this page.");
  return postsReorderMount;
}

function resolveDraggedRow(event: Event): HTMLElement | null {
  if (!(event.target instanceof Element)) {
    return null;
  }

  const row = event.target.closest("tr[data-post-id]");
  return row instanceof HTMLElement ? row : null;
}

function isRowInPostsContainer(row: HTMLElement, mount: PostsReorderMount): boolean {
  return row.closest('[data-hx-id="posts-body"]') === mount.container;
}

function initializePostsReorderEnhancement(): void {
  document.addEventListener("dragstart", (event) => {
    const row = resolveDraggedRow(event);
    if (!row) {
      return;
    }

    const mount = ensurePostsReorderMount();
    if (!mount || !isRowInPostsContainer(row, mount)) {
      return;
    }

    syncPostsOrderFromDom(mount);

    const rowId = Number(row.dataset.postId ?? "");
    if (!Number.isFinite(rowId) || rowId <= 0) {
      return;
    }

    draggingPostId = rowId;
    draggingRow = row;
    row.classList.add("posts-row--dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(rowId));
    }

    setPostsReorderStatus("Reordering posts...");
  });

  document.addEventListener("dragover", (event) => {
    const row = resolveDraggedRow(event);
    if (!row || draggingPostId === null) {
      return;
    }

    const mount = ensurePostsReorderMount();
    if (!mount || !isRowInPostsContainer(row, mount)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  });

  document.addEventListener("drop", (event) => {
    const row = resolveDraggedRow(event);
    if (!row || draggingPostId === null) {
      return;
    }

    const mount = ensurePostsReorderMount();
    if (!mount || !isRowInPostsContainer(row, mount)) {
      return;
    }

    event.preventDefault();
    syncPostsOrderFromDom(mount);

    const targetRowId = Number(row.dataset.postId ?? "");
    if (!Number.isFinite(targetRowId) || targetRowId <= 0) {
      return;
    }

    const currentOrder = mount.orderCell.get();
    const fromIndex = currentOrder.indexOf(draggingPostId);
    const toIndex = currentOrder.indexOf(targetRowId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }

    mount.controller.move(fromIndex, toIndex);
    setPostsReorderStatus("Saving post order...");

    void mount.controller
      .commit()
      .then((success) => {
        if (success) {
          setPostsReorderStatus("Post order saved.");
          return;
        }

        setPostsReorderStatus(
          "Could not save post order. Previous order restored.",
        );
      })
      .catch(() => {
        mount.controller.rollback();
        setPostsReorderStatus(
          "Could not save post order. Previous order restored.",
        );
      });
  });

  document.addEventListener("dragend", () => {
    if (draggingRow) {
      draggingRow.classList.remove("posts-row--dragging");
    }
    draggingRow = null;
    draggingPostId = null;
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const btn = event.target.closest<HTMLElement>("button[data-reorder-dir][data-post-id]");
    if (!btn) {
      return;
    }

    const mount = ensurePostsReorderMount();
    if (!mount || !isRowInPostsContainer(btn, mount)) {
      return;
    }

    syncPostsOrderFromDom(mount);

    const postId = Number(btn.dataset.postId ?? "");
    if (!Number.isFinite(postId) || postId <= 0) {
      return;
    }

    const dir = btn.dataset.reorderDir;
    if (dir !== "up" && dir !== "down") {
      return;
    }

    const currentOrder = mount.orderCell.get();
    const fromIndex = currentOrder.indexOf(postId);
    if (fromIndex < 0) {
      return;
    }

    const toIndex = dir === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= currentOrder.length) {
      return;
    }

    mount.controller.move(fromIndex, toIndex);
    setPostsReorderStatus("Saving post order...");

    void mount.controller
      .commit()
      .then((success) => {
        if (success) {
          setPostsReorderStatus("Post order saved.");
          return;
        }

        setPostsReorderStatus(
          "Could not save post order. Previous order restored.",
        );
      })
      .catch(() => {
        mount.controller.rollback();
        setPostsReorderStatus(
          "Could not save post order. Previous order restored.",
        );
      });
  });

  ensurePostsReorderMount();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => {
      initializePostsReorderEnhancement();
    });
  } else {
    initializePostsReorderEnhancement();
  }
}
