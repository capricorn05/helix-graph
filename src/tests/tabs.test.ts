import { test } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import { createTabsController } from "../helix/primitives/tabs.js";

const dom = new JSDOM("<!DOCTYPE html>");
global.document = dom.window.document as any;
global.window = dom.window as any;

test("tabs: activate and activeIndex", () => {
  const tablist = document.createElement("div");

  const tab1 = document.createElement("button");
  tab1.setAttribute("data-hx-tab", "");
  const tab2 = document.createElement("button");
  tab2.setAttribute("data-hx-tab", "");

  const panel1 = document.createElement("div");
  panel1.setAttribute("data-hx-panel", "");
  const panel2 = document.createElement("div");
  panel2.setAttribute("data-hx-panel", "");

  tablist.appendChild(tab1);
  tablist.appendChild(tab2);
  tablist.appendChild(panel1);
  tablist.appendChild(panel2);

  document.body.appendChild(tablist);

  const tabs = createTabsController(tablist, { defaultValue: 0 });

  assert.equal(tabs.activeIndex(), 0);

  tabs.activate(1);
  assert.equal(tabs.activeIndex(), 1);

  tabs.destroy();
});

test("tabs: ARIA role attributes", () => {
  const tablist = document.createElement("div");

  const tab1 = document.createElement("button");
  tab1.setAttribute("data-hx-tab", "");

  const panel1 = document.createElement("div");
  panel1.setAttribute("data-hx-panel", "");

  tablist.appendChild(tab1);
  tablist.appendChild(panel1);

  document.body.appendChild(tablist);

  const tabs = createTabsController(tablist);

  assert.equal(tablist.getAttribute("role"), "tablist");
  assert.equal(tab1.getAttribute("role"), "tab");
  assert.equal(panel1.getAttribute("role"), "tabpanel");

  tabs.destroy();
});

test("tabs: uncontrolled via defaultIndex", () => {
  const tablist = document.createElement("div");

  const tab1 = document.createElement("button");
  tab1.setAttribute("data-hx-tab", "");
  const tab2 = document.createElement("button");
  tab2.setAttribute("data-hx-tab", "");

  const panel1 = document.createElement("div");
  panel1.setAttribute("data-hx-panel", "");
  const panel2 = document.createElement("div");
  panel2.setAttribute("data-hx-panel", "");

  tablist.appendChild(tab1);
  tablist.appendChild(tab2);
  tablist.appendChild(panel1);
  tablist.appendChild(panel2);

  document.body.appendChild(tablist);

  const tabs = createTabsController(tablist, { defaultValue: 1 });

  assert.equal(tabs.activeIndex(), 1);
  assert.equal(panel2.style.display, "block");

  tabs.destroy();
});

test("tabs: onChange callback", () => {
  const tablist = document.createElement("div");

  const tab1 = document.createElement("button");
  tab1.setAttribute("data-hx-tab", "");
  const tab2 = document.createElement("button");
  tab2.setAttribute("data-hx-tab", "");

  const panel1 = document.createElement("div");
  panel1.setAttribute("data-hx-panel", "");
  const panel2 = document.createElement("div");
  panel2.setAttribute("data-hx-panel", "");

  tablist.appendChild(tab1);
  tablist.appendChild(tab2);
  tablist.appendChild(panel1);
  tablist.appendChild(panel2);

  document.body.appendChild(tablist);

  let lastIndex = 0;
  const tabs = createTabsController(tablist, {
    onChange: (i) => {
      lastIndex = i;
    },
  });

  tabs.activate(1);
  assert.equal(lastIndex, 1);

  tabs.destroy();
});
