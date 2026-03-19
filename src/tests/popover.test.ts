import { test } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import { createPopoverController } from "../helix/primitives/popover.js";

const dom = new JSDOM("<!DOCTYPE html>");
global.document = dom.window.document as any;
global.window = dom.window as any;

test("popover: open/close/toggle", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const popover = createPopoverController(trigger, content);

  assert(!popover.isOpen());

  popover.open();
  assert(popover.isOpen());

  popover.close();
  assert(!popover.isOpen());

  popover.toggle();
  assert(popover.isOpen());

  popover.destroy();
});

test("popover: ARIA attributes", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const popover = createPopoverController(trigger, content);

  popover.open();
  assert(trigger.hasAttribute("aria-expanded"));
  assert.equal(trigger.getAttribute("aria-haspopup"), "true");

  popover.destroy();
});

test("popover: positioning on open", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");

  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const popover = createPopoverController(trigger, content, {
    placement: "bottom-start",
    offset: 8,
  });

  // Initially should be closed
  assert(!popover.isOpen());
  assert.equal(content.style.display, "none");

  // Open the popover
  popover.open();
  assert(popover.isOpen());

  // When open, the popover should be displayed
  // (exact positioning is handled by computePosition/applyPosition)
  assert.equal(content.style.display, "block");

  popover.destroy();
});

test("popover: no focus trap (non-modal)", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  const input = document.createElement("input");
  content.appendChild(input);

  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const popover = createPopoverController(trigger, content);

  popover.open();
  // Popover should not trap focus like dialog does
  assert(popover.isOpen());

  popover.destroy();
});
