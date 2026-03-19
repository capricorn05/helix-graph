import { test } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import { createComboboxController } from "../helix/primitives/combobox.js";

const dom = new JSDOM("<!DOCTYPE html>");
global.document = dom.window.document as any;
global.window = dom.window as any;

function makeComboboxFixture() {
  const input = document.createElement("input");
  const list = document.createElement("div");

  ["Apple", "Banana", "Cherry"].forEach((label) => {
    const option = document.createElement("div");
    option.setAttribute("data-hx-option", "true");
    option.setAttribute("data-hx-value", label.toLowerCase());
    option.textContent = label;
    list.appendChild(option);
  });

  document.body.appendChild(input);
  document.body.appendChild(list);
  return { input, list };
}

test("combobox: filters by query and selects visible option", () => {
  const { input, list } = makeComboboxFixture();
  const combobox = createComboboxController(input, list, { portal: false });

  combobox.setQuery("ban");
  combobox.open();
  combobox.select("banana");

  assert.equal(combobox.value(), "banana");
  assert.equal(input.value, "Banana");
  assert.equal(list.getAttribute("role"), "listbox");

  combobox.destroy();
});
