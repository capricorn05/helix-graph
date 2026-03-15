import { reconcileKeyed } from "../../helix/reconciler.js";
import { commonValidators, HelixForm } from "../../helix/form.js";
import type { FormActionError, Lane, PatchOp } from "../../helix/types.js";
import {
  HelixClientHandlerContext,
  HelixClientRuntime,
  UsersClientState,
  makeInitialCreateUserFormState,
  makeInitialExternalDetailState,
} from "./runtime.js";

interface UserRow {
  id: number;
  name: string;
  email: string;
  status: "active" | "pending";
}

interface UsersApiResponse {
  rows: UserRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortCol: "name" | "email";
  sortDir: "asc" | "desc";
}

interface ExternalProductRow {
  id: number;
  title: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
}

interface ExternalProductsApiResponse {
  rows: ExternalProductRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ExternalProductDetailApiResponse extends ExternalProductRow {
  description: string;
  thumbnail: string;
  sourceId: number;
}

interface ExternalMediaProductRow extends ExternalProductDetailApiResponse {}

interface ExternalMediaProductsApiResponse {
  rows: ExternalMediaProductRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ExternalMediaPageState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type ExternalMediaPriceBand = "budget" | "mid" | "premium";
type ExternalMediaStockBand = "empty" | "low" | "healthy";
type ExternalMediaRatingBand = "low" | "mid" | "high";

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

type UsersPanelKind = "summary" | "reports" | "external-data" | "help";

let appNavPopstateInstalled = false;
const runtimeStateReactivityInstalled = new WeakSet<HelixClientRuntime>();

function isUsersPanelKind(value: string | undefined): value is UsersPanelKind {
  return (
    value === "summary" ||
    value === "reports" ||
    value === "external-data" ||
    value === "help"
  );
}

function isPrimaryNavigationEvent(event: Event): boolean {
  if (!(event instanceof MouseEvent)) {
    return true;
  }

  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function parseNumeric(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function getExternalMediaPriceBand(price: number): ExternalMediaPriceBand {
  if (price >= 120) {
    return "premium";
  }

  if (price <= 30) {
    return "budget";
  }

  return "mid";
}

function getExternalMediaStockBand(stock: number): ExternalMediaStockBand {
  if (stock <= 0) {
    return "empty";
  }

  if (stock <= 15) {
    return "low";
  }

  return "healthy";
}

function getExternalMediaRatingBand(rating: number): ExternalMediaRatingBand {
  if (rating >= 4.5) {
    return "high";
  }

  if (rating < 3.8) {
    return "low";
  }

  return "mid";
}

function getExternalMediaPriceLabel(band: ExternalMediaPriceBand): string {
  switch (band) {
    case "budget":
      return "Budget";
    case "premium":
      return "Premium";
    default:
      return "Standard";
  }
}

function getExternalMediaStockLabel(band: ExternalMediaStockBand): string {
  switch (band) {
    case "empty":
      return "Out";
    case "low":
      return "Low";
    default:
      return "Ready";
  }
}

function getExternalMediaRatingLabel(band: ExternalMediaRatingBand): string {
  switch (band) {
    case "high":
      return "Top";
    case "low":
      return "Risk";
    default:
      return "Solid";
  }
}

function formatExternalMediaRatingStars(rating: number): string {
  const safeRating = Math.max(0, Math.min(5, rating));
  const filledStars = Math.max(0, Math.min(5, Math.round(safeRating)));
  return `${"★".repeat(filledStars)}${"☆".repeat(5 - filledStars)}`;
}

function truncateExternalMediaTitleForCell(title: string): string {
  const limit = 52;
  if (title.length <= limit) {
    return title;
  }

  return `${title.slice(0, limit - 1)}…`;
}

function normalizeNavPath(pathname: string): string {
  if (pathname === "/users" || pathname.startsWith("/users/")) {
    return "/";
  }
  return pathname;
}

function updateActiveAdminNav(pathname: string): void {
  const normalizedPath = normalizeNavPath(pathname);

  for (const link of document.querySelectorAll("[data-nav-link]")) {
    if (!(link instanceof HTMLAnchorElement)) {
      continue;
    }

    const linkPath = link.dataset.navPath ?? "";
    const active = linkPath === normalizedPath;

    link.classList.toggle("is-active", active);
    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

function syncUsersStateFromDom(runtime: HelixClientRuntime): void {
  installRuntimeStateReactivity(runtime);

  const stateElement = document.querySelector(
    '[data-hx-id="users-page-state"]',
  );
  if (!(stateElement instanceof HTMLElement)) {
    return;
  }

  const sortCol = stateElement.dataset.sortCol === "email" ? "email" : "name";
  const sortDir = stateElement.dataset.sortDir === "desc" ? "desc" : "asc";

  runtime.state = {
    page: Math.max(
      1,
      Math.floor(parseNumeric(stateElement.dataset.page, runtime.state.page)),
    ),
    pageSize: Math.max(
      1,
      Math.floor(
        parseNumeric(stateElement.dataset.pageSize, runtime.state.pageSize),
      ),
    ),
    total: Math.max(
      0,
      Math.floor(parseNumeric(stateElement.dataset.total, runtime.state.total)),
    ),
    totalPages: Math.max(
      1,
      Math.floor(
        parseNumeric(stateElement.dataset.totalPages, runtime.state.totalPages),
      ),
    ),
    sortCol,
    sortDir,
  };
}

function syncPostsStateFromDom(runtime: HelixClientRuntime): void {
  installRuntimeStateReactivity(runtime);

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

function syncExternalStateFromDom(runtime: HelixClientRuntime): void {
  installRuntimeStateReactivity(runtime);

  const stateElement = document.querySelector(
    '[data-hx-id="external-page-state"]',
  );
  if (!(stateElement instanceof HTMLElement)) {
    return;
  }

  runtime.externalState = {
    page: Math.max(
      1,
      Math.floor(
        parseNumeric(stateElement.dataset.page, runtime.externalState.page),
      ),
    ),
    pageSize: Math.max(
      1,
      Math.floor(
        parseNumeric(
          stateElement.dataset.pageSize,
          runtime.externalState.pageSize,
        ),
      ),
    ),
    total: Math.max(
      0,
      Math.floor(
        parseNumeric(stateElement.dataset.total, runtime.externalState.total),
      ),
    ),
    totalPages: Math.max(
      1,
      Math.floor(
        parseNumeric(
          stateElement.dataset.totalPages,
          runtime.externalState.totalPages,
        ),
      ),
    ),
  };
}

function readExternalMediaStateFromDom(): ExternalMediaPageState | null {
  const stateElement = document.querySelector(
    '[data-hx-id="external-media-page-state"]',
  );
  if (!(stateElement instanceof HTMLElement)) {
    return null;
  }

  return {
    page: Math.max(1, Math.floor(parseNumeric(stateElement.dataset.page, 1))),
    pageSize: Math.max(
      1,
      Math.floor(parseNumeric(stateElement.dataset.pageSize, 30)),
    ),
    total: Math.max(0, Math.floor(parseNumeric(stateElement.dataset.total, 0))),
    totalPages: Math.max(
      1,
      Math.floor(parseNumeric(stateElement.dataset.totalPages, 1)),
    ),
  };
}

function syncExternalDetailStateFromDom(runtime: HelixClientRuntime): void {
  installRuntimeStateReactivity(runtime);

  const overlay = document.querySelector(
    '[data-hx-id="external-modal-overlay"]',
  );
  if (!(overlay instanceof HTMLElement)) {
    return;
  }

  runtime.externalDetail = makeInitialExternalDetailState();
}

function syncCreateUserFormStateFromDom(runtime: HelixClientRuntime): void {
  installRuntimeStateReactivity(runtime);

  const form = document.querySelector('[data-hx-id="create-user-form"]');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  runtime.createUserForm = makeInitialCreateUserFormState();
}

function syncRuntimeStateFromDom(runtime: HelixClientRuntime): void {
  installRuntimeStateReactivity(runtime);
  syncUsersStateFromDom(runtime);
  syncPostsStateFromDom(runtime);
  syncExternalStateFromDom(runtime);
  syncExternalDetailStateFromDom(runtime);
  syncCreateUserFormStateFromDom(runtime);
}

async function loadAdminCore(
  runtime: HelixClientRuntime,
  path: string,
  pushHistory: boolean,
): Promise<void> {
  const targetUrl = new URL(path, window.location.origin);
  const core = document.querySelector('[data-hx-id="app-core"]');
  const coreTitle = document.querySelector('[data-hx-id="app-core-title"]');

  if (!(core instanceof HTMLElement)) {
    window.location.assign(targetUrl.toString());
    return;
  }

  core.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(
      `/components/app-core?path=${encodeURIComponent(`${targetUrl.pathname}${targetUrl.search}`)}`,
    );
    if (!response.ok) {
      throw new Error(
        `Core content fetch failed with status ${response.status}`,
      );
    }

    const html = await response.text();
    core.innerHTML = html;

    const title = response.headers.get("x-helix-title");
    if (title) {
      document.title = title;
      if (coreTitle instanceof HTMLElement) {
        coreTitle.textContent = title;
      }
    }

    if (pushHistory) {
      window.history.pushState({}, "", targetUrl.toString());
    }

    updateActiveAdminNav(targetUrl.pathname);
    syncRuntimeStateFromDom(runtime);
  } finally {
    core.removeAttribute("aria-busy");
  }
}

function installAppNavPopstate(runtime: HelixClientRuntime): void {
  if (appNavPopstateInstalled) {
    return;
  }

  appNavPopstateInstalled = true;
  window.addEventListener("popstate", () => {
    if (
      window.location.pathname === "/host-listings" &&
      document.querySelector('[data-hx-id="host-listings-root"]') instanceof
        HTMLElement
    ) {
      return;
    }

    const currentPath = `${window.location.pathname}${window.location.search}`;
    void loadAdminCore(runtime, currentPath, false).catch((error: unknown) => {
      console.error("[Helix] app-nav popstate error", error);
    });
  });
}

async function loadUsersPanel(
  runtime: HelixClientRuntime,
  panel: UsersPanelKind,
): Promise<void> {
  const container = document.querySelector('[data-hx-id="users-live-panel"]');
  if (!(container instanceof HTMLElement)) {
    throw new Error("Missing users live panel container");
  }

  container.innerHTML = "<p>Loading panel…</p>";

  const params = new URLSearchParams({
    panel,
    page: String(runtime.state.page),
    sortCol: runtime.state.sortCol,
    sortDir: runtime.state.sortDir,
  });

  if (panel === "external-data") {
    syncExternalStateFromDom(runtime);
    params.set("externalPage", String(runtime.externalState.page));
  }

  const response = await fetch(`/components/users-panel?${params.toString()}`);
  if (!response.ok) {
    container.innerHTML = `<p class="error">Could not load panel (${response.status}).</p>`;
    return;
  }

  container.innerHTML = await response.text();

  if (panel === "external-data") {
    syncExternalStateFromDom(runtime);
    syncExternalDetailStateFromDom(runtime);
  }
}

function schedulePatchBatch(
  runtime: HelixClientRuntime,
  trigger: string,
  lane: Lane,
  patches: PatchOp[],
  nodes: string[],
): void {
  runtime.scheduler.schedule({
    trigger,
    lane,
    patches,
    nodes,
    run: (batch) => runtime.patchRuntime.applyBatch(batch),
  });
}

function hasPatchTarget(targetId: string): boolean {
  return (
    document.querySelector(`[data-hx-id="${targetId}"]`) instanceof Element
  );
}

function scheduleReactivePatches(
  runtime: HelixClientRuntime,
  trigger: string,
  patches: PatchOp[],
): void {
  const presentPatches = patches.filter((patch) =>
    hasPatchTarget(patch.targetId),
  );
  if (presentPatches.length === 0) {
    return;
  }

  schedulePatchBatch(
    runtime,
    trigger,
    "input",
    presentPatches,
    Array.from(new Set(presentPatches.map((patch) => patch.targetId))),
  );
}

function installRuntimeStateReactivity(runtime: HelixClientRuntime): void {
  if (runtimeStateReactivityInstalled.has(runtime)) {
    return;
  }

  runtimeStateReactivityInstalled.add(runtime);

  runtime.derived.pageLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "users-state:page-label", [
      { op: "setText", targetId: "page-label", value },
    ]);
  });

  runtime.derived.prevDisabled.subscribe((disabled) => {
    scheduleReactivePatches(runtime, "users-state:prev-disabled", [
      {
        op: "setAttr",
        targetId: "prev-btn",
        name: "disabled",
        value: disabled ? "disabled" : null,
      },
    ]);
  });

  runtime.derived.nextDisabled.subscribe((disabled) => {
    scheduleReactivePatches(runtime, "users-state:next-disabled", [
      {
        op: "setAttr",
        targetId: "next-btn",
        name: "disabled",
        value: disabled ? "disabled" : null,
      },
    ]);
  });

  runtime.derived.sortNameIndicator.subscribe((value) => {
    scheduleReactivePatches(runtime, "users-state:sort-name-indicator", [
      { op: "setText", targetId: "sort-name-indicator", value },
    ]);
  });

  runtime.derived.sortEmailIndicator.subscribe((value) => {
    scheduleReactivePatches(runtime, "users-state:sort-email-indicator", [
      { op: "setText", targetId: "sort-email-indicator", value },
    ]);
  });

  runtime.stateCell.subscribe((state) => {
    scheduleReactivePatches(runtime, "users-state:attrs", [
      {
        op: "setAttr",
        targetId: "users-page-state",
        name: "data-page",
        value: String(state.page),
      },
      {
        op: "setAttr",
        targetId: "users-page-state",
        name: "data-page-size",
        value: String(state.pageSize),
      },
      {
        op: "setAttr",
        targetId: "users-page-state",
        name: "data-total",
        value: String(state.total),
      },
      {
        op: "setAttr",
        targetId: "users-page-state",
        name: "data-total-pages",
        value: String(state.totalPages),
      },
      {
        op: "setAttr",
        targetId: "users-page-state",
        name: "data-sort-col",
        value: state.sortCol,
      },
      {
        op: "setAttr",
        targetId: "users-page-state",
        name: "data-sort-dir",
        value: state.sortDir,
      },
    ]);
  });

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

  runtime.externalDerived.pageLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-state:page-label", [
      { op: "setText", targetId: "external-page-label", value },
    ]);
  });

  runtime.externalDerived.totalLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-state:total-label", [
      { op: "setText", targetId: "external-total-label", value },
    ]);
  });

  runtime.externalDerived.prevDisabled.subscribe((disabled) => {
    scheduleReactivePatches(runtime, "external-state:prev-disabled", [
      {
        op: "setAttr",
        targetId: "external-prev-btn",
        name: "disabled",
        value: disabled ? "disabled" : null,
      },
    ]);
  });

  runtime.externalDerived.nextDisabled.subscribe((disabled) => {
    scheduleReactivePatches(runtime, "external-state:next-disabled", [
      {
        op: "setAttr",
        targetId: "external-next-btn",
        name: "disabled",
        value: disabled ? "disabled" : null,
      },
    ]);
  });

  runtime.externalStateCell.subscribe((state) => {
    scheduleReactivePatches(runtime, "external-state:attrs", [
      {
        op: "setAttr",
        targetId: "external-page-state",
        name: "data-page",
        value: String(state.page),
      },
      {
        op: "setAttr",
        targetId: "external-page-state",
        name: "data-page-size",
        value: String(state.pageSize),
      },
      {
        op: "setAttr",
        targetId: "external-page-state",
        name: "data-total",
        value: String(state.total),
      },
      {
        op: "setAttr",
        targetId: "external-page-state",
        name: "data-total-pages",
        value: String(state.totalPages),
      },
    ]);
  });

  runtime.externalDetailStateCell.subscribe((detail) => {
    scheduleReactivePatches(runtime, "external-detail:content", [
      { op: "setText", targetId: "external-modal-title", value: detail.title },
      { op: "setText", targetId: "external-modal-brand", value: detail.brand },
      {
        op: "setText",
        targetId: "external-modal-category",
        value: detail.category,
      },
      {
        op: "setText",
        targetId: "external-modal-description",
        value: detail.description,
      },
      {
        op: "setAttr",
        targetId: "external-modal-thumbnail",
        name: "src",
        value: detail.thumbnail || null,
      },
      {
        op: "setAttr",
        targetId: "external-modal-thumbnail",
        name: "alt",
        value: detail.thumbnailAlt,
      },
    ]);
  });

  runtime.externalDetailDerived.idLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-detail:id", [
      { op: "setText", targetId: "external-modal-id", value },
    ]);
  });

  runtime.externalDetailDerived.priceLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-detail:price", [
      { op: "setText", targetId: "external-modal-price", value },
    ]);
  });

  runtime.externalDetailDerived.stockLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-detail:stock", [
      { op: "setText", targetId: "external-modal-stock", value },
    ]);
  });

  runtime.externalDetailDerived.ratingLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-detail:rating", [
      { op: "setText", targetId: "external-modal-rating", value },
    ]);
  });

  runtime.externalDetailDerived.sourceLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-detail:source", [
      { op: "setText", targetId: "external-modal-source", value },
    ]);
  });

  runtime.externalDetailDerived.overlayDisplay.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-detail:display", [
      {
        op: "setStyle",
        targetId: "external-modal-overlay",
        prop: "display",
        value,
      },
    ]);
  });

  runtime.createUserFormStateCell.subscribe((formState) => {
    scheduleReactivePatches(runtime, "create-user-form:text", [
      { op: "setText", targetId: "form-status", value: formState.status },
      { op: "setText", targetId: "error-name", value: formState.nameError },
      {
        op: "setText",
        targetId: "error-email",
        value: formState.emailError,
      },
      { op: "setText", targetId: "error-form", value: formState.formError },
    ]);
  });

  runtime.createUserFormDerived.submitDisabled.subscribe((disabled) => {
    scheduleReactivePatches(runtime, "create-user-form:submit-disabled", [
      {
        op: "setAttr",
        targetId: "submit-create",
        name: "disabled",
        value: disabled ? "disabled" : null,
      },
    ]);
  });

  runtime.createUserFormDerived.nameInvalid.subscribe((invalid) => {
    scheduleReactivePatches(runtime, "create-user-form:name-invalid", [
      {
        op: "setAttr",
        targetId: "input-name",
        name: "aria-invalid",
        value: invalid ? "true" : null,
      },
    ]);
  });

  runtime.createUserFormDerived.emailInvalid.subscribe((invalid) => {
    scheduleReactivePatches(runtime, "create-user-form:email-invalid", [
      {
        op: "setAttr",
        targetId: "input-email",
        name: "aria-invalid",
        value: invalid ? "true" : null,
      },
    ]);
  });
}

