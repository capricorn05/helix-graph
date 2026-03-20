import { reconcileKeyed } from "../../helix/reconciler.js";
import {
  createFormState,
  type FormStateController,
} from "../../helix/form-state.js";
import {
  createDrawerController,
  type DrawerController,
} from "../../helix/primitives/drawer.js";
import {
  bindTargetTextValue,
  type ClientDomController,
} from "../../helix/client-dom.js";
import {
  installRuntimeReactivePatchBindings,
  scheduleRuntimePatchBatch,
} from "../../helix/client-reactivity.js";
import type { Lane, PatchOp } from "../../helix/types.js";
import {
  HelixClientHandlerContext,
  HelixClientRuntime,
  UsersClientState,
  makeInitialCreateUserFormState,
} from "./runtime.js";
import { parseNumeric, ServerActionError } from "./actions-shared.js";
import {
  syncExternalDetailStateFromDom,
  syncExternalStateFromDom,
} from "./actions-external.js";

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

interface UserDetailApiResponse {
  id: number;
  name: string;
  email: string;
  status: "active" | "pending";
}

interface UserDetailDrawerMount {
  controller: DrawerController;
  overlayEl: HTMLElement;
  closeBtn: HTMLElement;
}

type CreateUserFormValues = Record<"name" | "email", string>;

interface CreateUserFormMount {
  runtime: HelixClientRuntime;
  viewScopeId: string;
  formEl: HTMLFormElement;
  nameInputEl: HTMLInputElement;
  emailInputEl: HTMLInputElement;
  controller: FormStateController<CreateUserFormValues>;
  bindings: ClientDomController[];
}

type UsersPanelKind = "summary" | "reports" | "external-data" | "help";

let userDetailDrawer: UserDetailDrawerMount | null = null;
let createUserFormMount: CreateUserFormMount | null = null;

const createUserEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function destroyUserDetailDrawerMount(
  mount: UserDetailDrawerMount | null,
): void {
  if (!mount) {
    return;
  }

  mount.controller.destroy();
}

function isCurrentUserDetailDrawerMount(
  mount: UserDetailDrawerMount,
  overlayEl: HTMLElement,
  closeBtn: HTMLElement,
): boolean {
  return (
    mount.overlayEl.isConnected &&
    mount.closeBtn.isConnected &&
    mount.overlayEl === overlayEl &&
    mount.closeBtn === closeBtn
  );
}

export function resetUserDetailDrawerController(): void {
  destroyUserDetailDrawerMount(userDetailDrawer);
  userDetailDrawer = null;
}

function ensureUserDetailDrawer(): DrawerController | null {
  const overlayEl = document.querySelector<HTMLElement>(
    '[data-hx-id="user-detail-drawer-overlay"]',
  );
  const panelEl = document.querySelector<HTMLElement>(
    '[data-hx-id="user-detail-drawer-panel"]',
  );
  const closeBtn = document.querySelector<HTMLElement>(
    '[data-hx-id="user-detail-drawer-close-btn"]',
  );

  if (!overlayEl || !panelEl || !closeBtn) {
    resetUserDetailDrawerController();
    return null;
  }

  if (
    userDetailDrawer &&
    isCurrentUserDetailDrawerMount(userDetailDrawer, overlayEl, closeBtn)
  ) {
    return userDetailDrawer.controller;
  }

  destroyUserDetailDrawerMount(userDetailDrawer);
  const controller = createDrawerController(closeBtn, overlayEl, {
    portal: false,
    defaultValue: false,
    side: "right",
    closingDuration: 220,
    dismissTarget: panelEl,
  });

  userDetailDrawer = {
    controller,
    overlayEl,
    closeBtn,
  };

  return controller;
}

function destroyCreateUserFormMount(mount: CreateUserFormMount | null): void {
  if (!mount) {
    return;
  }

  for (const binding of mount.bindings) {
    binding.destroy();
  }
}

