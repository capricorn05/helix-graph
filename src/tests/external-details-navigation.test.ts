import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { PatchRuntime } from "../helix/patch.js";
import { cell, derived } from "../helix/reactive.js";
import type { BindingMap, GraphSnapshot } from "../helix/types.js";
import {
  makeInitialExternalDetailState,
  type HelixClientRuntime,
} from "../example/client/runtime.js";
import {
  onExternalDetailOpen,
  onExternalMediaDetailOpen,
  resetExternalDialogControllers,
} from "../example/client/actions-external.js";

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
  (
    globalThis as unknown as {
      HTMLInputElement: typeof dom.window.HTMLInputElement;
    }
  ).HTMLInputElement = dom.window.HTMLInputElement;
  (
    globalThis as unknown as {
      HTMLTextAreaElement: typeof dom.window.HTMLTextAreaElement;
    }
  ).HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  (
    globalThis as unknown as {
      HTMLSelectElement: typeof dom.window.HTMLSelectElement;
    }
  ).HTMLSelectElement = dom.window.HTMLSelectElement;
  (globalThis as unknown as { Event: typeof dom.window.Event }).Event =
    dom.window.Event;
}

function installDom(html: string): void {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: "http://localhost/",
  });
  installDomGlobals(dom);
}

function buildExternalMediaMarkup(rowId: number): string {
  return `<button data-hx-id="external-media-row-${rowId}-action" data-hx-bind="external-media-detail-open" data-row-id="${rowId}">Details</button>
<div data-hx-id="external-media-modal-overlay" style="display: none;">
  <div data-hx-id="external-media-modal-panel">
    <button data-hx-id="external-media-modal-close-btn">Close</button>
    <h2 data-hx-id="external-media-modal-title">Product Details</h2>
    <img data-hx-id="external-media-modal-thumbnail" alt="" src="" />
    <div data-hx-id="external-media-modal-id">-</div>
    <div data-hx-id="external-media-modal-brand">-</div>
    <div data-hx-id="external-media-modal-category">-</div>
    <div data-hx-id="external-media-modal-price">-</div>
    <div data-hx-id="external-media-modal-stock">-</div>
    <div data-hx-id="external-media-modal-rating">-</div>
    <div data-hx-id="external-media-modal-source">-</div>
    <div data-hx-id="external-media-modal-description">-</div>
  </div>
</div>`;
}

function buildExternalMarkup(rowId: number): string {
  return `<button data-hx-id="external-row-${rowId}-action" data-hx-bind="external-detail-open" data-row-id="${rowId}">Details</button>
<div data-hx-id="external-modal-overlay" style="display: none;">
  <button data-hx-id="external-modal-close-btn">Close</button>
  <h2 data-hx-id="external-modal-title">Product Details</h2>
  <img data-hx-id="external-modal-thumbnail" alt="" src="" />
  <div data-hx-id="external-modal-id">-</div>
  <div data-hx-id="external-modal-brand">-</div>
  <div data-hx-id="external-modal-category">-</div>
  <div data-hx-id="external-modal-price">-</div>
  <div data-hx-id="external-modal-stock">-</div>
  <div data-hx-id="external-modal-rating">-</div>
  <div data-hx-id="external-modal-source">-</div>
  <div data-hx-id="external-modal-description">-</div>
</div>`;
}

