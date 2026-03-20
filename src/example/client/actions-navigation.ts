import {
  HelixClientHandlerContext,
  HelixClientRuntime,
  rotateClientViewScope,
} from "./runtime.js";
import {
  isPrimaryNavigationEvent,
  ServerActionError,
  updateActiveAdminNav,
} from "./actions-shared.js";
import {
  resetUserDetailDrawerController,
  syncCreateUserFormStateFromDom,
  syncUsersStateFromDom,
} from "./actions-users.js";
import { syncPostsStateFromDom } from "./actions-posts.js";
import {
  resetExternalDialogControllers,
  syncExternalDetailStateFromDom,
  syncExternalStateFromDom,
} from "./actions-external.js";
import {
  initializePrimitiveEnhancements,
  syncPrimitiveMessageStateFromDom,
} from "./primitives-demo.js";

let appNavPopstateInstalled = false;

function syncRuntimeStateFromDom(runtime: HelixClientRuntime): void {
  syncUsersStateFromDom(runtime);
  syncPostsStateFromDom(runtime);
  syncExternalStateFromDom(runtime);
  syncExternalDetailStateFromDom(runtime);
  syncCreateUserFormStateFromDom(runtime);
  syncPrimitiveMessageStateFromDom(runtime);
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
    resetUserDetailDrawerController();
    resetExternalDialogControllers();
    rotateClientViewScope(runtime);
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
    initializePrimitiveEnhancements();
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

    if (
      window.location.pathname === "/airbnb-mongo" &&
      document.querySelector('[data-hx-id="airbnb-mongo-root"]') instanceof
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
      const body = (await response.json()) as ServerActionError["body"];
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
