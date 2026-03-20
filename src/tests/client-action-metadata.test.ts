import assert from "node:assert/strict";
import test from "node:test";
import {
  defineClientActionMetadata,
  inferClientHandlerCandidates,
  resolveClientActionEventEntries,
} from "../helix/client-action-metadata.js";
import type { BindingRecord } from "../helix/binding-map-compiler.js";

test("inferClientHandlerCandidates preserves legacy candidate ordering", () => {
  assert.deepEqual(inferClientHandlerCandidates("sort-name"), [
    "onSortName",
    "onSortByName",
  ]);

  assert.deepEqual(inferClientHandlerCandidates("app-nav"), [
    "onAppNav",
    "onAppByNav",
    "onAppNavigate",
  ]);
});

test("resolveClientActionEventEntries infers handlers/actionIds and keeps preventDefault opt-in", () => {
  const bindings: BindingRecord[] = [
    { id: "app-nav", event: "click" },
    { id: "save-form", event: "submit" },
    { id: "sort-name", event: "click" },
  ];

  const entries = resolveClientActionEventEntries({
    bindings,
    availableHandlers: new Set(["onAppNavigate", "onSaveForm", "onSortByName"]),
    defaultChunk: "/client/actions.js",
  });

  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  assert.equal(byId.get("app-nav")?.handlerExport, "onAppNavigate");
  assert.equal(byId.get("app-nav")?.actionId, "appNav");
  assert.equal(byId.get("app-nav")?.chunk, "/client/actions.js");

  assert.equal(byId.get("save-form")?.handlerExport, "onSaveForm");
  assert.equal(byId.get("save-form")?.actionId, "saveForm");
  assert.equal(byId.get("save-form")?.preventDefault, undefined);

  assert.equal(byId.get("sort-name")?.handlerExport, "onSortByName");
  assert.equal(byId.get("sort-name")?.actionId, "sortName");
});

test("resolveClientActionEventEntries applies metadata overrides", () => {
  const bindings: BindingRecord[] = [{ id: "sort-name", event: "click" }];
  const metadata = defineClientActionMetadata({
    "sort-name": {
      actionId: "setSort",
      event: "keydown",
      handlerExport: "onSortByName",
      preventDefault: true,
      chunk: "/client/sort-actions.js",
    },
  });

  const [entry] = resolveClientActionEventEntries({
    bindings,
    availableHandlers: new Set(["onSortByName"]),
    metadata,
    defaultChunk: "/client/actions.js",
  });

  assert.equal(entry.actionId, "setSort");
  assert.equal(entry.event, "keydown");
  assert.equal(entry.handlerExport, "onSortByName");
  assert.equal(entry.preventDefault, true);
  assert.equal(entry.chunk, "/client/sort-actions.js");
});

test("resolveClientActionEventEntries rejects stale metadata keys", () => {
  const bindings: BindingRecord[] = [{ id: "save-user", event: "click" }];
  const metadata = defineClientActionMetadata({
    "stale-binding": { actionId: "staleAction" },
  });

  assert.throws(
    () =>
      resolveClientActionEventEntries({
        bindings,
        availableHandlers: new Set(["onSaveUser"]),
        metadata,
        defaultChunk: "/client/actions.js",
      }),
    /stale binding ids[\s\S]*stale-binding/i,
  );
});

test("resolveClientActionEventEntries validates metadata and inferred handler exports", () => {
  const bindings: BindingRecord[] = [{ id: "save-user", event: "click" }];

  assert.throws(
    () =>
      resolveClientActionEventEntries({
        bindings,
        availableHandlers: new Set(["onSaveUser"]),
        metadata: defineClientActionMetadata({
          "save-user": { handlerExport: "onMissingHandler" },
        }),
        defaultChunk: "/client/actions.js",
      }),
    /missing handler export "onMissingHandler"/i,
  );

  assert.throws(
    () =>
      resolveClientActionEventEntries({
        bindings,
        availableHandlers: new Set(),
        defaultChunk: "/client/actions.js",
      }),
    /No exported client handler found for binding "save-user"/,
  );
});