function isCurrentCreateUserFormMount(
  mount: CreateUserFormMount,
  runtime: HelixClientRuntime,
  formEl: HTMLFormElement,
  nameInputEl: HTMLInputElement,
  emailInputEl: HTMLInputElement,
): boolean {
  return (
    mount.runtime === runtime &&
    mount.viewScopeId === runtime.viewScope.id &&
    mount.formEl.isConnected &&
    mount.nameInputEl.isConnected &&
    mount.emailInputEl.isConnected &&
    mount.formEl === formEl &&
    mount.nameInputEl === nameInputEl &&
    mount.emailInputEl === emailInputEl
  );
}

function resolveCreateUserFieldError(
  field: FormStateController<CreateUserFormValues>["fields"]["name"],
): string {
  if (!field.touched.get()) {
    return "";
  }

  return field.error.get() ?? "";
}

function syncCreateUserRuntimeFormState(
  runtime: HelixClientRuntime,
  controller: FormStateController<CreateUserFormValues>,
  overrides?: Partial<ReturnType<typeof makeInitialCreateUserFormState>>,
): void {
  runtime.createUserForm = {
    ...runtime.createUserForm,
    nameError: resolveCreateUserFieldError(controller.fields.name),
    emailError: resolveCreateUserFieldError(controller.fields.email),
    ...overrides,
  };
}

function ensureCreateUserFormController(
  runtime: HelixClientRuntime,
): CreateUserFormMount | null {
  const formEl = document.querySelector('[data-hx-id="create-user-form"]');
  if (!(formEl instanceof HTMLFormElement)) {
    destroyCreateUserFormMount(createUserFormMount);
    createUserFormMount = null;
    runtime.createUserForm = makeInitialCreateUserFormState();
    return null;
  }

  const nameInputEl = formEl.querySelector('[data-hx-id="input-name"]');
  const emailInputEl = formEl.querySelector('[data-hx-id="input-email"]');
  if (
    !(nameInputEl instanceof HTMLInputElement) ||
    !(emailInputEl instanceof HTMLInputElement)
  ) {
    destroyCreateUserFormMount(createUserFormMount);
    createUserFormMount = null;
    runtime.createUserForm = makeInitialCreateUserFormState();
    return null;
  }

  if (
    createUserFormMount &&
    isCurrentCreateUserFormMount(
      createUserFormMount,
      runtime,
      formEl,
      nameInputEl,
      emailInputEl,
    )
  ) {
    return createUserFormMount;
  }

  destroyCreateUserFormMount(createUserFormMount);
  createUserFormMount = null;

  const controller = createFormState<CreateUserFormValues>({
    fields: {
      name: {
        initial: nameInputEl.value,
        validate: (value) => {
          const normalized = value.trim();
          if (!normalized) {
            return "Name is required";
          }
          if (normalized.length < 2) {
            return "Name must be at least 2 characters";
          }
          return null;
        },
      },
      email: {
        initial: emailInputEl.value,
        validate: (value) => {
          const normalized = value.trim();
          if (!normalized) {
            return "Email is required";
          }
          if (!createUserEmailPattern.test(normalized)) {
            return "Email must be valid";
          }
          return null;
        },
      },
    },
    owner: runtime.viewScope,
  });

  const bindings: ClientDomController[] = [];

  const nameBinding = bindTargetTextValue({
    root: formEl,
    targetId: "input-name",
    type: HTMLInputElement,
    onValue: (value) => {
      controller.applyServerErrors({});
      controller.fields.name.value.set(value);
      controller.fields.name.touched.set(true);
      syncCreateUserRuntimeFormState(runtime, controller, {
        formError: "",
        status: "",
      });
    },
  });
  if (nameBinding) {
    bindings.push(nameBinding);
  }

  const emailBinding = bindTargetTextValue({
    root: formEl,
    targetId: "input-email",
    type: HTMLInputElement,
    onValue: (value) => {
      controller.applyServerErrors({});
      controller.fields.email.value.set(value);
      controller.fields.email.touched.set(true);
      syncCreateUserRuntimeFormState(runtime, controller, {
        formError: "",
        status: "",
      });
    },
  });
  if (emailBinding) {
    bindings.push(emailBinding);
  }

  const mount: CreateUserFormMount = {
    runtime,
    viewScopeId: runtime.viewScope.id,
    formEl,
    nameInputEl,
    emailInputEl,
    controller,
    bindings,
  };

  runtime.viewScope.onDispose(() => {
    if (createUserFormMount !== mount) {
      return;
    }

    destroyCreateUserFormMount(createUserFormMount);
    createUserFormMount = null;
  });

  createUserFormMount = mount;
  runtime.createUserForm = makeInitialCreateUserFormState();
  syncCreateUserRuntimeFormState(runtime, controller);

  return mount;
}

