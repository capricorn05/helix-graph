import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { PatchRuntime } from "../helix/patch.js";
import type { BindingMap, GraphSnapshot } from "../helix/types.js";
import {
  makePrimitiveMessageFormDerivedState,
  makePrimitiveMessageFormStateCell,
  type HelixClientRuntime,
} from "../example/client/runtime.js";
import { onSubmitPrimitiveMessage } from "../example/client/actions-primitives.js";
import {
  initializePrimitiveEnhancements,
  syncPrimitiveMessageStateFromDom,
} from "../example/client/primitives-demo.js";

function installDomGlobals(dom: JSDOM): void {
  (globalThis as unknown as { window: Window }).window =
    dom.window as unknown as Window;
  (globalThis as unknown as { document: Document }).document =
    dom.window.document;
  (globalThis as unknown as { Node: typeof dom.window.Node }).Node =
    dom.window.Node;
  (globalThis as unknown as { Element: typeof dom.window.Element }).Element =
    dom.window.Element;
  (
    globalThis as unknown as { HTMLElement: typeof dom.window.HTMLElement }
  ).HTMLElement = dom.window.HTMLElement;
  (
    globalThis as unknown as {
      HTMLFormElement: typeof dom.window.HTMLFormElement;
    }
  ).HTMLFormElement = dom.window.HTMLFormElement;
  (
    globalThis as unknown as {
      HTMLInputElement: typeof dom.window.HTMLInputElement;
    }
  ).HTMLInputElement = dom.window.HTMLInputElement;
  (
    globalThis as unknown as {
      HTMLButtonElement: typeof dom.window.HTMLButtonElement;
    }
  ).HTMLButtonElement = dom.window.HTMLButtonElement;
  (
    globalThis as unknown as {
      HTMLSelectElement: typeof dom.window.HTMLSelectElement;
    }
  ).HTMLSelectElement = dom.window.HTMLSelectElement;
  (globalThis as unknown as { Event: typeof dom.window.Event }).Event =
    dom.window.Event;
  (globalThis as unknown as { FormData: typeof dom.window.FormData }).FormData =
    dom.window.FormData;
}

function waitForAsyncWork(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      queueMicrotask(resolve);
    }, 0);
  });
}

