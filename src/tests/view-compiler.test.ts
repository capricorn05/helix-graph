import assert from "node:assert/strict";
import test from "node:test";
import { resetRuntimeGraph, runtimeGraph } from "../helix/graph.js";
import { compileTsxViewSource } from "../helix/tsx-view-compiler.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
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
    id: "view:test-render",
    label: "test-render",
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
    id: "view:test-duplicate",
    label: "test-duplicate",
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
    id: "view:test-missing",
    label: "test-missing",
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

test("defineCompiledViewArtifact registers a view node with a stable compiled id", () => {
  resetRuntimeGraph();

  const artifact = defineCompiledViewArtifact<{ value: string }>(
    compiledViewId("demo-view"),
    "demo-view",
    {
      template: "<div>demo</div>",
      patches: [],
      bindingMap: EMPTY_BINDING_MAP,
    },
  );

  assert.equal(artifact.id, "view:compiled:demo-view");
  assert.equal(runtimeGraph.getNode(artifact.id)?.type, "ViewNode");
  assert.equal(runtimeGraph.getNode(artifact.id)?.label, "demo-view");
});

test("compileTsxViewSource infers event and list bindings", () => {
  const source = `
export default function DemoView(props: { rowsHtml: string }) {
  return (
    <section data-hx-id="demo-root">
      <button data-hx-bind="save-user">Save</button>
      <form data-hx-bind="save-form"></form>
      <input data-hx-bind="filter-users" />
      <select data-hx-bind="set-sort"></select>
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
  assert.equal(compiled.bindings.get("filter-users"), "input");
  assert.equal(compiled.bindings.get("set-sort"), "change");
  assert.ok(compiled.lists.includes("users-body"));
});

test("compileTsxViewSource honors data-hx-event override", () => {
  const source = `
export default function DemoView(props: { unused?: boolean }) {
  return (
    <section>
      <button data-hx-bind="save-user" data-hx-event="keydown">Save</button>
    </section>
  );
}
`;

  const { compiled } = compileTsxViewSource("/tmp/demo-event.view.tsx", source);

  assert.equal(compiled.bindings.get("save-user"), "keydown");
  assert.doesNotMatch(compiled.template, /data-hx-event=/);
});

test("compileTsxViewSource emits html patch for uncompiledView escape hatch", () => {
  const source = `
import { uncompiledView } from "../helix/view-compiler.js";

export default function EscapeHatchView(props: { html: string }) {
  return <section>{uncompiledView(() => props.html)}</section>;
}
`;

  const { compiled } = compileTsxViewSource("/tmp/escape.view.tsx", source);

  assert.equal(compiled.patches.length, 1);
  assert.equal(compiled.patches[0]?.kind, "html");
  assert.equal(compiled.patches[0]?.expressionSource, "props.html");
  assert.match(compiled.template, /__HX_HTML_/);
  assert.doesNotMatch(compiled.template, /<span data-hx-id=/);
});

test("compileTsxViewSource emits clientOnly placeholder and serialized props patch", () => {
  const source = `
import { clientOnly } from "../helix/view-compiler.js";

export default function ClientOnlyView(props: { islandProps: { id: number } }) {
  return (
    <section>
      {clientOnly(() => import("/client/widgets/demo.js"), props.islandProps)}
    </section>
  );
}
`;

  const { compiled } = compileTsxViewSource(
    "/tmp/client-only.view.tsx",
    source,
  );

  assert.match(compiled.template, /data-hx-client-only=/);
  assert.match(
    compiled.template,
    /data-hx-client-module="\/client\/widgets\/demo\.js"/,
  );
  assert.equal(compiled.patches[0]?.kind, "attr");
  assert.equal(compiled.patches[0]?.attrName, "data-hx-client-props");
  assert.equal(
    compiled.patches[0]?.expressionSource,
    "serializeClientOnlyProps(props.islandProps)",
  );
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

test("compileTsxViewSource rejects dynamic data-hx-event", () => {
  const source = `
export default function DynamicEventView(props: { eventType: string }) {
  return <button data-hx-bind="save-user" data-hx-event={props.eventType}>Click</button>;
}
`;

  assert.throws(
    () => compileTsxViewSource("/tmp/dynamic-event.view.tsx", source),
    /Dynamic data-hx-event values are not supported/i,
  );
});
