import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBindingMapModuleSource,
  buildCompiledViewModuleSource,
} from "../helix/codegen-emitters.js";
import type { CompiledViewResult } from "../helix/tsx-view-compiler.js";

test("buildBindingMapModuleSource emits stable sorted binding map module", () => {
  const source = buildBindingMapModuleSource({
    generatedBy: "src/example/scripts/generate-binding-map.ts",
    bindingMapImportPath: "../../helix/index.js",
    bindingMapConstName: "appBindingMap",
    bindingMapBuilderName: "buildAppBindingMap",
    events: [
      {
        id: "save-user",
        event: "click",
        actionId: "saveUser",
        chunk: "/client/actions.js",
        handlerExport: "onSaveUser",
      },
      {
        id: "save-form",
        event: "submit",
        actionId: "saveForm",
        chunk: "/client/actions.js",
        handlerExport: "onSaveForm",
        preventDefault: true,
      },
    ],
    lists: [{ listId: "users-body", keyAttr: "data-hx-key" }],
  });

  const saveFormIndex = source.indexOf('"save-form": {');
  const saveUserIndex = source.indexOf('"save-user": {');
  assert.ok(saveFormIndex >= 0 && saveUserIndex >= 0);
  assert.ok(saveFormIndex < saveUserIndex);
  assert.match(source, /preventDefault: true,/);
  assert.match(source, /listId: "users-body"/);
  assert.match(
    source,
    /export function buildAppBindingMap\(\): BindingMap \{[\s\S]*return appBindingMap;/,
  );
});

test("buildCompiledViewModuleSource emits compiled view module with inferred binding metadata", () => {
  const compiled: CompiledViewResult = {
    template: '<button data-hx-bind="save-user">__HX_TEXT__</button>',
    patches: [
      {
        kind: "text",
        token: "__HX_TEXT__",
        targetId: "save-target",
        expressionSource: "props.label",
      },
    ],
    bindings: new Map([
      ["save-user", "click"],
      ["save-form", "submit"],
    ]),
    lists: ["users-body"],
  };

  const source = buildCompiledViewModuleSource({
    fileBasename: "demo-view",
    propsIdentifier: "props",
    compiled,
    bindingMapTypeImportPath: "../../../helix/types.js",
    viewCompilerImportPath: "../../../helix/view-compiler.js",
    bindingInference: {
      actionChunkPath: "/client/actions.js",
    },
  });

  assert.match(source, /export const demoViewCompiledArtifact/);
  assert.match(source, /renderDemoViewCompiledView\(props: any\)/);
  assert.match(source, /buildDemoViewCompiledBindingMap/);
  assert.match(source, /"save-form": \{[\s\S]*preventDefault: true,/);
  assert.match(source, /"users-body": \{[\s\S]*keyAttr: "data-hx-key",/);
  assert.match(source, /evaluate: \(props: any\) => \(props\.label\),/);
});
