import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { PatchRuntime } from "../helix/patch.js";

function installDomGlobals(dom: JSDOM): void {
  (globalThis as unknown as { Element: typeof dom.window.Element }).Element =
    dom.window.Element;
  (
    globalThis as unknown as { HTMLElement: typeof dom.window.HTMLElement }
  ).HTMLElement = dom.window.HTMLElement;
  (
    globalThis as unknown as {
      HTMLInputElement: typeof dom.window.HTMLInputElement;
    }
  ).HTMLInputElement = dom.window.HTMLInputElement;
  (
    globalThis as unknown as {
      HTMLTextAreaElement: typeof dom.window.HTMLTextAreaElement;
    }
  ).HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  (
    globalThis as unknown as {
      HTMLSelectElement: typeof dom.window.HTMLSelectElement;
    }
  ).HTMLSelectElement = dom.window.HTMLSelectElement;
}

test("PatchRuntime applies each patch operation variant", () => {
  const dom = new JSDOM(`
    <div data-hx-id="txt"></div>
    <div data-hx-id="attr"></div>
    <div data-hx-id="klass"></div>
    <input data-hx-id="input" />
    <input type="checkbox" data-hx-id="check" />
    <div data-hx-id="style"></div>
  `);
  installDomGlobals(dom);

  const runtime = new PatchRuntime(dom.window.document);

  runtime.apply({ op: "setText", targetId: "txt", value: "hello" });
  assert.equal(
    dom.window.document.querySelector('[data-hx-id="txt"]')?.textContent,
    "hello",
  );

  runtime.apply({
    op: "setAttr",
    targetId: "attr",
    name: "data-test",
    value: "x",
  });
  assert.equal(
    dom.window.document
      .querySelector('[data-hx-id="attr"]')
      ?.getAttribute("data-test"),
    "x",
  );

  runtime.apply({
    op: "setAttr",
    targetId: "attr",
    name: "data-test",
    value: null,
  });
  assert.equal(
    dom.window.document
      .querySelector('[data-hx-id="attr"]')
      ?.hasAttribute("data-test"),
    false,
  );

  runtime.apply({
    op: "toggleClass",
    targetId: "klass",
    className: "active",
    enabled: true,
  });
  assert.equal(
    dom.window.document
      .querySelector('[data-hx-id="klass"]')
      ?.classList.contains("active"),
    true,
  );

  runtime.apply({ op: "setValue", targetId: "input", value: "abc" });
  assert.equal(
    (
      dom.window.document.querySelector(
        '[data-hx-id="input"]',
      ) as HTMLInputElement
    ).value,
    "abc",
  );

  runtime.apply({ op: "setChecked", targetId: "check", value: true });
  assert.equal(
    (
      dom.window.document.querySelector(
        '[data-hx-id="check"]',
      ) as HTMLInputElement
    ).checked,
    true,
  );

  runtime.apply({
    op: "setStyle",
    targetId: "style",
    prop: "color",
    value: "red",
  });
  assert.equal(
    (dom.window.document.querySelector('[data-hx-id="style"]') as HTMLElement)
      .style.color,
    "red",
  );
});

test("PatchRuntime throws when target is missing", () => {
  const dom = new JSDOM('<div data-hx-id="present"></div>');
  installDomGlobals(dom);

  const runtime = new PatchRuntime(dom.window.document);
  assert.throws(() => {
    runtime.apply({ op: "setText", targetId: "missing", value: "x" });
  }, /Patch target not found/);
});