function isUsersPanelKind(value: string | undefined): value is UsersPanelKind {
  return (
    value === "summary" ||
    value === "reports" ||
    value === "external-data" ||
    value === "help"
  );
}

function installRuntimeStateReactivity(runtime: HelixClientRuntime): void {
  installRuntimeReactivePatchBindings(
    runtime,
    "users-runtime-state-reactivity",
    [
      {
        trigger: "users-state:page-label",
        source: runtime.derived.pageLabel,
        patches: (value) => [{ op: "setText", targetId: "page-label", value }],
      },
      {
        trigger: "users-state:prev-disabled",
        source: runtime.derived.prevDisabled,
        patches: (disabled) => [
          {
            op: "setAttr",
            targetId: "prev-btn",
            name: "disabled",
            value: disabled ? "disabled" : null,
          },
        ],
      },
      {
        trigger: "users-state:next-disabled",
        source: runtime.derived.nextDisabled,
        patches: (disabled) => [
          {
            op: "setAttr",
            targetId: "next-btn",
            name: "disabled",
            value: disabled ? "disabled" : null,
          },
        ],
      },
      {
        trigger: "users-state:sort-name-indicator",
        source: runtime.derived.sortNameIndicator,
        patches: (value) => [
          { op: "setText", targetId: "sort-name-indicator", value },
        ],
      },
      {
        trigger: "users-state:sort-email-indicator",
        source: runtime.derived.sortEmailIndicator,
        patches: (value) => [
          { op: "setText", targetId: "sort-email-indicator", value },
        ],
      },
      {
        trigger: "users-state:attrs",
        source: runtime.stateCell,
        patches: (state) => [
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
        ],
      },
      {
        trigger: "create-user-form:text",
        source: runtime.createUserFormStateCell,
        patches: (formState) => [
          { op: "setText", targetId: "form-status", value: formState.status },
          {
            op: "setText",
            targetId: "error-name",
            value: formState.nameError,
          },
          {
            op: "setText",
            targetId: "error-email",
            value: formState.emailError,
          },
          {
            op: "setText",
            targetId: "error-form",
            value: formState.formError,
          },
        ],
      },
      {
        trigger: "create-user-form:submit-disabled",
        source: runtime.createUserFormDerived.submitDisabled,
        patches: (disabled) => [
          {
            op: "setAttr",
            targetId: "submit-create",
            name: "disabled",
            value: disabled ? "disabled" : null,
          },
        ],
      },
      {
        trigger: "create-user-form:name-invalid",
        source: runtime.createUserFormDerived.nameInvalid,
        patches: (invalid) => [
          {
            op: "setAttr",
            targetId: "input-name",
            name: "aria-invalid",
            value: invalid ? "true" : null,
          },
        ],
      },
      {
        trigger: "create-user-form:email-invalid",
        source: runtime.createUserFormDerived.emailInvalid,
        patches: (invalid) => [
          {
            op: "setAttr",
            targetId: "input-email",
            name: "aria-invalid",
            value: invalid ? "true" : null,
          },
        ],
      },
    ],
    {
      flush: "microtask",
      dedupePatches: true,
      owner: runtime.viewScope,
    },
  );
}

