import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { reconcileKeyed, reconcileWindowedKeyed } from "../helix/reconciler.js";

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

test("reconcileWindowedKeyed only renders the visible key window", () => {
  const dom = new JSDOM('<ul id="list"></ul>');
  installElementGlobal(dom);

  const container = dom.window.document.getElementById("list");
  assert.ok(container);

  const allKeys = ["k0", "k1", "k2", "k3", "k4", "k5"];

  const first = reconcileWindowedKeyed(
    container,
    allKeys,
    { startIndex: 1, endIndex: 4 },
    (key) => {
      const node = dom.window.document.createElement("li");
      node.textContent = key;
      return node;
    },
  );

  assert.deepEqual(first.keys, ["k1", "k2", "k3"]);
  assert.deepEqual(
    Array.from(container.children).map((child) =>
      child.getAttribute("data-hx-key"),
    ),
    ["k1", "k2", "k3"],
  );

  const second = reconcileWindowedKeyed(
    container,
    allKeys,
    { startIndex: 3, endIndex: 6 },
    (key) => {
      const node = dom.window.document.createElement("li");
      node.textContent = key;
      return node;
    },
  );

  assert.deepEqual(second.keys, ["k3", "k4", "k5"]);
  assert.deepEqual(
    Array.from(container.children).map((child) =>
      child.getAttribute("data-hx-key"),
    ),
    ["k3", "k4", "k5"],
  );
});

test("reconcileWindowedKeyed clamps invalid window bounds", () => {
  const dom = new JSDOM('<ul id="list"></ul>');
  installElementGlobal(dom);

  const container = dom.window.document.getElementById("list");
  assert.ok(container);

  const result = reconcileWindowedKeyed(
    container,
    ["a", "b", "c"],
    { startIndex: -10, endIndex: 99 },
    (key) => {
      const node = dom.window.document.createElement("li");
      node.textContent = key;
      return node;
    },
  );

  assert.deepEqual(result.keys, ["a", "b", "c"]);
});
