import { reconcileKeyed } from "../../helix/reconciler.js";
import type { Lane, PatchOp } from "../../helix/types.js";
import { HelixClientHandlerContext, HelixClientRuntime } from "./runtime.js";
import {
  parseNumeric,
  schedulePatchBatch,
  scheduleReactivePatches,
} from "./actions-shared.js";

interface PostRow {
  id: number;
  userId: number;
  title: string;
  body: string;
}

interface PostsApiResponse {
  rows: PostRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const postsRuntimeReactivityInstalled = new WeakSet<HelixClientRuntime>();

function installPostsRuntimeStateReactivity(runtime: HelixClientRuntime): void {
  if (postsRuntimeReactivityInstalled.has(runtime)) {
    return;
  }

  postsRuntimeReactivityInstalled.add(runtime);

  runtime.postsDerived.pageLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "posts-state:page-label", [
      { op: "setText", targetId: "posts-page-label", value },
    ]);
  });

  runtime.postsDerived.totalLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "posts-state:total-label", [
      { op: "setText", targetId: "posts-total-label", value },
    ]);
  });

  runtime.postsDerived.prevDisabled.subscribe((disabled) => {
    scheduleReactivePatches(runtime, "posts-state:prev-disabled", [
      {
        op: "setAttr",
        targetId: "posts-prev-btn",
        name: "disabled",
        value: disabled ? "disabled" : null,
      },
    ]);
  });

  runtime.postsDerived.nextDisabled.subscribe((disabled) => {
    scheduleReactivePatches(runtime, "posts-state:next-disabled", [
      {
        op: "setAttr",
        targetId: "posts-next-btn",
        name: "disabled",
        value: disabled ? "disabled" : null,
      },
    ]);
  });

  runtime.postsStateCell.subscribe((state) => {
    scheduleReactivePatches(runtime, "posts-state:attrs", [
      {
        op: "setAttr",
        targetId: "posts-page-state",
        name: "data-page",
        value: String(state.page),
      },
      {
        op: "setAttr",
        targetId: "posts-page-state",
        name: "data-page-size",
        value: String(state.pageSize),
      },
      {
        op: "setAttr",
        targetId: "posts-page-state",
        name: "data-total",
        value: String(state.total),
      },
      {
        op: "setAttr",
        targetId: "posts-page-state",
        name: "data-total-pages",
        value: String(state.totalPages),
      },
    ]);
  });
}

export function syncPostsStateFromDom(runtime: HelixClientRuntime): void {
  installPostsRuntimeStateReactivity(runtime);

  const stateElement = document.querySelector(
    '[data-hx-id="posts-page-state"]',
  );
  if (!(stateElement instanceof HTMLElement)) {
    return;
  }

  runtime.postsState = {
    page: Math.max(
      1,
      Math.floor(
        parseNumeric(stateElement.dataset.page, runtime.postsState.page),
      ),
    ),
    pageSize: Math.max(
      1,
      Math.floor(
        parseNumeric(
          stateElement.dataset.pageSize,
          runtime.postsState.pageSize,
        ),
      ),
    ),
    total: Math.max(
      0,
      Math.floor(
        parseNumeric(stateElement.dataset.total, runtime.postsState.total),
      ),
    ),
    totalPages: Math.max(
      1,
      Math.floor(
        parseNumeric(
          stateElement.dataset.totalPages,
          runtime.postsState.totalPages,
        ),
      ),
    ),
  };
}

function createPostRowNode(key: string): Node {
  const id = Number(key);
  const row = document.createElement("tr");
  row.setAttribute("data-hx-key", String(id));

  const idCell = document.createElement("td");
  idCell.setAttribute("data-hx-id", `post-row-${id}-id`);
  row.appendChild(idCell);

  const userIdCell = document.createElement("td");
  userIdCell.setAttribute("data-hx-id", `post-row-${id}-userId`);
  row.appendChild(userIdCell);

  const titleCell = document.createElement("td");
  titleCell.setAttribute("data-hx-id", `post-row-${id}-title`);
  row.appendChild(titleCell);

  const bodyCell = document.createElement("td");
  bodyCell.setAttribute("data-hx-id", `post-row-${id}-body`);
  row.appendChild(bodyCell);

  return row;
}

function applyPostsPage(
  runtime: HelixClientRuntime,
  postsPage: PostsApiResponse,
  trigger: string,
  lane: Lane,
): void {
  installPostsRuntimeStateReactivity(runtime);

  runtime.postsState = {
    page: postsPage.page,
    pageSize: postsPage.pageSize,
    total: postsPage.total,
    totalPages: postsPage.totalPages,
  };

  const container = document.querySelector('[data-hx-id="posts-body"]');
  if (!(container instanceof Element)) {
    throw new Error("Missing posts container");
  }

  const nextKeys = postsPage.rows.map((row) => row.id);
  reconcileKeyed(container, nextKeys, createPostRowNode);

  const patches: PatchOp[] = [];

  for (const row of postsPage.rows) {
    patches.push(
      {
        op: "setText",
        targetId: `post-row-${row.id}-id`,
        value: String(row.id),
      },
      {
        op: "setText",
        targetId: `post-row-${row.id}-userId`,
        value: String(row.userId),
      },
      { op: "setText", targetId: `post-row-${row.id}-title`, value: row.title },
      {
        op: "setText",
        targetId: `post-row-${row.id}-body`,
        value: row.body.slice(0, 80) + (row.body.length > 80 ? "\u2026" : ""),
      },
    );
  }

  schedulePatchBatch(runtime, trigger, lane, patches, ["posts-body"]);
}

async function refreshPosts(
  runtime: HelixClientRuntime,
  page: number,
  trigger: string,
  lane: Lane,
): Promise<void> {
  const response = await fetch(`/api/posts?page=${page}`);
  if (!response.ok) {
    throw new Error(`Posts fetch failed with status ${response.status}`);
  }

  const postsPage = (await response.json()) as PostsApiResponse;
  applyPostsPage(runtime, postsPage, trigger, lane);

  window.history.replaceState({}, "", `/posts?page=${postsPage.page}`);
}

export async function onPostsPagePrev({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  syncPostsStateFromDom(runtime);

  const state = runtime.postsState;
  if (state.page <= 1) {
    return;
  }
  await refreshPosts(runtime, state.page - 1, "posts-page-prev", "network");
}

export async function onPostsPageNext({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  syncPostsStateFromDom(runtime);

  const state = runtime.postsState;
  if (state.page >= state.totalPages) {
    return;
  }
  await refreshPosts(runtime, state.page + 1, "posts-page-next", "network");
}
