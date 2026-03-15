import assert from "node:assert/strict";
import test from "node:test";
import { compileTsxViewSource } from "../helix/tsx-view-compiler.js";
import {
  renderCompiledView,
  type CompiledViewArtifact,
} from "../helix/view-compiler.js";
import type { BindingMap } from "../helix/types.js";

const EMPTY_BINDING_MAP: BindingMap = {
  events: {},
  lists: {},
};

test("renderCompiledView escapes text/attr and preserves html patches", () => {
  const artifact: CompiledViewArtifact<{
    attrValue: string;
    textValue: string;
    htmlValue: string;
    boolValue: boolean;
  }> = {
    template:
      '<div data-safe="__HX_ATTR__">__HX_TEXT____HX_HTML____HX_BOOL__</div>',
    patches: [
      {
        kind: "attr",
        token: "__HX_ATTR__",
        targetId: "safe-attr",
        attrName: "data-safe",
        evaluate: (props) => props.attrValue,
      },
      {
        kind: "text",
        token: "__HX_TEXT__",
        targetId: "safe-text",
        evaluate: (props) => props.textValue,
      },
      {
        kind: "html",
        token: "__HX_HTML__",
        targetId: "html-slot",
        evaluate: (props) => props.htmlValue,
      },
      {
        kind: "text",
        token: "__HX_BOOL__",
        targetId: "bool-slot",
        evaluate: (props) => props.boolValue,
      },
    ],
    bindingMap: EMPTY_BINDING_MAP,
  };

  const rendered = renderCompiledView(artifact, {
    attrValue: 'x"&<',
    textValue: "<safe>",
    htmlValue: "<strong>raw</strong>",
    boolValue: true,
  });

  assert.equal(
    rendered,
    '<div data-safe="x&quot;&amp;&lt;">&lt;safe&gt;<strong>raw</strong></div>',
  );
});

test("renderCompiledView rejects duplicate patch tokens", () => {
  const artifact: CompiledViewArtifact<{ value: string }> = {
    template: "__DUP__",
    patches: [
      {
        kind: "text",
        token: "__DUP__",
        targetId: "first",
        evaluate: (props) => props.value,
      },
      {
        kind: "text",
        token: "__DUP__",
        targetId: "second",
        evaluate: (props) => props.value,
      },
    ],
    bindingMap: EMPTY_BINDING_MAP,
  };

  assert.throws(
    () => renderCompiledView(artifact, { value: "ok" }),
    /duplicate patch token/i,
  );
});

test("renderCompiledView rejects patch tokens missing from template", () => {
  const artifact: CompiledViewArtifact<{ value: string }> = {
    template: "<div></div>",
    patches: [
      {
        kind: "text",
        token: "__MISSING__",
        targetId: "missing",
        evaluate: (props) => props.value,
      },
    ],
    bindingMap: EMPTY_BINDING_MAP,
  };

  assert.throws(
    () => renderCompiledView(artifact, { value: "ok" }),
    /missing from template/i,
  );
});

test("compileTsxViewSource infers event and list bindings", () => {
  const source = `
export default function DemoView(props: { rowsHtml: string }) {
  return (
    <section data-hx-id="demo-root">
      <button data-hx-bind="save-user">Save</button>
      <form data-hx-bind="save-form"></form>
      <table>
        <tbody data-hx-list="users-body">
          <hx-slot value={props.rowsHtml} />
        </tbody>
      </table>
    </section>
  );
}
`;

  const { compiled } = compileTsxViewSource("/tmp/demo.view.tsx", source);

  assert.equal(compiled.bindings.get("save-user"), "click");
  assert.equal(compiled.bindings.get("save-form"), "submit");
  assert.ok(compiled.lists.includes("users-body"));
});

test("compileTsxViewSource rejects duplicate data-hx-id values", () => {
  const source = `
export default function DuplicateView(props: { value: string }) {
  return (
    <div>
      <span data-hx-id="dup">A</span>
      <span data-hx-id="dup">B</span>
      <hx-slot value={props.value} />
    </div>
  );
}
`;

  assert.throws(
    () => compileTsxViewSource("/tmp/duplicate.view.tsx", source),
    /Duplicate data-hx-id target/i,
  );
});

test("compileTsxViewSource rejects inline JSX handlers", () => {
  const source = `
export default function InlineHandlerView(props: { label: string }) {
  return <button onClick={() => props.label}>Click</button>;
}
`;

  assert.throws(
    () => compileTsxViewSource("/tmp/inline-handler.view.tsx", source),
    /Inline handler expressions are not supported/i,
  );
});

test("compileTsxViewSource rejects dynamic data-hx-bind", () => {
  const source = `
export default function DynamicBindView(props: { bindId: string }) {
  return <button data-hx-bind={props.bindId}>Click</button>;
}
`;

  assert.throws(
    () => compileTsxViewSource("/tmp/dynamic-bind.view.tsx", source),
    /Dynamic data-hx-bind values are not supported/i,
  );
});