function createRowNode(key: string): Node {
  const id = Number(key);
  const row = document.createElement("tr");
  row.setAttribute("data-hx-key", String(id));

  const nameCell = document.createElement("td");
  const nameLink = document.createElement("a");
  nameLink.setAttribute("data-hx-id", `row-${id}-name`);
  nameLink.setAttribute("href", `/users/${id}`);
  nameCell.appendChild(nameLink);
  row.appendChild(nameCell);

  const emailCell = document.createElement("td");
  emailCell.setAttribute("data-hx-id", `row-${id}-email`);
  row.appendChild(emailCell);

  const statusCell = document.createElement("td");
  statusCell.setAttribute("data-hx-id", `row-${id}-status`);
  row.appendChild(statusCell);

  return row;
}

async function refreshUsers(
  runtime: HelixClientRuntime,
  trigger: string,
  lane: Lane,
): Promise<void> {
  installRuntimeStateReactivity(runtime);

  const state = runtime.state;
  const params = new URLSearchParams({
    page: String(state.page),
    sortCol: state.sortCol,
    sortDir: state.sortDir,
  });

  const response = await fetch(`/api/users?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Users fetch failed with status ${response.status}`);
  }

  const page = (await response.json()) as UsersApiResponse;
  applyUsersPage(runtime, page, trigger, lane);
}

