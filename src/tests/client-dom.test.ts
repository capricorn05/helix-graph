import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  bindTargetValue,
  bindTargetTextValue,
  createDomTargetScope,
  listenToTarget,
  readCheckboxChecked,
  readFileList,
  readRadioGroupValue,
  readSelectMultipleValues,
} from "../helix/client-dom.js";

function installDomGlobals(dom: JSDOM): void {
  (globalThis as unknown as { window: Window }).window =
    dom.window as unknown as Window;
  (globalThis as unknown as { document: Document }).document =
    dom.window.document;
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
      HTMLSelectElement: typeof dom.window.HTMLSelectElement;
    }
  ).HTMLSelectElement = dom.window.HTMLSelectElement;
  (globalThis as unknown as { Event: typeof dom.window.Event }).Event =
    dom.window.Event;
}

test("createDomTargetScope queries scoped data-hx-id targets", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <section data-hx-id="scope-a">
      <input data-hx-id="field" value="A" />
    </section>
    <section data-hx-id="scope-b">
      <input data-hx-id="field" value="B" />
    </section>
  </body>`);
  installDomGlobals(dom);

  const scopeA = createDomTargetScope(
    dom.window.document.querySelector('[data-hx-id="scope-a"]') as ParentNode,
  );
  const scopeB = createDomTargetScope(
    dom.window.document.querySelector('[data-hx-id="scope-b"]') as ParentNode,
  );

  assert.equal(scopeA.query("field", HTMLInputElement)?.value, "A");
  assert.equal(scopeB.query("field", HTMLInputElement)?.value, "B");
  assert.equal(scopeA.has("field"), true);
  assert.equal(scopeA.has("missing"), false);
});

test("bindTargetTextValue infers input vs change events", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <div data-hx-id="root">
      <input data-hx-id="message" value="Hello" />
      <select data-hx-id="choice">
        <option value="a">A</option>
        <option value="b" selected>B</option>
      </select>
    </div>
  </body>`);
  installDomGlobals(dom);

  const root = dom.window.document.querySelector('[data-hx-id="root"]');
  assert.ok(root instanceof dom.window.HTMLElement);

  const seen: string[] = [];
  const inputBinding = bindTargetTextValue({
    root,
    targetId: "message",
    type: HTMLInputElement,
    onValue: (value) => {
      seen.push(`input:${value}`);
    },
  });
  const selectBinding = bindTargetTextValue({
    root,
    targetId: "choice",
    type: HTMLSelectElement,
    onValue: (value) => {
      seen.push(`select:${value}`);
    },
  });

  const input = root.querySelector('[data-hx-id="message"]');
  const select = root.querySelector('[data-hx-id="choice"]');
  assert.ok(input instanceof dom.window.HTMLInputElement);
  assert.ok(select instanceof dom.window.HTMLSelectElement);

  input.value = "Updated";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

  select.value = "a";
  select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

  assert.deepEqual(seen, ["input:Updated", "select:a"]);

  inputBinding?.destroy();
  selectBinding?.destroy();
});

test("listenToTarget returns null for missing targets and cleans up listeners", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <div data-hx-id="root">
      <button data-hx-id="trigger">Run</button>
    </div>
  </body>`);
  installDomGlobals(dom);

  const root = dom.window.document.querySelector('[data-hx-id="root"]');
  assert.ok(root instanceof dom.window.HTMLElement);

  assert.equal(
    listenToTarget({
      root,
      targetId: "missing",
      type: HTMLElement,
      event: "click",
      listener: () => undefined,
    }),
    null,
  );

  let calls = 0;
  const binding = listenToTarget({
    root,
    targetId: "trigger",
    type: HTMLElement,
    event: "click",
    listener: () => {
      calls += 1;
    },
  });

  const button = root.querySelector('[data-hx-id="trigger"]');
  assert.ok(button instanceof dom.window.HTMLElement);
  button.click();
  binding?.destroy();
  button.click();

  assert.equal(calls, 1);
});

test("bindTargetValue supports checkbox and radio model values", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <div data-hx-id="root">
      <input data-hx-id="enabled" type="checkbox" />
      <input data-hx-id="plan-free" type="radio" name="plan" value="free" />
      <input data-hx-id="plan-pro" type="radio" name="plan" value="pro" />
    </div>
  </body>`);
  installDomGlobals(dom);

  const root = dom.window.document.querySelector('[data-hx-id="root"]');
  assert.ok(root instanceof dom.window.HTMLElement);

  const seen: Array<string | boolean | null> = [];

  const checkboxBinding = bindTargetValue({
    root,
    targetId: "enabled",
    type: HTMLInputElement,
    readValue: (element) => readCheckboxChecked(element),
    onValue: (value) => {
      seen.push(value);
    },
  });

  const radioBinding = bindTargetValue({
    root,
    targetId: "plan-pro",
    type: HTMLInputElement,
    readValue: (element) => readRadioGroupValue(element, root),
    onValue: (value) => {
      seen.push(value);
    },
  });

  const checkbox = root.querySelector('[data-hx-id="enabled"]');
  const proRadio = root.querySelector('[data-hx-id="plan-pro"]');
  assert.ok(checkbox instanceof dom.window.HTMLInputElement);
  assert.ok(proRadio instanceof dom.window.HTMLInputElement);

  checkbox.checked = true;
  checkbox.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

  proRadio.checked = true;
  proRadio.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

  assert.deepEqual(seen, [true, "pro"]);

  checkboxBinding?.destroy();
  radioBinding?.destroy();
});

test("bindTargetValue supports file input and select-multiple values", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <div data-hx-id="root">
      <input data-hx-id="upload" type="file" />
      <select data-hx-id="tags" multiple>
        <option value="alpha">Alpha</option>
        <option value="beta">Beta</option>
        <option value="gamma">Gamma</option>
      </select>
    </div>
  </body>`);
  installDomGlobals(dom);

  const root = dom.window.document.querySelector('[data-hx-id="root"]');
  assert.ok(root instanceof dom.window.HTMLElement);

  let receivedFiles: FileList | null = null;
  let receivedTags: string[] = [];

  const fileBinding = bindTargetValue({
    root,
    targetId: "upload",
    type: HTMLInputElement,
    readValue: (element) => readFileList(element),
    onValue: (files) => {
      receivedFiles = files;
    },
  });

  const tagsBinding = bindTargetValue({
    root,
    targetId: "tags",
    type: HTMLSelectElement,
    readValue: (element) => readSelectMultipleValues(element),
    onValue: (values) => {
      receivedTags = values;
    },
  });

  const upload = root.querySelector('[data-hx-id="upload"]');
  const tags = root.querySelector('[data-hx-id="tags"]');
  assert.ok(upload instanceof dom.window.HTMLInputElement);
  assert.ok(tags instanceof dom.window.HTMLSelectElement);

  const file = new dom.window.File(["hello"], "hello.txt", {
    type: "text/plain",
  });
  const fileList = {
    0: file,
    length: 1,
    item(index: number) {
      return index === 0 ? file : null;
    },
  } as unknown as FileList;

  Object.defineProperty(upload, "files", {
    configurable: true,
    value: fileList,
  });
  upload.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

  tags.options[0]!.selected = true;
  tags.options[2]!.selected = true;
  tags.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

  assert.equal((receivedFiles as FileList | null)?.item(0)?.name, "hello.txt");
  assert.deepEqual(receivedTags, ["alpha", "gamma"]);

  fileBinding?.destroy();
  tagsBinding?.destroy();
});
