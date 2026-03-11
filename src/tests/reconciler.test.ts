import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { reconcileKeyed } from "../helix/reconciler.js";

function installElementGlobal(dom: JSDOM): void {
  (globalThis as unknown as { Element: typeof dom.window.Element }).Element =
    dom.window.Element;
}

test("reconcileKeyed inserts, removes, and reorders by key", () => {
  const dom = new JSDOM(
    '<ul id="list"><li data-hx-key="a">a</li><li data-hx-key="b">b</li><li data-hx-key="c">c</li></ul>',
  );
  installElementGlobal(dom);

  const container = dom.window.document.getElementById("list");
  assert.ok(container);

  const result = reconcileKeyed(container, ["c", "a", "d"], (key) => {
    const node = dom.window.document.createElement("li");
    node.textContent = key;
    return node;
  });

  const childKeys = (Array.from(container.children) as Element[]).map((child) =>
    child.getAttribute("data-hx-key"),
  );
  assert.deepEqual(childKeys, ["c", "a", "d"]);
  assert.deepEqual(result.inserted, ["d"]);
  assert.deepEqual(result.removed, ["b"]);
  assert.deepEqual(result.moved, ["c", "a"]);
});
