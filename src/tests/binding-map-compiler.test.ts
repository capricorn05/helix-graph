import assert from "node:assert/strict";
import test from "node:test";
import {
  collectBindingsAndListsFromViewSource,
  collectClientHandlersFromSource,
} from "../helix/binding-map-compiler.js";
import { parseTypeScriptSourceFile } from "../helix/compiler-utils.js";

test("collectBindingsAndListsFromViewSource finds bindings/lists across supported patterns", () => {
  const source = `
const html = \
  '<button data-hx-bind="save-user">Save</button>' +
  '<form data-hx-bind="save-form"></form>' +
  '<tbody data-hx-list="users-body"></tbody>';

const attrs = {
  "data-hx-list": "posts-body",
};

const button = uiButton({ bind: "refresh-users" });
`;

  const sourceFile = parseTypeScriptSourceFile("/tmp/demo.view.ts", source);
  const result = collectBindingsAndListsFromViewSource(sourceFile);

  const sortedBindings = result.bindings
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const sortedLists = result.listIds.slice().sort((a, b) => a.localeCompare(b));

  assert.deepEqual(sortedBindings, [
    { id: "refresh-users", event: "click" },
    { id: "save-form", event: "submit" },
    { id: "save-user", event: "click" },
  ]);

  assert.deepEqual(sortedLists, ["posts-body", "users-body"]);
});

test("collectBindingsAndListsFromViewSource rejects conflicting binding events", () => {
  const source = `
const one = '<button data-hx-bind="shared-id"></button>';
const two = '<form data-hx-bind="shared-id"></form>';
`;

  const sourceFile = parseTypeScriptSourceFile("/tmp/conflict.view.ts", source);

  assert.throws(
    () => collectBindingsAndListsFromViewSource(sourceFile),
    /Conflicting event types for binding "shared-id"/i,
  );
});

test("collectClientHandlersFromSource returns only exported function handlers", () => {
  const source = `
export function onSave() {}
export const onCancel = () => {};
export const onSubmit = function () {};
export default function onDefault() {}

const localHandler = () => {};
export const notAHandler = 123;
`;

  const sourceFile = parseTypeScriptSourceFile("/tmp/actions.ts", source);
  const handlers = collectClientHandlersFromSource(sourceFile).sort();

  assert.deepEqual(handlers, ["onCancel", "onDefault", "onSave", "onSubmit"]);
});
