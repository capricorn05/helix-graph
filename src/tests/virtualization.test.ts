import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  VirtualList,
  createReactiveVirtualGrid,
  createReactiveVirtualList,
} from "../helix/virtualization.js";
import { createReactiveScope } from "../helix/reactive.js";

function installDomGlobals(dom: JSDOM): void {
  (globalThis as unknown as { window: Window }).window =
    dom.window as unknown as Window;
  (globalThis as unknown as { document: Document }).document =
    dom.window.document;
  (globalThis as unknown as { Element: typeof dom.window.Element }).Element =
    dom.window.Element;
  (
    globalThis as unknown as { HTMLElement: typeof dom.window.HTMLElement }
  ).HTMLElement = dom.window.HTMLElement;
  (globalThis as unknown as { Event: typeof dom.window.Event }).Event =
    dom.window.Event;
}

function setClientHeight(el: HTMLElement, value: number): void {
  Object.defineProperty(el, "clientHeight", {
    value,
    configurable: true,
  });
}

test("VirtualList computes visible window from scroll position and total count", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="scroll"></div></body>`);
  installDomGlobals(dom);

  const container = dom.window.document.getElementById("scroll");
  assert.ok(container instanceof dom.window.HTMLElement);
  setClientHeight(container, 100);

  const snapshots: Array<{ start: number; end: number }> = [];
  const list = new VirtualList({
    itemHeight: 20,
    bufferSize: 1,
    containerSelector: "#scroll",
    onChange: (state) => {
      snapshots.push({ start: state.startIndex, end: state.endIndex });
    },
  });

  list.setTotalCount(50);
  list.attach();

  let window = list.getWindow();
  assert.equal(window.startIndex, 0);
  assert.equal(window.endIndex, 7); // ceil(100/20)=5 plus buffer*2
  assert.equal(window.totalCount, 50);

  const allKeys = Array.from({ length: 50 }, (_, idx) => idx);
  assert.deepEqual(list.getVisibleKeys(allKeys), [0, 1, 2, 3, 4, 5, 6]);

  container.scrollTop = 60;
  container.dispatchEvent(new dom.window.Event("scroll"));

  window = list.getWindow();
  assert.equal(window.startIndex, 2);
  assert.equal(window.endIndex, 9);
  assert.equal(window.offsetTop, 40);
  assert.deepEqual(list.getVisibleKeys(allKeys), [2, 3, 4, 5, 6, 7, 8]);

  // initial attach + one scroll update
  assert.ok(snapshots.length >= 2);

  list.detach();
  const detachedStart = list.getWindow().startIndex;
  container.scrollTop = 180;
  container.dispatchEvent(new dom.window.Event("scroll"));
  assert.equal(list.getWindow().startIndex, detachedStart);
});

test("createReactiveVirtualList updates a window cell and detaches on owner dispose", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="list"></div></body>`);
  installDomGlobals(dom);

  const container = dom.window.document.getElementById("list");
  assert.ok(container instanceof dom.window.HTMLElement);
  setClientHeight(container, 120);

  const scope = createReactiveScope({ name: "virtual-list-scope" });
  const { list, window } = createReactiveVirtualList(
    {
      itemHeight: 30,
      bufferSize: 1,
      containerSelector: "#list",
    },
    { owner: scope },
  );

  list.setTotalCount(100);
  list.attach();
  assert.equal(window.get().startIndex, 0);

  container.scrollTop = 300;
  container.dispatchEvent(new dom.window.Event("scroll"));
  assert.equal(window.get().startIndex, 9);

  scope.dispose();
  assert.throws(() => window.get(), /disposed cell/);

  assert.doesNotThrow(() => {
    container.scrollTop = 450;
    container.dispatchEvent(new dom.window.Event("scroll"));
  });
});

test("createReactiveVirtualGrid updates window cell for scroll changes", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="grid"></div></body>`);
  installDomGlobals(dom);

  const container = dom.window.document.getElementById("grid");
  assert.ok(container instanceof dom.window.HTMLElement);
  setClientHeight(container, 100);

  const { grid, window } = createReactiveVirtualGrid({
    itemWidth: 100,
    itemHeight: 20,
    columnCount: 4,
    bufferSize: 1,
    containerSelector: "#grid",
  });

  grid.setTotalCount(200);
  grid.attach();

  let state = window.get();
  assert.equal(state.startIndex, 0);
  assert.equal(state.endIndex, 28); // (ceil(100/20)+2)*4 = 28

  container.scrollTop = 60;
  container.dispatchEvent(new dom.window.Event("scroll"));

  state = window.get();
  assert.equal(state.startIndex, 8); // floor(60/20)*4 - 4
  assert.equal(state.endIndex, 36);
  assert.equal(state.offsetTop, 40);

  grid.detach();
});
