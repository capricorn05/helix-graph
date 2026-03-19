import { test } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import { createDropdownController } from "../helix/primitives/dropdown.js";

const dom = new JSDOM("<!DOCTYPE html>");
global.document = dom.window.document as any;
global.window = dom.window as any;

test("dropdown: opens and marks dropdown attributes", () => {
  const trigger = document.createElement("button");
  const menu = document.createElement("ul");
  const item = document.createElement("li");
  item.setAttribute("role", "menuitem");
  item.tabIndex = 0;
  menu.appendChild(item);
  document.body.appendChild(trigger);
  document.body.appendChild(menu);

  const dropdown = createDropdownController(trigger, menu, { portal: false });

  dropdown.open();
  assert.equal(dropdown.isOpen(), true);
  assert.equal(menu.getAttribute("data-hx-dropdown"), "true");
  assert.equal(trigger.getAttribute("data-hx-dropdown-trigger"), "true");

  dropdown.destroy();
});