function applyUsersPage(
  runtime: HelixClientRuntime,
  page: UsersApiResponse,
  trigger: string,
  lane: Lane,
): void {
  runtime.state = {
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    totalPages: page.totalPages,
    sortCol: page.sortCol,
    sortDir: page.sortDir,
  };

  const container = document.querySelector('[data-hx-id="users-body"]');
  if (!(container instanceof Element)) {
    throw new Error("Missing users list container");
  }

  const nextKeys = page.rows.map((row) => row.id);
  reconcileKeyed(container, nextKeys, createRowNode);

  const patches: PatchOp[] = [];

  for (const row of page.rows) {
    patches.push(
      {
        op: "setText",
        targetId: `row-${row.id}-name`,
        value: row.name,
      },
      {
        op: "setAttr",
        targetId: `row-${row.id}-name`,
        name: "href",
        value: `/users/${row.id}`,
      },
      {
        op: "setText",
        targetId: `row-${row.id}-email`,
        value: row.email,
      },
      {
        op: "setText",
        targetId: `row-${row.id}-status`,
        value: row.status,
      },
    );
  }

  schedulePatchBatch(runtime, trigger, lane, patches, ["users-body"]);
}

function createExternalProductRowNode(key: string): Node {
  const id = Number(key);
  const row = document.createElement("tr");
  row.setAttribute("data-hx-key", String(id));

  const idCell = document.createElement("td");
  idCell.setAttribute("data-hx-id", `external-row-${id}-id`);
  row.appendChild(idCell);

  const titleCell = document.createElement("td");
  titleCell.setAttribute("data-hx-id", `external-row-${id}-title`);
  row.appendChild(titleCell);

  const brandCell = document.createElement("td");
  brandCell.setAttribute("data-hx-id", `external-row-${id}-brand`);
  row.appendChild(brandCell);

  const categoryCell = document.createElement("td");
  categoryCell.setAttribute("data-hx-id", `external-row-${id}-category`);
  row.appendChild(categoryCell);

  const priceCell = document.createElement("td");
  priceCell.setAttribute("data-hx-id", `external-row-${id}-price`);
  row.appendChild(priceCell);

  const stockCell = document.createElement("td");
  stockCell.setAttribute("data-hx-id", `external-row-${id}-stock`);
  row.appendChild(stockCell);

  const ratingCell = document.createElement("td");
  ratingCell.setAttribute("data-hx-id", `external-row-${id}-rating`);
  row.appendChild(ratingCell);

  const actionCell = document.createElement("td");
  const detailButton = document.createElement("button");
  detailButton.type = "button";
  detailButton.textContent = "Details";
  detailButton.setAttribute("data-hx-id", `external-row-${id}-action`);
  detailButton.setAttribute("data-hx-bind", "external-detail-open");
  detailButton.setAttribute("data-row-id", String(id));
  actionCell.appendChild(detailButton);
  row.appendChild(actionCell);

  return row;
}

