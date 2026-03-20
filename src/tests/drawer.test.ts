import { test } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import { createDrawerController } from "../helix/primitives/drawer.js";

const dom = new JSDOM("<!DOCTYPE html>");
global.document = dom.window.document as any;
global.window = dom.window as any;

test("drawer: open/close/toggle", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const drawer = createDrawerController(trigger, content, {
    closingDuration: 0,
  });

  assert(!drawer.isOpen());

  drawer.open();
  assert(drawer.isOpen());

  drawer.close();
  assert(!drawer.isOpen());

  drawer.toggle();
  assert(drawer.isOpen());

  drawer.destroy();
});

test("drawer: ARIA attributes on open", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const drawer = createDrawerController(trigger, content, {
    portal: false,
    closingDuration: 0,
  });

  drawer.open();
  assert.equal(content.getAttribute("role"), "dialog");
  assert.equal(content.getAttribute("aria-modal"), "true");
  assert.equal(content.getAttribute("data-hx-open"), "true");
  assert(trigger.hasAttribute("aria-expanded"));

  drawer.destroy();
});

test("drawer: data-hx-open tracks state", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const drawer = createDrawerController(trigger, content, {
    portal: false,
    closingDuration: 0,
  });

  assert.equal(content.getAttribute("data-hx-open"), "false");

  drawer.open();
  assert.equal(content.getAttribute("data-hx-open"), "true");

  drawer.close();
  assert.equal(content.getAttribute("data-hx-open"), "false");

  drawer.destroy();
});

test("drawer: outside click closes when dismissTarget is panel", () => {
  const trigger = document.createElement("button");
  const overlay = document.createElement("div");
  const panel = document.createElement("div");
  overlay.appendChild(panel);
  document.body.appendChild(trigger);
  document.body.appendChild(overlay);

  const drawer = createDrawerController(trigger, overlay, {
    portal: false,
    closingDuration: 0,
    dismissTarget: panel,
  });

  drawer.open();
  assert(drawer.isOpen());

  panel.dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true }));
  assert(drawer.isOpen());

  overlay.dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true }));
  assert(!drawer.isOpen());

  drawer.destroy();
});

test("drawer: data-hx-closing set during exit animation", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  // closingDuration > 0 so we can check the mid-flight state
  const drawer = createDrawerController(trigger, content, {
    portal: false,
    closingDuration: 100,
  });

  drawer.open();
  assert.equal(content.getAttribute("data-hx-closing"), null);

  drawer.close();
  // Immediately after close() the overlay should be flagged for exit animation
  assert.equal(content.getAttribute("data-hx-closing"), "true");
  // isOpen() is already false
  assert(!drawer.isOpen());

  drawer.destroy();
});

test("drawer: display:none applied after closingDuration", async () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const drawer = createDrawerController(trigger, content, {
    portal: false,
    closingDuration: 0,
  });

  drawer.open();
  assert.equal(content.style.display, "flex");

  drawer.close();

  await new Promise<void>((resolve) => setTimeout(resolve, 10));
  assert.equal(content.style.display, "none");

  drawer.destroy();
});

test("drawer: data-hx-side attribute reflects option", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const drawer = createDrawerController(trigger, content, {
    portal: false,
    side: "left",
    closingDuration: 0,
  });

  assert.equal(content.getAttribute("data-hx-side"), "left");

  drawer.destroy();
});

test("drawer: onChange callback fires on open and close", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const changes: boolean[] = [];
  const drawer = createDrawerController(trigger, content, {
    portal: false,
    closingDuration: 0,
    onChange: (v) => changes.push(v),
  });

  drawer.open();
  drawer.close();

  assert.deepEqual(changes, [true, false]);

  drawer.destroy();
});

test("drawer: defaultValue:true starts open", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const drawer = createDrawerController(trigger, content, {
    portal: false,
    defaultValue: true,
    closingDuration: 0,
  });

  assert(drawer.isOpen());
  assert.equal(content.style.display, "flex");

  drawer.destroy();
});
