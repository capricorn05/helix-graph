import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import {
  getTypeScriptScriptKind,
  parseTypeScriptSourceFile,
  toCamelCase,
  toPascalCase,
} from "../helix/compiler-utils.js";

test("compiler case helpers normalize kebab and snake case", () => {
  assert.equal(toPascalCase("external-media_detail"), "ExternalMediaDetail");
  assert.equal(toCamelCase("external-media_detail"), "externalMediaDetail");
});

test("getTypeScriptScriptKind and parseTypeScriptSourceFile support tsx inputs", () => {
  assert.equal(
    getTypeScriptScriptKind("/tmp/demo.view.tsx"),
    ts.ScriptKind.TSX,
  );
  assert.equal(getTypeScriptScriptKind("/tmp/demo.view.ts"), ts.ScriptKind.TS);

  const sourceFile = parseTypeScriptSourceFile(
    "/tmp/demo.view.tsx",
    "export default function Demo() { return <div />; }",
  );

  const declaration = sourceFile.statements[0];
  assert.ok(ts.isFunctionDeclaration(declaration));
  const returnStatement = declaration.body?.statements[0];
  assert.ok(returnStatement && ts.isReturnStatement(returnStatement));
  assert.ok(
    returnStatement.expression &&
      ts.isJsxSelfClosingElement(returnStatement.expression),
  );
});