function createExternalMediaProductRowNode(key: string): Node {
  const id = Number(key);
  const row = document.createElement("tr");
  row.setAttribute("data-hx-id", `external-media-row-${id}`);
  row.setAttribute("data-hx-key", String(id));
  row.className = "external-media-row";

  const idCell = document.createElement("td");
  idCell.setAttribute("data-hx-id", `external-media-row-${id}-id`);
  row.appendChild(idCell);

  const previewCell = document.createElement("td");
  previewCell.setAttribute("data-hx-id", `external-media-row-${id}-preview`);
  previewCell.className = "external-media-preview-cell";
  const thumbWrap = document.createElement("div");
  thumbWrap.setAttribute("data-hx-id", `external-media-row-${id}-thumb-wrap`);
  thumbWrap.className = "external-media-thumb-wrap";

  const thumb = document.createElement("img");
  thumb.setAttribute("data-hx-id", `external-media-row-${id}-thumb`);
  thumb.className = "external-media-thumb";
  thumb.setAttribute("loading", "lazy");
  thumb.setAttribute("decoding", "async");
  thumb.alt = "";
  thumbWrap.appendChild(thumb);

  const thumbChip = document.createElement("span");
  thumbChip.setAttribute("data-hx-id", `external-media-row-${id}-thumb-chip`);
  thumbChip.className = "external-media-thumb-chip";
  thumbWrap.appendChild(thumbChip);
  previewCell.appendChild(thumbWrap);
  row.appendChild(previewCell);

  const titleCell = document.createElement("td");
  titleCell.setAttribute("data-hx-id", `external-media-row-${id}-title-cell`);
  const titleText = document.createElement("span");
  titleText.setAttribute("data-hx-id", `external-media-row-${id}-title`);
  titleCell.appendChild(titleText);
  row.appendChild(titleCell);

  const brandCell = document.createElement("td");
  brandCell.setAttribute("data-hx-id", `external-media-row-${id}-brand`);
  row.appendChild(brandCell);

  const categoryCell = document.createElement("td");
  categoryCell.setAttribute("data-hx-id", `external-media-row-${id}-category`);
  row.appendChild(categoryCell);

  const priceCell = document.createElement("td");
  priceCell.setAttribute("data-hx-id", `external-media-row-${id}-price`);
  const priceStack = document.createElement("div");
  priceStack.className = "external-media-cell-stack";
  const priceMain = document.createElement("span");
  priceMain.setAttribute("data-hx-id", `external-media-row-${id}-price-main`);
  priceMain.className = "external-media-main";
  priceStack.appendChild(priceMain);
  const pricePill = document.createElement("span");
  pricePill.setAttribute("data-hx-id", `external-media-row-${id}-price-pill`);
  pricePill.className = "external-media-pill";
  priceStack.appendChild(pricePill);
  priceCell.appendChild(priceStack);
  row.appendChild(priceCell);

  const stockCell = document.createElement("td");
  stockCell.setAttribute("data-hx-id", `external-media-row-${id}-stock`);
  const stockStack = document.createElement("div");
  stockStack.className = "external-media-cell-stack";
  const stockMain = document.createElement("span");
  stockMain.setAttribute("data-hx-id", `external-media-row-${id}-stock-main`);
  stockMain.className = "external-media-main";
  stockStack.appendChild(stockMain);
  const stockPill = document.createElement("span");
  stockPill.setAttribute("data-hx-id", `external-media-row-${id}-stock-pill`);
  stockPill.className = "external-media-pill";
  stockStack.appendChild(stockPill);
  stockCell.appendChild(stockStack);
  row.appendChild(stockCell);

  const ratingCell = document.createElement("td");
  ratingCell.setAttribute("data-hx-id", `external-media-row-${id}-rating`);
  const ratingStack = document.createElement("div");
  ratingStack.className = "external-media-cell-stack";
  const ratingMain = document.createElement("span");
  ratingMain.setAttribute("data-hx-id", `external-media-row-${id}-rating-main`);
  ratingMain.className = "external-media-main";
  ratingStack.appendChild(ratingMain);
  const ratingStars = document.createElement("span");
  ratingStars.setAttribute(
    "data-hx-id",
    `external-media-row-${id}-rating-stars`,
  );
  ratingStars.className = "external-media-stars";
  ratingStack.appendChild(ratingStars);
  const ratingPill = document.createElement("span");
  ratingPill.setAttribute("data-hx-id", `external-media-row-${id}-rating-pill`);
  ratingPill.className = "external-media-pill";
  ratingStack.appendChild(ratingPill);
  ratingCell.appendChild(ratingStack);
  row.appendChild(ratingCell);

  const actionCell = document.createElement("td");
  actionCell.setAttribute("data-hx-id", `external-media-row-${id}-actions`);
  const detailButton = document.createElement("button");
  detailButton.type = "button";
  detailButton.textContent = "Details";
  detailButton.className = "hx-btn hx-btn--secondary";
  detailButton.setAttribute("data-hx-id", `external-media-row-${id}-action`);
  detailButton.setAttribute("data-hx-bind", "external-media-detail-open");
  detailButton.setAttribute("data-row-id", String(id));
  actionCell.appendChild(detailButton);
  row.appendChild(actionCell);

  return row;
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
  installRuntimeStateReactivity(runtime);

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

function applyExternalProductsPage(
  runtime: HelixClientRuntime,
  productsPage: ExternalProductsApiResponse,
  trigger: string,
  lane: Lane,
): void {
  installRuntimeStateReactivity(runtime);

  runtime.externalState = {
    page: productsPage.page,
    pageSize: productsPage.pageSize,
    total: productsPage.total,
    totalPages: productsPage.totalPages,
  };
  runtime.externalDetail = makeInitialExternalDetailState();

  const container = document.querySelector(
    '[data-hx-id="external-products-body"]',
  );
  if (!(container instanceof Element)) {
    throw new Error("Missing external products container");
  }

  const nextKeys = productsPage.rows.map((row) => row.id);
  reconcileKeyed(container, nextKeys, createExternalProductRowNode);

  const patches: PatchOp[] = [];

  for (const row of productsPage.rows) {
    patches.push(
      {
        op: "setText",
        targetId: `external-row-${row.id}-id`,
        value: String(row.id),
      },
      {
        op: "setText",
        targetId: `external-row-${row.id}-title`,
        value: row.title,
      },
      {
        op: "setText",
        targetId: `external-row-${row.id}-brand`,
        value: row.brand,
      },
      {
        op: "setText",
        targetId: `external-row-${row.id}-category`,
        value: row.category,
      },
      {
        op: "setText",
        targetId: `external-row-${row.id}-price`,
        value: `$${row.price.toFixed(2)}`,
      },
      {
        op: "setText",
        targetId: `external-row-${row.id}-stock`,
        value: String(row.stock),
      },
      {
        op: "setText",
        targetId: `external-row-${row.id}-rating`,
        value: row.rating.toFixed(1),
      },
      {
        op: "setAttr",
        targetId: `external-row-${row.id}-action`,
        name: "data-row-id",
        value: String(row.id),
      },
    );
  }

  schedulePatchBatch(runtime, trigger, lane, patches, [
    "external-products-body",
  ]);
}

async function refreshExternalProducts(
  runtime: HelixClientRuntime,
  page: number,
  trigger: string,
  lane: Lane,
): Promise<void> {
  const response = await fetch(`/api/external-data?page=${page}`);
  if (!response.ok) {
    throw new Error(
      `External products fetch failed with status ${response.status}`,
    );
  }

  const productsPage = (await response.json()) as ExternalProductsApiResponse;
  applyExternalProductsPage(runtime, productsPage, trigger, lane);

  window.history.replaceState(
    {},
    "",
    `/external-data?page=${productsPage.page}`,
  );
}

function applyExternalMediaProductsPage(
  runtime: HelixClientRuntime,
  productsPage: ExternalMediaProductsApiResponse,
  trigger: string,
  lane: Lane,
): void {
  const container = document.querySelector(
    '[data-hx-id="external-media-products-body"]',
  );
  if (!(container instanceof Element)) {
    throw new Error("Missing external rich products container");
  }

  const nextKeys = productsPage.rows.map((row) => row.id);
  reconcileKeyed(container, nextKeys, createExternalMediaProductRowNode);

  const patches: PatchOp[] = [];

  for (const row of productsPage.rows) {
    const priceBand = getExternalMediaPriceBand(row.price);
    const stockBand = getExternalMediaStockBand(row.stock);
    const ratingBand = getExternalMediaRatingBand(row.rating);
    const hasThumbnail = row.thumbnail.trim().length > 0;

    patches.push(
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-id`,
        value: String(row.id),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-title`,
        value: truncateExternalMediaTitleForCell(row.title),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-brand`,
        value: row.brand,
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-category`,
        value: row.category,
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-price-main`,
        value: `$${row.price.toFixed(2)}`,
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-stock-main`,
        value: String(row.stock),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-rating-main`,
        value: row.rating.toFixed(1),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-rating-stars`,
        value: formatExternalMediaRatingStars(row.rating),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-price-pill`,
        value: getExternalMediaPriceLabel(priceBand),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-stock-pill`,
        value: getExternalMediaStockLabel(stockBand),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-thumb-chip`,
        value: getExternalMediaStockLabel(stockBand),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-rating-pill`,
        value: getExternalMediaRatingLabel(ratingBand),
      },
      {
        op: "setAttr",
        targetId: `external-media-row-${row.id}-thumb`,
        name: "src",
        value: hasThumbnail ? row.thumbnail : null,
      },
      {
        op: "setAttr",
        targetId: `external-media-row-${row.id}-thumb`,
        name: "alt",
        value: hasThumbnail ? `${row.title} thumbnail` : "No thumbnail",
      },
      {
        op: "setAttr",
        targetId: `external-media-row-${row.id}-action`,
        name: "data-row-id",
        value: String(row.id),
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--price-budget",
        enabled: priceBand === "budget",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--price-mid",
        enabled: priceBand === "mid",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--price-premium",
        enabled: priceBand === "premium",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--stock-empty",
        enabled: stockBand === "empty",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--stock-low",
        enabled: stockBand === "low",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--stock-healthy",
        enabled: stockBand === "healthy",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--rating-low",
        enabled: ratingBand === "low",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--rating-mid",
        enabled: ratingBand === "mid",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--rating-high",
        enabled: ratingBand === "high",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--missing-thumb",
        enabled: !hasThumbnail,
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-price-pill`,
        className: "external-media-pill--budget",
        enabled: priceBand === "budget",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-price-pill`,
        className: "external-media-pill--mid",
        enabled: priceBand === "mid",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-price-pill`,
        className: "external-media-pill--premium",
        enabled: priceBand === "premium",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-stock-pill`,
        className: "external-media-pill--empty",
        enabled: stockBand === "empty",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-stock-pill`,
        className: "external-media-pill--low",
        enabled: stockBand === "low",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-stock-pill`,
        className: "external-media-pill--healthy",
        enabled: stockBand === "healthy",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-thumb-chip`,
        className: "external-media-thumb-chip--empty",
        enabled: stockBand === "empty",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-thumb-chip`,
        className: "external-media-thumb-chip--low",
        enabled: stockBand === "low",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-thumb-chip`,
        className: "external-media-thumb-chip--healthy",
        enabled: stockBand === "healthy",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-rating-pill`,
        className: "external-media-pill--rating-low",
        enabled: ratingBand === "low",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-rating-pill`,
        className: "external-media-pill--rating-mid",
        enabled: ratingBand === "mid",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-rating-pill`,
        className: "external-media-pill--rating-high",
        enabled: ratingBand === "high",
      },
    );
  }

  patches.push(
    {
      op: "setText",
      targetId: "external-media-page-label",
      value: `Page ${productsPage.page} / ${productsPage.totalPages}`,
    },
    {
      op: "setText",
      targetId: "external-media-total-label",
      value: `(Total rows: ${productsPage.total})`,
    },
    {
      op: "setAttr",
      targetId: "external-media-prev-btn",
      name: "disabled",
      value: productsPage.page <= 1 ? "disabled" : null,
    },
    {
      op: "setAttr",
      targetId: "external-media-next-btn",
      name: "disabled",
      value: productsPage.page >= productsPage.totalPages ? "disabled" : null,
    },
    {
      op: "setAttr",
      targetId: "external-media-page-state",
      name: "data-page",
      value: String(productsPage.page),
    },
    {
      op: "setAttr",
      targetId: "external-media-page-state",
      name: "data-page-size",
      value: String(productsPage.pageSize),
    },
    {
      op: "setAttr",
      targetId: "external-media-page-state",
      name: "data-total",
      value: String(productsPage.total),
    },
    {
      op: "setAttr",
      targetId: "external-media-page-state",
      name: "data-total-pages",
      value: String(productsPage.totalPages),
    },
    {
      op: "setStyle",
      targetId: "external-media-modal-overlay",
      prop: "display",
      value: "none",
    },
  );

  schedulePatchBatch(runtime, trigger, lane, patches, [
    "external-media-products-body",
  ]);
}

