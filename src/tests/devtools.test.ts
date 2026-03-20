import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { resetRuntimeGraph } from "../helix/graph.js";
import {
  cell,
  createReactiveScope,
  derived,
  effect,
} from "../helix/reactive.js";
import { HelixDevtools } from "../helix/devtools.js";

function setupDom(): JSDOM {
  const dom = new JSDOM("<!DOCTYPE html><body></body>");
  (globalThis as any).document = dom.window.document;
  (globalThis as any).window = dom.window;
  return dom;
}

function teardownDom(): void {
  const panel = (globalThis as any).document?.getElementById(
    "__helix_devtools__",
  );
  panel?.remove();
  delete (globalThis as any).document;
  delete (globalThis as any).window;
}

test("HelixDevtools topology tab renders scope with owned cells and effects", async () => {
  setupDom();
  resetRuntimeGraph();

  const scope = createReactiveScope({ name: "my-scope" });
  const count = cell(0, { name: "count", owner: scope });
  const doubled = derived(() => count.get() * 2, {
    name: "doubled",
    owner: scope,
  });
  // Track dependencies by reading inside an effect
  let lastDoubled = 0;
  const fx = effect(
    () => {
      lastDoubled = doubled.get();
    },
    { name: "doubler-fx", owner: scope },
  );

  // Flush microtasks so effect subscribes
  await new Promise((resolve) => queueMicrotask(resolve as () => void));

  const devtools = new HelixDevtools({ startOpen: false });
  devtools.mount();

  // Switch to topology tab
  const topologyBtn = (globalThis as any).document.getElementById(
    "__helix_topology_tab__",
  );
  assert.ok(topologyBtn, "topology tab button should exist");
  topologyBtn.click();

  const topologyList = (globalThis as any).document.getElementById(
    "__helix_topology_list__",
  );
  assert.ok(topologyList, "topology list container should exist");

  const html = topologyList.innerHTML;
  // Scope name should appear
  assert.ok(html.includes("my-scope"), "scope label should be in topology");
  // Owned nodes should appear
  assert.ok(html.includes("count"), "cell label should appear under scope");
  assert.ok(
    html.includes("doubled"),
    "derived label should appear under scope",
  );
  assert.ok(
    html.includes("doubler-fx"),
    "effect label should appear under scope",
  );

  scope.dispose();
  teardownDom();
  void lastDoubled;
  void fx;
});

test("HelixDevtools topology tab shows dependency links for effects", async () => {
  setupDom();
  resetRuntimeGraph();

  const scope = createReactiveScope({ name: "dep-scope" });
  const name = cell("Alice", { name: "name", owner: scope });
  const fx = effect(
    () => {
      void name.get();
    },
    { name: "name-watcher", owner: scope },
  );

  await new Promise((resolve) => queueMicrotask(resolve as () => void));

  const devtools = new HelixDevtools({ startOpen: false });
  devtools.mount();

  const topologyBtn = (globalThis as any).document.getElementById(
    "__helix_topology_tab__",
  );
  topologyBtn?.click();

  const topologyList = (globalThis as any).document.getElementById(
    "__helix_topology_list__",
  );
  const html = topologyList?.innerHTML ?? "";

  // The effect should list "name" as a dependency
  assert.ok(html.includes("name-watcher"), "effect label should appear");
  assert.ok(html.includes("name"), "dependency cell label should appear");

  scope.dispose();
  teardownDom();
  void fx;
});

test("HelixDevtools topology tab shows empty message when no nodes", () => {
  setupDom();
  resetRuntimeGraph();

  const devtools = new HelixDevtools({ startOpen: false });
  devtools.mount();

  const topologyBtn = (globalThis as any).document.getElementById(
    "__helix_topology_tab__",
  );
  topologyBtn?.click();

  const topologyList = (globalThis as any).document.getElementById(
    "__helix_topology_list__",
  );
  const html = topologyList?.innerHTML ?? "";
  assert.ok(
    html.includes("No reactive nodes"),
    "should show empty message when graph is empty",
  );

  teardownDom();
});

test("HelixDevtools graph tab groups nodes by type", () => {
  setupDom();
  resetRuntimeGraph();

  const scope = createReactiveScope({ name: "graph-scope" });
  const c = cell(1, { name: "graph-cell", owner: scope });
  const d = derived(() => c.get() + 1, { name: "graph-derived", owner: scope });

  const devtools = new HelixDevtools({ startOpen: false });
  devtools.mount();

  const graphBtn = (globalThis as any).document.getElementById(
    "__helix_graph_tab__",
  );
  graphBtn?.click();

  const nodesList = (globalThis as any).document.getElementById(
    "__helix_nodes_list__",
  );
  const html = nodesList?.innerHTML ?? "";
  assert.ok(html.includes("CellNode"), "CellNode group should appear");
  assert.ok(html.includes("DerivedNode"), "DerivedNode group should appear");
  assert.ok(html.includes("graph-cell"), "cell label should appear");
  assert.ok(html.includes("graph-derived"), "derived label should appear");

  scope.dispose();
  teardownDom();
  void d;
});
