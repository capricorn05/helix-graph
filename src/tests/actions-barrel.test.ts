import assert from "node:assert/strict";
import test from "node:test";
import * as clientActions from "../example/client/actions.js";
import { appBindingMap } from "../example/views/binding-map.generated.js";
import { onSubmitPrimitiveMessage } from "../example/client/actions-primitives.js";

test("/client/actions.js bindings resolve to exported handlers", () => {
  const actionExports = clientActions as Record<string, unknown>;

  for (const eventEntry of Object.values(appBindingMap.events)) {
    if (eventEntry.chunk !== "/client/actions.js") {
      continue;
    }

    const handler = actionExports[eventEntry.handlerExport];
    assert.equal(
      typeof handler,
      "function",
      `Missing handler export \"${eventEntry.handlerExport}\" for binding \"${eventEntry.id}\"`,
    );
  }
});

test("submit-primitive-message binding maps to onSubmitPrimitiveMessage", () => {
  const binding = appBindingMap.events["submit-primitive-message"];

  assert.equal(binding.chunk, "/client/actions.js");
  assert.equal(binding.handlerExport, "onSubmitPrimitiveMessage");

  const actionExports = clientActions as Record<string, unknown>;
  assert.equal(
    actionExports.onSubmitPrimitiveMessage,
    onSubmitPrimitiveMessage,
  );
});
