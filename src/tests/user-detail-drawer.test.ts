import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { PatchRuntime } from "../helix/patch.js";
import type { HelixClientRuntime } from "../example/client/runtime.js";
import {
  onUserDetailClose,
  onUserDetailOpen,
  resetUserDetailDrawerController,
} from "../example/client/actions-users.js";

function installDomGlobals(dom: JSDOM): void {
  (globalThis as unknown as { window: Window }).window =
    dom.window as unknown as Window;
  (globalThis as unknown as { document: Document }).document =
    dom.window.document;
  (globalThis as unknown as { Document: typeof dom.window.Document }).Document =
    dom.window.Document;
  (globalThis as unknown as { Node: typeof dom.window.Node }).Node =
    dom.window.Node;
  (globalThis as unknown as { Element: typeof dom.window.Element }).Element =
    dom.window.Element;
  (
    globalThis as unknown as { HTMLElement: typeof dom.window.HTMLElement }
  ).HTMLElement = dom.window.HTMLElement;
  (globalThis as unknown as { Event: typeof dom.window.Event }).Event =
    dom.window.Event;
}

function installDom(html: string): void {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: "http://localhost/users",
  });
  installDomGlobals(dom);
}

function buildDrawerMarkup(rowId: number): string {
  return `<button data-hx-id="row-${rowId}-detail-btn" data-hx-bind="user-detail-open" data-row-id="${rowId}">Details</button>
<div data-hx-id="user-detail-drawer-overlay" style="display: none;">
  <div data-hx-id="user-detail-drawer-panel">
    <button data-hx-id="user-detail-drawer-close-btn">Close</button>
    <div data-hx-id="user-detail-drawer-id">-</div>
    <div data-hx-id="user-detail-drawer-name">-</div>
    <div data-hx-id="user-detail-drawer-email">-</div>
    <div data-hx-id="user-detail-drawer-status">-</div>
    <div data-hx-id="user-detail-drawer-error"></div>
    <a data-hx-id="user-detail-drawer-edit-link" href="/users">Edit</a>
  </div>
</div>`;
}

function createRuntime(): HelixClientRuntime {
  return {
    scheduler: {
      schedule(batch: {
        patches: unknown[];
        run: (patches: unknown[]) => void;
      }): void {
        batch.run(batch.patches);
      },
    },
    patchRuntime: new PatchRuntime(document),
  } as unknown as HelixClientRuntime;
}

function installUserDetailFetchMock(options?: {
  status?: number;
  body?: unknown;
}): () => void {
  const previous = globalThis.fetch;
  const status = options?.status ?? 200;
  const body =
    options?.body ??
    ({
      id: 7,
      name: "Ava Kim",
      email: "ava.kim@example.com",
      status: "active",
    } as const);

  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (
    input: unknown,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : typeof input === "object" && input !== null && "url" in input
            ? String((input as { url: unknown }).url)
            : "";

    if (!url.includes("/api/users/7")) {
      throw new Error(`Unexpected fetch URL: ${url}`);
    }

    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return () => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = previous;
  };
}

test("onUserDetailOpen opens drawer and applies fetched user detail data", async () => {
  resetUserDetailDrawerController();
  installDom(buildDrawerMarkup(7));
  const restoreFetch = installUserDetailFetchMock();

  try {
    const runtime = createRuntime();
    const button = document.querySelector('[data-hx-id="row-7-detail-btn"]');
    assert.ok(button instanceof HTMLElement);

    await onUserDetailOpen({
      event: new Event("click"),
      element: button,
      binding: {
        id: "user-detail-open",
        event: "click",
        actionId: "user-detail",
        chunk: "/client/actions.js",
        handlerExport: "onUserDetailOpen",
      },
      runtime,
    });

    const overlay = document.querySelector<HTMLElement>(
      '[data-hx-id="user-detail-drawer-overlay"]',
    );
    const name = document.querySelector<HTMLElement>(
      '[data-hx-id="user-detail-drawer-name"]',
    );
    const email = document.querySelector<HTMLElement>(
      '[data-hx-id="user-detail-drawer-email"]',
    );
    const status = document.querySelector<HTMLElement>(
      '[data-hx-id="user-detail-drawer-status"]',
    );
    const editLink = document.querySelector<HTMLElement>(
      '[data-hx-id="user-detail-drawer-edit-link"]',
    );

    assert.ok(overlay instanceof HTMLElement);
    assert.ok(name instanceof HTMLElement);
    assert.ok(email instanceof HTMLElement);
    assert.ok(status instanceof HTMLElement);
    assert.ok(editLink instanceof HTMLElement);

    assert.equal(overlay.style.display, "flex");
    assert.equal(name.textContent, "Ava Kim");
    assert.equal(email.textContent, "ava.kim@example.com");
    assert.equal(status.textContent, "active");
    assert.equal(status.getAttribute("class"), "status-active");
    assert.equal(editLink.getAttribute("href"), "/users/7/edit");

    await onUserDetailClose();
  } finally {
    restoreFetch();
    resetUserDetailDrawerController();
  }
});

test("onUserDetailOpen shows an error message when fetch fails", async () => {
  resetUserDetailDrawerController();
  installDom(buildDrawerMarkup(7));
  const restoreFetch = installUserDetailFetchMock({
    status: 404,
    body: { error: "User not found" },
  });

  try {
    const runtime = createRuntime();
    const button = document.querySelector('[data-hx-id="row-7-detail-btn"]');
    assert.ok(button instanceof HTMLElement);

    await onUserDetailOpen({
      event: new Event("click"),
      element: button,
      binding: {
        id: "user-detail-open",
        event: "click",
        actionId: "user-detail",
        chunk: "/client/actions.js",
        handlerExport: "onUserDetailOpen",
      },
      runtime,
    });

    const error = document.querySelector<HTMLElement>(
      '[data-hx-id="user-detail-drawer-error"]',
    );
    assert.ok(error instanceof HTMLElement);
    assert.match(error.textContent ?? "", /Could not load user details/i);
  } finally {
    restoreFetch();
    resetUserDetailDrawerController();
  }
});
