import { test } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import { createTooltipController } from "../helix/primitives/tooltip.js";

const dom = new JSDOM("<!DOCTYPE html>");
global.document = dom.window.document as any;
global.window = dom.window as any;

test("tooltip: open and close update state and aria", () => {
  const trigger = document.createElement("button");
  const content = document.createElement("div");
  document.body.appendChild(trigger);
  document.body.appendChild(content);

  const tooltip = createTooltipController(trigger, content, { portal: false });

  tooltip.open();
  assert.equal(tooltip.isOpen(), true);
  assert.equal(content.getAttribute("role"), "tooltip");
  assert.equal(trigger.hasAttribute("aria-describedby"), true);

  tooltip.close();
  assert.equal(tooltip.isOpen(), false);
  assert.equal(content.style.display, "none");

  tooltip.destroy();
});