async function refreshExternalMediaProducts(
  runtime: HelixClientRuntime,
  page: number,
  trigger: string,
  lane: Lane,
): Promise<void> {
  const response = await fetch(`/api/external-data-rich?page=${page}`);
  if (!response.ok) {
    throw new Error(
      `External rich products fetch failed with status ${response.status}`,
    );
  }

  const productsPage =
    (await response.json()) as ExternalMediaProductsApiResponse;
  applyExternalMediaProductsPage(runtime, productsPage, trigger, lane);

  window.history.replaceState(
    {},
    "",
    `/external-data-rich?page=${productsPage.page}`,
  );
}

async function openExternalMediaDetail(
  runtime: HelixClientRuntime,
  rowId: number,
): Promise<void> {
  const response = await fetch(`/api/external-data/${rowId}`);
  if (!response.ok) {
    throw new Error(
      `External detail fetch failed with status ${response.status}`,
    );
  }

  const detail = (await response.json()) as ExternalProductDetailApiResponse;

  schedulePatchBatch(
    runtime,
    "external-media-detail-open",
    "network",
    [
      {
        op: "setText",
        targetId: "external-media-modal-title",
        value: detail.title,
      },
      {
        op: "setText",
        targetId: "external-media-modal-id",
        value: String(detail.id),
      },
      {
        op: "setText",
        targetId: "external-media-modal-brand",
        value: detail.brand,
      },
      {
        op: "setText",
        targetId: "external-media-modal-category",
        value: detail.category,
      },
      {
        op: "setText",
        targetId: "external-media-modal-price",
        value: `$${detail.price.toFixed(2)}`,
      },
      {
        op: "setText",
        targetId: "external-media-modal-stock",
        value: String(detail.stock),
      },
      {
        op: "setText",
        targetId: "external-media-modal-rating",
        value: detail.rating.toFixed(1),
      },
      {
        op: "setText",
        targetId: "external-media-modal-source",
        value: `Seed Product #${detail.sourceId}`,
      },
      {
        op: "setText",
        targetId: "external-media-modal-description",
        value: detail.description,
      },
      {
        op: "setAttr",
        targetId: "external-media-modal-thumbnail",
        name: "src",
        value: detail.thumbnail || null,
      },
      {
        op: "setAttr",
        targetId: "external-media-modal-thumbnail",
        name: "alt",
        value: detail.thumbnail ? `${detail.title} thumbnail` : "No thumbnail",
      },
      {
        op: "setStyle",
        targetId: "external-media-modal-overlay",
        prop: "display",
        value: "flex",
      },
    ],
    ["external-media-modal-overlay"],
  );
}