function installExternalDetailFetchMock(): () => void {
  const previous = globalThis.fetch;

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

    const rowMatch = /\/api\/external-data\/(\d+)/.exec(url);
    if (!rowMatch) {
      throw new Error(`Unexpected fetch call: ${url}`);
    }

    const rowId = Number(rowMatch[1]);
    return new Response(
      JSON.stringify({
        id: rowId,
        title: `Product ${rowId}`,
        brand: "Acme",
        category: "hardware",
        price: 12.5,
        stock: 7,
        rating: 4.2,
        description: "Detail description",
        thumbnail: "/thumb.png",
        sourceId: rowId,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  return () => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = previous;
  };
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

  const externalStateCell = cell({
    page: 1,
    pageSize: 100,
    total: 100,
    totalPages: 1,
  });
  const externalDetailStateCell = cell(makeInitialExternalDetailState());

  const externalDerived = {
    pageLabel: derived(() => {
      const state = externalStateCell.get();
      return `Page ${state.page} / ${state.totalPages}`;
    }),
    totalLabel: derived(() => {
      const state = externalStateCell.get();
      return `(Total rows: ${state.total})`;
    }),
    prevDisabled: derived(() => externalStateCell.get().page <= 1),
    nextDisabled: derived(
      () => externalStateCell.get().page >= externalStateCell.get().totalPages,
    ),
  };

  const externalDetailDerived = {
    overlayDisplay: derived(() =>
      externalDetailStateCell.get().open ? "flex" : "none",
    ),
    idLabel: derived(() => {
      const value = externalDetailStateCell.get().id;
      return value === null ? "-" : String(value);
    }),
    priceLabel: derived(() => {
      const value = externalDetailStateCell.get().price;
      return value === null ? "-" : `$${value.toFixed(2)}`;
    }),
    stockLabel: derived(() => {
      const value = externalDetailStateCell.get().stock;
      return value === null ? "-" : String(value);
    }),
    ratingLabel: derived(() => {
      const value = externalDetailStateCell.get().rating;
      return value === null ? "-" : value.toFixed(1);
    }),
    sourceLabel: derived(() => {
      const value = externalDetailStateCell.get().sourceId;
      return value === null ? "-" : `Seed Product #${value}`;
    }),
  };

  const runtime = {
    snapshot,
    bindings,
    externalState: externalStateCell.get(),
    externalStateCell,
    externalDerived,
    externalDetail: externalDetailStateCell.get(),
    externalDetailStateCell,
    externalDetailDerived,
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

  Object.defineProperty(runtime, "externalState", {
    configurable: true,
    enumerable: true,
    get: () => externalStateCell.get(),
    set: (next: unknown) => {
      externalStateCell.set(
        next as {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        },
      );
    },
  });

  Object.defineProperty(runtime, "externalDetail", {
    configurable: true,
    enumerable: true,
    get: () => externalDetailStateCell.get(),
    set: (next: unknown) => {
      externalDetailStateCell.set(
        next as ReturnType<typeof makeInitialExternalDetailState>,
      );
    },
  });

  return runtime;
}

test("external media details rebind after DOM replacement", async () => {
  const restoreFetch = installExternalDetailFetchMock();
  resetExternalDialogControllers();

  try {
    installDom(buildExternalMediaMarkup(48));
    const runtime = createRuntime();

    const firstButton = document.querySelector(
      '[data-hx-id="external-media-row-48-action"]',
    );
    const firstOverlay = document.querySelector<HTMLElement>(
      '[data-hx-id="external-media-modal-overlay"]',
    );

    assert.ok(firstButton instanceof HTMLElement);
    assert.ok(firstOverlay instanceof HTMLElement);

    await onExternalMediaDetailOpen({
      event: new Event("click"),
      element: firstButton,
      binding: {
        id: "external-media-detail-open",
        event: "click",
        actionId: "external-media-detail",
        chunk: "/client/actions.js",
        handlerExport: "onExternalMediaDetailOpen",
      },
      runtime,
    });

    assert.equal(firstOverlay.style.display, "flex");

    document.body.innerHTML = buildExternalMediaMarkup(48);

    const secondButton = document.querySelector(
      '[data-hx-id="external-media-row-48-action"]',
    );
    const secondOverlay = document.querySelector<HTMLElement>(
      '[data-hx-id="external-media-modal-overlay"]',
    );

    assert.ok(secondButton instanceof HTMLElement);
    assert.ok(secondOverlay instanceof HTMLElement);
    assert.equal(secondOverlay.style.display, "none");

    await onExternalMediaDetailOpen({
      event: new Event("click"),
      element: secondButton,
      binding: {
        id: "external-media-detail-open",
        event: "click",
        actionId: "external-media-detail",
        chunk: "/client/actions.js",
        handlerExport: "onExternalMediaDetailOpen",
      },
      runtime,
    });

    assert.equal(secondOverlay.style.display, "flex");
    assert.equal(
      secondOverlay.querySelector('[data-hx-id="external-media-modal-title"]')
        ?.textContent,
      "Product 48",
    );
    assert.equal(firstOverlay.isConnected, false);
  } finally {
    restoreFetch();
    resetExternalDialogControllers();
  }
});

test("external details rebind after DOM replacement", async () => {
  const restoreFetch = installExternalDetailFetchMock();
  resetExternalDialogControllers();

  try {
    installDom(buildExternalMarkup(24));
    const runtime = createRuntime();

    const firstButton = document.querySelector(
      '[data-hx-id="external-row-24-action"]',
    );
    const firstOverlay = document.querySelector<HTMLElement>(
      '[data-hx-id="external-modal-overlay"]',
    );

    assert.ok(firstButton instanceof HTMLElement);
    assert.ok(firstOverlay instanceof HTMLElement);

    await onExternalDetailOpen({
      event: new Event("click"),
      element: firstButton,
      binding: {
        id: "external-detail-open",
        event: "click",
        actionId: "external-detail",
        chunk: "/client/actions.js",
        handlerExport: "onExternalDetailOpen",
      },
      runtime,
    });

    assert.equal(firstOverlay.style.display, "flex");

    document.body.innerHTML = buildExternalMarkup(24);

    const secondButton = document.querySelector(
      '[data-hx-id="external-row-24-action"]',
    );
    const secondOverlay = document.querySelector<HTMLElement>(
      '[data-hx-id="external-modal-overlay"]',
    );

    assert.ok(secondButton instanceof HTMLElement);
    assert.ok(secondOverlay instanceof HTMLElement);
    assert.equal(secondOverlay.style.display, "none");

    await onExternalDetailOpen({
      event: new Event("click"),
      element: secondButton,
      binding: {
        id: "external-detail-open",
        event: "click",
        actionId: "external-detail",
        chunk: "/client/actions.js",
        handlerExport: "onExternalDetailOpen",
      },
      runtime,
    });

    assert.equal(secondOverlay.style.display, "flex");
    assert.equal(firstOverlay.isConnected, false);
  } finally {
    restoreFetch();
    resetExternalDialogControllers();
  }
});
