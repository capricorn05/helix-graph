import { test } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import { createDialogController } from "../helix/primitives/dialog.js";

const dom = new JSDOM("<!DOCTYPE html>");
global.document = dom.window.document as any;
global.window = dom.window as any;

test("dialog: open/close/toggle", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const dialog = createDialogController(trigger, content);

  assert(!dialog.isOpen());

  dialog.open();
  assert(dialog.isOpen());

  dialog.close();
  assert(!dialog.isOpen());

  dialog.toggle();
  assert(dialog.isOpen());

  dialog.destroy();
});

test("dialog: ARIA attributes", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const dialog = createDialogController(trigger, content);

  dialog.open();
  assert.equal(content.getAttribute("role"), "dialog");
  assert.equal(content.getAttribute("aria-modal"), "true");
  assert(trigger.hasAttribute("aria-expanded"));

  dialog.destroy();
});

test("dialog: uncontrolled via defaultOpen", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const dialog = createDialogController(trigger, content, {
    defaultValue: true,
  });

  assert(dialog.isOpen());
  dialog.destroy();
});

test("dialog: onChange callback", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  let lastValue = false;
  const dialog = createDialogController(trigger, content, {
    onChange: (v) => {
      lastValue = v;
    },
  });

  dialog.open();
  assert.equal(lastValue, true);

  dialog.close();
  assert.equal(lastValue, false);

  dialog.destroy();
});

test("dialog: openDisplay controls visible display mode", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const dialog = createDialogController(trigger, content, {
    portal: false,
    openDisplay: "flex",
  });

  dialog.open();
  assert.equal(content.style.display, "flex");

  dialog.destroy();
});