function closeExternalMediaDetail(runtime: HelixClientRuntime): void {
  schedulePatchBatch(
    runtime,
    "external-media-detail-close",
    "input",
    [
      {
        op: "setStyle",
        targetId: "external-media-modal-overlay",
        prop: "display",
        value: "none",
      },
    ],
    ["external-media-modal-overlay"],
  );
}

async function openExternalDetail(
  runtime: HelixClientRuntime,
  rowId: number,
): Promise<void> {
  installRuntimeStateReactivity(runtime);

  const response = await fetch(`/api/external-data/${rowId}`);
  if (!response.ok) {
    throw new Error(
      `External detail fetch failed with status ${response.status}`,
    );
  }

  const detail = (await response.json()) as ExternalProductDetailApiResponse;

  runtime.externalDetail = {
    open: true,
    title: detail.title,
    id: detail.id,
    brand: detail.brand,
    category: detail.category,
    price: detail.price,
    stock: detail.stock,
    rating: detail.rating,
    sourceId: detail.sourceId,
    description: detail.description,
    thumbnail: detail.thumbnail,
    thumbnailAlt: detail.title,
  };
}

function closeExternalDetail(runtime: HelixClientRuntime): void {
  installRuntimeStateReactivity(runtime);
  runtime.externalDetail = makeInitialExternalDetailState();
}

