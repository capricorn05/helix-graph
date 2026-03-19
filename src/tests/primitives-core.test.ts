import { test } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import {
  createControllableState,
  trapFocus,
  createKeyboardHandler,
  KEY,
  pushLayer,
  popLayer,
  isTopmostLayer,
  ensurePortalRoot,
  computePosition,
  defaultDomAdapter,
} from "../helix/primitives/core/index.js";
import { cell } from "../helix/reactive.js";

const dom = new JSDOM("<!DOCTYPE html>");
global.document = dom.window.document as any;
global.window = dom.window as any;

test("controllable-state: uncontrolled mode", () => {
  const onChange = { called: false, value: 0 };
  const state = createControllableState({
    defaultValue: 0,
    onChange: (v) => {
      onChange.called = true;
      onChange.value = v;
    },
  });

  assert.equal(state.get(), 0);
  state.set(5);
  assert.equal(onChange.called, true);
  assert.equal(onChange.value, 5);
  assert.equal(state.get(), 5);
});

test("controllable-state: controlled mode", () => {
  const onChange = { called: false, value: 0 };
  const state = createControllableState({
    value: 10,
    onChange: (v) => {
      onChange.called = true;
      onChange.value = v;
    },
  });

  assert.equal(state.get(), 10);
  state.set(20);
  assert.equal(onChange.called, true);
  assert.equal(onChange.value, 20);
  assert.equal(state.get(), 10); // Still returns controlled value
});

test("controllable-state: cell mode", () => {
  const reactiveCell = cell(0);
  const onChange = { called: false };
  const state = createControllableState({
    cell: reactiveCell,
    onChange: () => {
      onChange.called = true;
    },
  });

  assert.equal(state.get(), 0);
  state.set(5);
  assert.equal(onChange.called, true);
  assert.equal(state.get(), 5);
  assert.equal(reactiveCell.get(), 5);
});

test("keyboard: createKeyboardHandler", () => {
  let escapeCount = 0;
  let enterCount = 0;

  const handler = createKeyboardHandler({
    [KEY.Escape]: () => escapeCount++,
    [KEY.Enter]: () => enterCount++,
  });

  handler({
    key: "Escape",
    preventDefault: () => {},
  } as any);
  handler({
    key: "Enter",
    preventDefault: () => {},
  } as any);

  assert.equal(escapeCount, 1);
  assert.equal(enterCount, 1);
});

test("layer-stack: push/pop/isTopmost", () => {
  const id1 = Symbol("layer1");
  const id2 = Symbol("layer2");

  pushLayer(id1);
  assert(isTopmostLayer(id1));

  pushLayer(id2);
  assert(!isTopmostLayer(id1));
  assert(isTopmostLayer(id2));

  popLayer(id2);
  assert(isTopmostLayer(id1));

  popLayer(id1);
  assert(!isTopmostLayer(id1));
});

test("portal: ensurePortalRoot creates and returns root", () => {
  const root1 = ensurePortalRoot();
  const root2 = ensurePortalRoot();

  assert.equal(root1, root2);
  assert.equal(root1.id, "__hx-portal-root__");
  assert.equal(root1.getAttribute("data-hx-portal"), "true");
});

test("positioning: computePosition calculates coordinates", () => {
  const anchor = document.createElement("div");
  anchor.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      bottom: 50,
      right: 100,
      width: 100,
      height: 50,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  document.body.appendChild(anchor);

  const floating = document.createElement("div");
  floating.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      bottom: 40,
      right: 80,
      width: 80,
      height: 40,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;

  const pos = computePosition(anchor, floating, {
    placement: "bottom-start",
    offset: 8,
  });

  assert(pos.top > 0);
  assert(pos.left >= 0);
  assert.equal(pos.placementUsed, "bottom-start");
});

test("positioning: computePosition flips when preferred side is clipped", () => {
  const anchor = document.createElement("div");
  anchor.getBoundingClientRect = () =>
    ({
      top: 10,
      left: 20,
      bottom: 30,
      right: 70,
      width: 50,
      height: 20,
      x: 20,
      y: 10,
      toJSON() {
        return {};
      },
    }) as DOMRect;

  const floating = document.createElement("div");
  floating.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      bottom: 40,
      right: 80,
      width: 80,
      height: 40,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;

  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 120,
  });

  const pos = computePosition(anchor, floating, {
    placement: "top",
    offset: 8,
    flip: true,
  });

  assert.equal(pos.placementUsed, "bottom");
});

test("events: defaultDomAdapter", () => {
  const el = document.createElement("div");
  let called = false;

  const unsub = defaultDomAdapter.on(el, "click", () => {
    called = true;
  });

  el.click();
  assert(called);

  unsub();
  called = false;
  el.click();
  assert(!called);
});