export function syncUsersStateFromDom(runtime: HelixClientRuntime): void {
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

export function syncCreateUserFormStateFromDom(
  runtime: HelixClientRuntime,
): void {
  installRuntimeStateReactivity(runtime);

  const mount = ensureCreateUserFormController(runtime);
  if (!mount) {
    runtime.createUserForm = makeInitialCreateUserFormState();
    return;
  }

  syncCreateUserRuntimeFormState(runtime, mount.controller, {
    status: "",
    formError: "",
    submitting: false,
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

  const actionCell = document.createElement("td");
  const detailButton = document.createElement("button");
  detailButton.type = "button";
  detailButton.className = "hx-btn hx-btn--secondary";
  detailButton.textContent = "Details";
  detailButton.setAttribute("data-hx-id", `row-${id}-detail-btn`);
  detailButton.setAttribute("data-hx-bind", "user-detail-open");
  detailButton.setAttribute("data-row-id", String(id));
  actionCell.appendChild(detailButton);
  row.appendChild(actionCell);

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
      {
        op: "setAttr",
        targetId: `row-${row.id}-detail-btn`,
        name: "data-row-id",
        value: String(row.id),
      },
    );
  }

  scheduleRuntimePatchBatch(runtime, {
    trigger,
    lane,
    patches,
    nodes: ["users-body"],
  });
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

function applyCreateUserServerErrors(
  mount: CreateUserFormMount,
  error: ServerActionError,
): void {
  mount.controller.applyServerErrors({
    name: error.body.fieldErrors.name,
    email: error.body.fieldErrors.email,
  });
  mount.controller.touchAll();
}

function applyUserDetailDrawerLoading(
  runtime: HelixClientRuntime,
  userId: number,
): void {
  scheduleRuntimePatchBatch(runtime, {
    trigger: "user-detail:loading",
    lane: "input",
    nodes: ["user-detail-drawer-panel"],
    patches: [
      { op: "setText", targetId: "user-detail-drawer-id", value: String(userId) },
      { op: "setText", targetId: "user-detail-drawer-name", value: "Loading..." },
      { op: "setText", targetId: "user-detail-drawer-email", value: "Loading..." },
      { op: "setText", targetId: "user-detail-drawer-status", value: "-" },
      {
        op: "setAttr",
        targetId: "user-detail-drawer-status",
        name: "class",
        value: null,
      },
      { op: "setText", targetId: "user-detail-drawer-error", value: "" },
      {
        op: "setAttr",
        targetId: "user-detail-drawer-edit-link",
        name: "href",
        value: `/users/${userId}/edit`,
      },
    ],
  });
}

function applyUserDetailDrawerError(
  runtime: HelixClientRuntime,
  userId: number,
  message: string,
): void {
  scheduleRuntimePatchBatch(runtime, {
    trigger: "user-detail:error",
    lane: "network",
    nodes: ["user-detail-drawer-panel"],
    patches: [
      { op: "setText", targetId: "user-detail-drawer-id", value: String(userId) },
      { op: "setText", targetId: "user-detail-drawer-name", value: "Unavailable" },
      { op: "setText", targetId: "user-detail-drawer-email", value: "-" },
      { op: "setText", targetId: "user-detail-drawer-status", value: "-" },
      {
        op: "setAttr",
        targetId: "user-detail-drawer-status",
        name: "class",
        value: null,
      },
      { op: "setText", targetId: "user-detail-drawer-error", value: message },
      {
        op: "setAttr",
        targetId: "user-detail-drawer-edit-link",
        name: "href",
        value: `/users/${userId}/edit`,
      },
    ],
  });
}

function applyUserDetailDrawerData(
  runtime: HelixClientRuntime,
  user: UserDetailApiResponse,
): void {
  scheduleRuntimePatchBatch(runtime, {
    trigger: "user-detail:loaded",
    lane: "network",
    nodes: ["user-detail-drawer-panel"],
    patches: [
      { op: "setText", targetId: "user-detail-drawer-id", value: String(user.id) },
      { op: "setText", targetId: "user-detail-drawer-name", value: user.name },
      { op: "setText", targetId: "user-detail-drawer-email", value: user.email },
      { op: "setText", targetId: "user-detail-drawer-status", value: user.status },
      {
        op: "setAttr",
        targetId: "user-detail-drawer-status",
        name: "class",
        value: `status-${user.status}`,
      },
      { op: "setText", targetId: "user-detail-drawer-error", value: "" },
      {
        op: "setAttr",
        targetId: "user-detail-drawer-edit-link",
        name: "href",
        value: `/users/${user.id}/edit`,
      },
    ],
  });
}

export async function onUserDetailOpen({
  element,
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  const rowId = Number(element.dataset.rowId ?? "");
  if (!Number.isFinite(rowId) || rowId <= 0) {
    return;
  }

  const drawer = ensureUserDetailDrawer();
  if (!drawer) {
    return;
  }

  applyUserDetailDrawerLoading(runtime, rowId);
  drawer.open();

  try {
    const response = await fetch(`/api/users/${rowId}`);
    if (!response.ok) {
      applyUserDetailDrawerError(
        runtime,
        rowId,
        `Could not load user details (${response.status}).`,
      );
      return;
    }

    const user = (await response.json()) as UserDetailApiResponse;
    applyUserDetailDrawerData(runtime, user);
  } catch {
    applyUserDetailDrawerError(
      runtime,
      rowId,
      "Could not load user details.",
    );
  }
}

export async function onUserDetailClose(): Promise<void> {
  ensureUserDetailDrawer()?.close();
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

export async function onCreateUser({
  event,
  runtime,
  element,
}: HelixClientHandlerContext): Promise<void> {
  installRuntimeStateReactivity(runtime);

  const mount = ensureCreateUserFormController(runtime);
  if (!mount) {
    throw new Error("Create user handler requires a form target");
  }

  const formState = mount.controller;

  if (runtime.createUserForm.submitting || formState.isSubmitting.get()) {
    return;
  }

  const formEl =
    event.target instanceof HTMLFormElement
      ? event.target
      : element.closest("form");
  if (!(formEl instanceof HTMLFormElement)) {
    throw new Error("Create user handler requires a form target");
  }

  formState.fields.name.value.set(mount.nameInputEl.value);
  formState.fields.email.value.set(mount.emailInputEl.value);
  formState.applyServerErrors({});
  formState.touchAll();

  syncCreateUserRuntimeFormState(runtime, formState, {
    status: "",
    formError: "",
    submitting: false,
  });

  if (!formState.isValid.get()) {
    return;
  }

  syncCreateUserRuntimeFormState(runtime, formState, {
    status: "Creating user…",
    submitting: true,
    formError: "",
  });

  try {
    await formState.submit(async (values) => {
      const payload = {
        name: values.name.trim(),
        email: values.email.trim(),
      };

      const response = await fetch("/actions/create-user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json()) as ServerActionError["body"];
        throw new ServerActionError(body);
      }

      await (response.json() as Promise<{ ok: true; id: number }>);
    });

    formState.reset();
    mount.nameInputEl.value = formState.fields.name.value.get();
    mount.emailInputEl.value = formState.fields.email.value.get();

    syncCreateUserRuntimeFormState(runtime, formState, {
      status: "User created.",
      formError: "",
      submitting: false,
    });

    formEl.reset();
    try {
      await refreshUsers(runtime, "create-user-refresh", "network");
    } catch (error: unknown) {
      console.error("[Helix] create-user refresh error", error);
    }
  } catch (error: unknown) {
    if (error instanceof ServerActionError) {
      applyCreateUserServerErrors(mount, error);
      syncCreateUserRuntimeFormState(runtime, formState, {
        status: "",
        formError: error.body.formError ?? "",
        submitting: false,
      });
      return;
    }

    syncCreateUserRuntimeFormState(runtime, formState, {
      status: "",
      formError: "An unexpected error occurred.",
      submitting: false,
    });
  }
}
