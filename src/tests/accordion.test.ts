import { test } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import { createAccordionController } from "../helix/primitives/accordion.js";

const dom = new JSDOM("<!DOCTYPE html>");
global.document = dom.window.document as any;
global.window = dom.window as any;

function makeAccordionRoot(): HTMLElement {
  const root = document.createElement("div");

  for (let index = 0; index < 2; index += 1) {
    const item = document.createElement("section");
    item.setAttribute("data-hx-accordion-item", "true");

    const trigger = document.createElement("button");
    trigger.setAttribute("data-hx-accordion-trigger", "true");
    trigger.textContent = `Section ${index + 1}`;

    const content = document.createElement("div");
    content.setAttribute("data-hx-accordion-content", "true");
    content.textContent = `Content ${index + 1}`;

    item.appendChild(trigger);
    item.appendChild(content);
    root.appendChild(item);
  }

  document.body.appendChild(root);
  return root;
}

test("accordion: toggle and openItems", () => {
  const root = makeAccordionRoot();
  const accordion = createAccordionController(root);

  accordion.open(0);
  assert.deepEqual(accordion.openItems(), [0]);

  accordion.toggle(1);
  assert.deepEqual(accordion.openItems(), [1]);

  accordion.toggle(1);
  assert.deepEqual(accordion.openItems(), []);

  accordion.destroy();
});

test("accordion: wires aria-expanded and region role", () => {
  const root = makeAccordionRoot();
  const accordion = createAccordionController(root, { defaultValue: [0] });

  const trigger = root.querySelector("[data-hx-accordion-trigger]");
  const content = root.querySelector("[data-hx-accordion-content]");

  assert.equal(trigger?.getAttribute("aria-expanded"), "true");
  assert.equal(content?.getAttribute("role"), "region");

  accordion.destroy();
});