function toggleSort(
  state: UsersClientState,
  column: "name" | "email",
): UsersClientState {
  if (state.sortCol === column) {
    return {
      ...state,
      page: 1,
      sortDir: state.sortDir === "asc" ? "desc" : "asc",
    };
  }

  return {
    ...state,
    page: 1,
    sortCol: column,
    sortDir: "asc",
  };
}

function createUserFormStateFromValidationErrors(
  validationErrors: Record<string, string[]>,
) {
  const nextState = makeInitialCreateUserFormState();

  for (const [fieldName, errors] of Object.entries(validationErrors)) {
    const message = errors.join("; ");
    if (fieldName === "name") {
      nextState.nameError = message;
      continue;
    }

    if (fieldName === "email") {
      nextState.emailError = message;
      continue;
    }

    nextState.formError = nextState.formError
      ? `${nextState.formError}; ${message}`
      : message;
  }

  return nextState;
}

function createUserFormStateFromServerError(error: FormActionError) {
  return {
    ...makeInitialCreateUserFormState(),
    nameError: error.fieldErrors.name ?? "",
    emailError: error.fieldErrors.email ?? "",
    formError: error.formError ?? "",
  };
}

export async function onAppNavigate({
  event,
  runtime,
  element,
}: HelixClientHandlerContext): Promise<void> {
  if (!(element instanceof HTMLAnchorElement)) {
    return;
  }

  if (!isPrimaryNavigationEvent(event)) {
    return;
  }

  const href = element.getAttribute("href");
  if (!href || !href.startsWith("/")) {
    return;
  }

  event.preventDefault();
  installAppNavPopstate(runtime);

  try {
    await loadAdminCore(runtime, href, true);
  } catch {
    window.location.assign(href);
  }
}

