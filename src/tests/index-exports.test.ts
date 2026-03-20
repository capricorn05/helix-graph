import assert from "node:assert/strict";
import test from "node:test";
import {
  createAutocomplete,
  createDragReorder,
  createFormState,
  createIdleTrigger,
  createInvalidationChannel,
  createVisibilityTrigger,
  reorderArray,
} from "../helix/index.js";

test("helix index exports new interaction primitives", () => {
  assert.equal(typeof createAutocomplete, "function");
  assert.equal(typeof createDragReorder, "function");
  assert.equal(typeof createFormState, "function");
  assert.equal(typeof createIdleTrigger, "function");
  assert.equal(typeof createInvalidationChannel, "function");
  assert.equal(typeof createVisibilityTrigger, "function");
  assert.equal(typeof reorderArray, "function");
});
