import { reconcileKeyed } from "../../helix/reconciler.js";
import { commonValidators, HelixForm } from "../../helix/form.js";
import type { Lane, PatchOp } from "../../helix/types.js";
import {
  HelixClientHandlerContext,
  HelixClientRuntime,
  UsersClientState,
  makeInitialCreateUserFormState,
} from "./runtime.js";
import {
  parseNumeric,
  schedulePatchBatch,
  scheduleReactivePatches,
  ServerActionError,
} from "./actions-shared.js";
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

type UsersPanelKind = "summary" | "reports" | "external-data" | "help";

const usersRuntimeReactivityInstalled = new WeakSet<HelixClientRuntime>();

function isUsersPanelKind(value: string | undefined): value is UsersPanelKind {
  return (
    value === "summary" ||
    value === "reports" ||
    value === "external-data" ||
    value === "help"
  );
}

function installRuntimeStateReactivity(runtime: HelixClientRuntime): void {
  if (usersRuntimeReactivityInstalled.has(runtime)) {
    return;
  }

  usersRuntimeReactivityInstalled.add(runtime);

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

  const form = document.querySelector('[data-hx-id="create-user-form"]');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  runtime.createUserForm = makeInitialCreateUserFormState();
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

function createUserFormStateFromServerError(error: ServerActionError) {
  return {
    ...makeInitialCreateUserFormState(),
    nameError: error.body.fieldErrors.name ?? "",
    emailError: error.body.fieldErrors.email ?? "",
    formError: error.body.formError ?? "",
  };
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

  const helixForm = new HelixForm(form, {
    rules: {
      name: [
        commonValidators.required("Name"),
        commonValidators.minLength("Name", 2),
      ],
      email: [commonValidators.required("Email"), commonValidators.email()],
    },
  });

  const formData = new FormData(form);
  const payload = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };

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
      const body = (await response.json()) as ServerActionError["body"];
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
      runtime.createUserForm = createUserFormStateFromServerError(error);
      return;
    }

    runtime.createUserForm = {
      ...makeInitialCreateUserFormState(),
      formError: "An unexpected error occurred.",
    };
  }
}