export async function onPrevPage({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  if (runtime.state.page <= 1) {
    return;
  }
  runtime.state = {
    ...runtime.state,
    page: runtime.state.page - 1,
  };
  await refreshUsers(runtime, "page-prev", "network");
}

export async function onNextPage({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  if (runtime.state.page >= runtime.state.totalPages) {
    return;
  }
  runtime.state = {
    ...runtime.state,
    page: runtime.state.page + 1,
  };
  await refreshUsers(runtime, "page-next", "network");
}

export async function onSortByName({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  runtime.state = toggleSort(runtime.state, "name");
  await refreshUsers(runtime, "sort-name", "network");
}

export async function onSortByEmail({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  runtime.state = toggleSort(runtime.state, "email");
  await refreshUsers(runtime, "sort-email", "network");
}

export async function onLoadUsersPanel({
  runtime,
  element,
}: HelixClientHandlerContext): Promise<void> {
  const panel = element.dataset.panel;
  if (!isUsersPanelKind(panel)) {
    return;
  }

  await loadUsersPanel(runtime, panel);
}

export async function onExternalPagePrev({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  syncExternalStateFromDom(runtime);

  const state = runtime.externalState;
  if (state.page <= 1) {
    return;
  }
  await refreshExternalProducts(
    runtime,
    state.page - 1,
    "external-page-prev",
    "network",
  );
}

export async function onExternalPageNext({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  syncExternalStateFromDom(runtime);

  const state = runtime.externalState;
  if (state.page >= state.totalPages) {
    return;
  }
  await refreshExternalProducts(
    runtime,
    state.page + 1,
    "external-page-next",
    "network",
  );
}

export async function onExternalMediaPagePrev({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  const state = readExternalMediaStateFromDom();
  if (!state || state.page <= 1) {
    return;
  }

  await refreshExternalMediaProducts(
    runtime,
    state.page - 1,
    "external-media-page-prev",
    "network",
  );
}

export async function onExternalMediaPageNext({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  const state = readExternalMediaStateFromDom();
  if (!state || state.page >= state.totalPages) {
    return;
  }

  await refreshExternalMediaProducts(
    runtime,
    state.page + 1,
    "external-media-page-next",
    "network",
  );
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

export async function onExternalDetailOpen({
  runtime,
  element,
}: HelixClientHandlerContext): Promise<void> {
  const rowId = Number(element.dataset.rowId ?? "0");
  if (!Number.isInteger(rowId) || rowId <= 0) {
    return;
  }
  await openExternalDetail(runtime, rowId);
}

export async function onExternalDetailClose({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  closeExternalDetail(runtime);
}

export async function onExternalMediaDetailOpen({
  runtime,
  element,
}: HelixClientHandlerContext): Promise<void> {
  const rowId = Number(element.dataset.rowId ?? "0");
  if (!Number.isInteger(rowId) || rowId <= 0) {
    return;
  }

  await openExternalMediaDetail(runtime, rowId);
}

export async function onExternalMediaDetailClose({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  closeExternalMediaDetail(runtime);
}

function setTextByTargetId(targetId: string, value: string): void {
  const element = document.querySelector(`[data-hx-id="${targetId}"]`);
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.textContent = value;
}

function clearCreatePostMessages(): void {
  setTextByTargetId("create-post-error-user-id", "");
  setTextByTargetId("create-post-error-title", "");
  setTextByTargetId("create-post-error-body", "");
  setTextByTargetId("create-post-error-form", "");
  setTextByTargetId("create-post-status", "");
}

export async function onCreatePost({
  event,
  runtime,
  element,
}: HelixClientHandlerContext): Promise<void> {
  const form =
    event.target instanceof HTMLFormElement
      ? event.target
      : element.closest("form");
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Create post handler requires a form target");
  }

  clearCreatePostMessages();
  setTextByTargetId("create-post-status", "Creating post…");

  const formData = new FormData(form);
  const payload = {
    userId: Number(formData.get("userId") ?? 0),
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  };

  try {
    const response = await fetch("/actions/create-post", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json()) as FormActionError;
      throw new ServerActionError(body);
    }

    await (response.json() as Promise<{ ok: true; id: number }>);
    await loadAdminCore(runtime, "/posts?page=1", true);
  } catch (error: unknown) {
    setTextByTargetId("create-post-status", "");

    if (error instanceof ServerActionError) {
      setTextByTargetId(
        "create-post-error-user-id",
        error.body.fieldErrors.userId ?? "",
      );
      setTextByTargetId(
        "create-post-error-title",
        error.body.fieldErrors.title ?? "",
      );
      setTextByTargetId(
        "create-post-error-body",
        error.body.fieldErrors.body ?? "",
      );
      setTextByTargetId("create-post-error-form", error.body.formError ?? "");
      return;
    }

    setTextByTargetId(
      "create-post-error-form",
      "An unexpected error occurred.",
    );
  }
}

export async function onCreateUser({
  event,
  runtime,
  element,
}: HelixClientHandlerContext): Promise<void> {
  installRuntimeStateReactivity(runtime);

  if (runtime.createUserForm.submitting) {
    return;
  }

  const form =
    event.target instanceof HTMLFormElement
      ? event.target
      : element.closest("form");
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Create user handler requires a form target");
  }

  // Initialize form with validators
  const helixForm = new HelixForm(form, {
    rules: {
      name: [
        commonValidators.required("Name"),
        commonValidators.minLength("Name", 2),
      ],
      email: [commonValidators.required("Email"), commonValidators.email()],
    },
  });

  // Get form data
  const formData = new FormData(form);
  const payload = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };

  // Validate
  const validationErrors = helixForm.validateAll();
  if (Object.keys(validationErrors).length > 0) {
    runtime.createUserForm =
      createUserFormStateFromValidationErrors(validationErrors);
    return;
  }

  runtime.createUserForm = {
    ...makeInitialCreateUserFormState(),
    status: "Creating user…",
    submitting: true,
  };

  try {
    const response = await fetch("/actions/create-user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json()) as FormActionError;
      throw new ServerActionError(body);
    }

    await (response.json() as Promise<{ ok: true; id: number }>);

    runtime.createUserForm = {
      ...makeInitialCreateUserFormState(),
      status: "User created.",
    };

    form.reset();
    try {
      await refreshUsers(runtime, "create-user-refresh", "network");
    } catch (error: unknown) {
      console.error("[Helix] create-user refresh error", error);
    }
  } catch (error: unknown) {
    if (error instanceof ServerActionError) {
      runtime.createUserForm = createUserFormStateFromServerError(error.body);
      return;
    }

    runtime.createUserForm = {
      ...makeInitialCreateUserFormState(),
      formError: "An unexpected error occurred.",
    };
  }
}

/** Typed wrapper so rollback can unpack structured server errors. */
class ServerActionError extends Error {
  constructor(public readonly body: FormActionError) {
    super(body.formError ?? "Server action failed");
    this.name = "ServerActionError";
  }
}
