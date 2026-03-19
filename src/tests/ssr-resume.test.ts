import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  compiledViewId,
  defineCompiledViewArtifact,
} from "../helix/view-compiler.js";
import { resetRuntimeGraph, runtimeGraph } from "../helix/graph.js";
import { resumeClientApp } from "../helix/resume.js";
import {
  createGraphSnapshot,
  bindingMapScript,
  snapshotScript,
} from "../helix/ssr.js";
import type { BindingMap, GraphSnapshot, PatchOp } from "../helix/types.js";

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
      HTMLScriptElement: typeof dom.window.HTMLScriptElement;
    }
  ).HTMLScriptElement = dom.window.HTMLScriptElement;
  (
    globalThis as unknown as {
      MutationObserver: typeof dom.window.MutationObserver;
    }
  ).MutationObserver = dom.window.MutationObserver;
  (globalThis as unknown as { Event: typeof dom.window.Event }).Event =
    dom.window.Event;
  (
    globalThis as unknown as { MouseEvent: typeof dom.window.MouseEvent }
  ).MouseEvent = dom.window.MouseEvent;
}

function waitForAsyncWork(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      queueMicrotask(resolve);
    }, 0);
  });
}

test("resumeClientApp rehydrates bindings, graph snapshot, and clientOnly placeholders", async () => {
  resetRuntimeGraph();

  defineCompiledViewArtifact(compiledViewId("resume-demo"), "resume-demo", {
    template: "<div>demo</div>",
    patches: [],
    bindingMap: { events: {}, lists: {} },
  });

  const snapshot = createGraphSnapshot(
    {
      label: "Resumed from snapshot",
    },
    { includeGraph: true },
  );

  const bindings: BindingMap = {
    events: {
      "load-message": {
        id: "load-message",
        event: "click",
        actionId: "loadMessage",
        chunk: "/client/actions.js",
        handlerExport: "onLoadMessage",
      },
    },
    lists: {},
  };

  const dom = new JSDOM(
    `<!DOCTYPE html><body>
      <div data-hx-id="message">Initial</div>
      <button data-hx-bind="load-message">Load</button>
      <div data-hx-client-only="island-1" data-hx-client-module="/client/island.js" data-hx-client-props="{&quot;label&quot;:&quot;Island ready&quot;}"></div>
      ${snapshotScript(snapshot)}
      ${bindingMapScript(bindings)}
    </body>`,
    { url: "http://localhost/" },
  );
  installDomGlobals(dom);

  resetRuntimeGraph();

  const runtime = resumeClientApp({
    createRuntime: ({ snapshot, bindings, patchRuntime, scheduler }) => ({
      snapshot,
      bindings,
      patchRuntime,
      scheduler,
    }),
    enableDevtools: false,
    installPopState: false,
    delegatorOptions: {
      root: dom.window.document,
      importModule: async (chunk: string) => {
        if (chunk === "/client/actions.js") {
          return {
            onLoadMessage: ({
              runtime,
            }: {
              runtime: {
                snapshot: GraphSnapshot;
                scheduler: {
                  schedule(batch: {
                    trigger: string;
                    lane: "input";
                    patches: PatchOp[];
                    nodes: string[];
                    run: (patches: PatchOp[]) => void;
                  }): void;
                };
                patchRuntime: { applyBatch(patches: PatchOp[]): void };
              };
            }) => {
              runtime.scheduler.schedule({
                trigger: "load-message",
                lane: "input",
                patches: [
                  {
                    op: "setText",
                    targetId: "message",
                    value: String(runtime.snapshot.cells.label),
                  },
                ],
                nodes: ["message"],
                run: (patches) => runtime.patchRuntime.applyBatch(patches),
              });
            },
          };
        }

        if (chunk === "/client/island.js") {
          return {
            mount: ({
              element,
              props,
            }: {
              element: HTMLElement;
              props: { label: string };
            }) => {
              element.textContent = props.label;
            },
          };
        }

        throw new Error(`Unexpected chunk: ${chunk}`);
      },
    },
  });

  const button = dom.window.document.querySelector("button");
  assert.ok(button instanceof dom.window.HTMLButtonElement);
  button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

  await waitForAsyncWork();
  await waitForAsyncWork();

  assert.equal(
    dom.window.document.querySelector('[data-hx-id="message"]')?.textContent,
    "Resumed from snapshot",
  );
  assert.equal(
    dom.window.document.querySelector("[data-hx-client-only]")?.textContent,
    "Island ready",
  );
  assert.ok(runtimeGraph.getNode(compiledViewId("resume-demo")));
  assert.equal(
    (runtime.snapshot.cells.label as string) ?? "",
    "Resumed from snapshot",
  );
});