function createRuntime(): HelixClientRuntime {
  const snapshot: GraphSnapshot = {
    version: "0.1",
    cells: {},
    resources: {},
    tags: {},
    createdAt: Date.now(),
  };

  const bindings: BindingMap = {
    events: {},
    lists: {},
  };

  const primitiveMessageFormStateCell = makePrimitiveMessageFormStateCell();

  const runtime = {
    snapshot,
    bindings,
    primitiveMessageForm: primitiveMessageFormStateCell.get(),
    primitiveMessageFormStateCell,
    primitiveMessageFormDerived: makePrimitiveMessageFormDerivedState(
      primitiveMessageFormStateCell,
    ),
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

  Object.defineProperty(runtime, "primitiveMessageForm", {
    configurable: true,
    enumerable: true,
    get: () => primitiveMessageFormStateCell.get(),
    set: (next: unknown) => {
      primitiveMessageFormStateCell.set(
        next as {
          message: string;
          submitting: boolean;
          response: string;
        },
      );
    },
  });

  return runtime;
}

test("primitive message sync installs reactive label/response/submit bindings", async () => {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <div data-hx-id="primitives-demo-root">
      <form data-hx-bind="submit-primitive-message" novalidate>
        <label>
          Enter a message
          <input
            type="text"
            name="message"
            data-hx-id="demo-message-input"
            placeholder="Type something here"
            value="Seeded"
          />
        </label>
        <p data-hx-id="demo-message-label">Typed message: -</p>
        <div class="toolbar">
          <button type="submit" data-hx-id="demo-message-submit">Send Message</button>
        </div>
        <p data-hx-id="demo-message-response" aria-live="polite"></p>
      </form>
    </div>
  </body>`);
  installDomGlobals(dom);

  const runtime = createRuntime();
  syncPrimitiveMessageStateFromDom(runtime);
  await waitForAsyncWork();

  assert.equal(
    dom.window.document.querySelector('[data-hx-id="demo-message-label"]')
      ?.textContent,
    "Typed message: Seeded",
  );
  assert.equal(runtime.primitiveMessageForm.message, "Seeded");

  runtime.primitiveMessageForm = {
    message: "Updated message",
    submitting: true,
    response: "Sending message…",
  };
  await waitForAsyncWork();

  assert.equal(
    dom.window.document.querySelector('[data-hx-id="demo-message-label"]')
      ?.textContent,
    "Typed message: Updated message",
  );
  assert.equal(
    dom.window.document.querySelector('[data-hx-id="demo-message-response"]')
      ?.textContent,
    "Sending message…",
  );
  assert.equal(
    dom.window.document
      .querySelector('[data-hx-id="demo-message-submit"]')
      ?.getAttribute("disabled"),
    "disabled",
  );
});

test("onSubmitPrimitiveMessage updates cell-backed UI from server response", async () => {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <div data-hx-id="primitives-demo-root">
      <form data-hx-bind="submit-primitive-message" novalidate>
        <label>
          Enter a message
          <input
            type="text"
            name="message"
            data-hx-id="demo-message-input"
            placeholder="Type something here"
            value="Hello Helix"
          />
        </label>
        <p data-hx-id="demo-message-label">Typed message: -</p>
        <div class="toolbar">
          <button type="submit" data-hx-id="demo-message-submit">Send Message</button>
        </div>
        <p data-hx-id="demo-message-response" aria-live="polite"></p>
      </form>
    </div>
  </body>`);
  installDomGlobals(dom);

  const runtime = createRuntime();
  syncPrimitiveMessageStateFromDom(runtime);
  await waitForAsyncWork();

  const alerts: string[] = [];
  dom.window.alert = ((value?: string) => {
    alerts.push(value ?? "");
  }) as typeof dom.window.alert;

  const fetchCalls: Array<{ url: unknown; init: unknown }> = [];
  const previousFetch = globalThis.fetch;
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = (async (
    url: unknown,
    init?: unknown,
  ) => {
    fetchCalls.push({ url, init });
    return new Response(
      JSON.stringify({ thankYou: "Thank you for your input: Hello Helix" }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const form = dom.window.document.querySelector("form");
    assert.ok(form instanceof dom.window.HTMLFormElement);

    await onSubmitPrimitiveMessage({
      event: new dom.window.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
      element: form,
      binding: {} as never,
      runtime,
    });
    await waitForAsyncWork();

    assert.deepEqual(alerts, ["Hello Helix"]);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0]?.url, "/actions/submit-primitive-message");
    assert.match(JSON.stringify(fetchCalls[0]?.init ?? {}), /Hello Helix/);
    assert.equal(
      dom.window.document.querySelector('[data-hx-id="demo-message-label"]')
        ?.textContent,
      "Typed message: Hello Helix",
    );
    assert.equal(
      dom.window.document.querySelector('[data-hx-id="demo-message-response"]')
        ?.textContent,
      "Thank you for your input: Hello Helix",
    );
    assert.equal(runtime.primitiveMessageForm.submitting, false);
    assert.equal(
      dom.window.document
        .querySelector('[data-hx-id="demo-message-submit"]')
        ?.hasAttribute("disabled"),
      false,
    );
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch =
      previousFetch;
  }
});

test("primitive message label updates while typing after runtime becomes available", async () => {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <div data-hx-id="primitives-demo-root">
      <form data-hx-bind="submit-primitive-message" novalidate>
        <label>
          Enter a message
          <input
            type="text"
            name="message"
            data-hx-id="demo-message-input"
            placeholder="Type something here"
            value=""
          />
        </label>
        <p data-hx-id="demo-message-label">Typed message: -</p>
        <div class="toolbar">
          <button type="submit" data-hx-id="demo-message-submit">Send Message</button>
        </div>
        <p data-hx-id="demo-message-response" aria-live="polite"></p>
      </form>
    </div>
  </body>`);
  installDomGlobals(dom);

  delete dom.window.__HELIX_RUNTIME__;
  initializePrimitiveEnhancements();

  const runtime = createRuntime();
  dom.window.__HELIX_RUNTIME__ = runtime;

  syncPrimitiveMessageStateFromDom(runtime);
  initializePrimitiveEnhancements();

  const input = dom.window.document.querySelector(
    '[data-hx-id="demo-message-input"]',
  );
  assert.ok(input instanceof dom.window.HTMLInputElement);

  input.value = "Live update";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await waitForAsyncWork();

  assert.equal(runtime.primitiveMessageForm.message, "Live update");
  assert.equal(
    dom.window.document.querySelector('[data-hx-id="demo-message-label"]')
      ?.textContent,
    "Typed message: Live update",
  );
});
