import { test } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import { createSelectController } from "../helix/primitives/select.js";

const dom = new JSDOM("<!DOCTYPE html>");
global.document = dom.window.document as any;
global.window = dom.window as any;

function makeSelectFixture() {
  const trigger = document.createElement("button");
  const list = document.createElement("div");

  ["Apple", "Banana", "Cherry"].forEach((label) => {
    const option = document.createElement("div");
    option.setAttribute("data-hx-option", "true");
    option.setAttribute("data-hx-value", label.toLowerCase());
    option.textContent = label;
    list.appendChild(option);
  });

  document.body.appendChild(trigger);
  document.body.appendChild(list);
  return { trigger, list };
}

test("select: open and choose option", () => {
  const { trigger, list } = makeSelectFixture();
  const select = createSelectController(trigger, list, { portal: false });

  select.open();
  assert.equal(select.isOpen(), true);
  assert.equal(list.getAttribute("role"), "listbox");

  select.select("banana");
  assert.equal(select.value(), "banana");
  assert.equal(trigger.getAttribute("data-hx-label"), "Banana");
  assert.equal(select.isOpen(), false);

  select.destroy();
});
