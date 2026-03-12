import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

type BindingEvent = "click" | "submit";
type PatchKind = "text" | "attr" | "html";

interface PatchDescriptor {
  kind: PatchKind;
  token: string;
  targetId: string;
  expressionSource: string;
  attrName?: string;
}

interface CompiledViewResult {
  template: string;
  patches: PatchDescriptor[];
  bindings: Map<string, BindingEvent>;
}

interface CompileState {
  sourceFile: ts.SourceFile;
  viewSlug: string;
  tokenCounter: number;
  autoTargetCounter: number;
  patches: PatchDescriptor[];
  bindings: Map<string, BindingEvent>;
}

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function toPascalCase(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.length === 0 ? "" : pascal[0].toLowerCase() + pascal.slice(1);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nextTargetId(state: CompileState): string {
  state.autoTargetCounter += 1;
  return `hx-${state.viewSlug}-slot-${state.autoTargetCounter}`;
}

function nextToken(
  state: CompileState,
  kind: PatchKind,
  targetId: string,
  attrName?: string,
): string {
  state.tokenCounter += 1;
  if (kind === "html") {
    return `__HX_HTML_${state.viewSlug}_${state.tokenCounter}_${targetId}__`;
  }

  if (kind === "attr") {
    const safeAttr = (attrName ?? "attr").replace(/[^a-zA-Z0-9_-]/g, "-");
    return `__HX_ATTR_${state.viewSlug}_${safeAttr}_${state.tokenCounter}_${targetId}__`;
  }

  return `__HX_TEXT_${state.viewSlug}_${state.tokenCounter}_${targetId}__`;
}

function jsxTagNameText(
  sourceFile: ts.SourceFile,
  name: ts.JsxTagNameExpression,
): string {
  if (ts.isIdentifier(name)) {
    return name.text;
  }

  if (
    ts.isPropertyAccessExpression(name) ||
    name.kind === ts.SyntaxKind.ThisKeyword
  ) {
    return name.getText(sourceFile);
  }

  throw new Error(
    `Unsupported JSX tag name in ${sourceFile.fileName}: ${name.getText(sourceFile)}`,
  );
}

function normalizeAttrName(name: string): string {
  return name === "className" ? "class" : name;
}

function jsxAttributeNameText(name: ts.JsxAttributeName): string {
  if (ts.isIdentifier(name)) {
    return name.text;
  }

  if (ts.isJsxNamespacedName(name)) {
    return `${name.namespace.text}:${name.name.text}`;
  }

  throw new Error("Unsupported JSX attribute name node");
}

function expressionSourceOrThrow(
  sourceFile: ts.SourceFile,
  expression: ts.Expression | undefined,
): string {
  if (!expression) {
    throw new Error(
      `Unsupported empty JSX expression in ${sourceFile.fileName}`,
    );
  }

  return expression.getText(sourceFile).trim();
}

function renderAttributes(
  state: CompileState,
  tagName: string,
  attributes: ts.JsxAttributes,
): string {
  const rendered: string[] = [];
  let targetId: string | null = null;
  let hasRenderedDataHxId = false;

  for (const property of attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) {
      throw new Error(
        `JSX spread attributes are not supported in compiler MVP (${state.sourceFile.fileName})`,
      );
    }

    const rawAttrName = jsxAttributeNameText(property.name);
    const attrName = normalizeAttrName(rawAttrName);
    const initializer = property.initializer;

    if (!initializer) {
      rendered.push(`${attrName}`);
      continue;
    }

    if (ts.isStringLiteral(initializer)) {
      const value = initializer.text;
      rendered.push(`${attrName}="${escapeHtml(value)}"`);

      if (attrName === "data-hx-id") {
        targetId = value;
        hasRenderedDataHxId = true;
      }

      if (attrName === "data-hx-bind") {
        const event: BindingEvent =
          tagName.toLowerCase() === "form" ? "submit" : "click";
        state.bindings.set(value, event);
      }

      continue;
    }

    if (ts.isJsxExpression(initializer)) {
      const expressionSource = expressionSourceOrThrow(
        state.sourceFile,
        initializer.expression,
      );

      if (attrName === "data-hx-id") {
        throw new Error(
          `Dynamic data-hx-id is not supported in compiler MVP (${state.sourceFile.fileName})`,
        );
      }

      if (!targetId) {
        targetId = nextTargetId(state);
      }

      const token = nextToken(state, "attr", targetId, attrName);
      state.patches.push({
        kind: "attr",
        token,
        targetId,
        attrName,
        expressionSource,
      });
      rendered.push(`${attrName}="${token}"`);
      continue;
    }

    throw new Error(
      `Unsupported JSX attribute initializer in ${state.sourceFile.fileName}`,
    );
  }

  if (targetId && !hasRenderedDataHxId) {
    rendered.push(`data-hx-id="${escapeHtml(targetId)}"`);
  }

  return rendered.length > 0 ? ` ${rendered.join(" ")}` : "";
}

function compileJsxChild(state: CompileState, child: ts.JsxChild): string {
  if (ts.isJsxText(child)) {
    return escapeHtml(child.getText(state.sourceFile));
  }

  if (ts.isJsxExpression(child)) {
    if (!child.expression) {
      return "";
    }

    const targetId = nextTargetId(state);
    const token = nextToken(state, "text", targetId);
    const expressionSource = expressionSourceOrThrow(
      state.sourceFile,
      child.expression,
    );

    state.patches.push({
      kind: "text",
      token,
      targetId,
      expressionSource,
    });

    return `<span data-hx-id="${escapeHtml(targetId)}">${token}</span>`;
  }

  if (ts.isJsxElement(child)) {
    return compileJsxElement(state, child);
  }

  if (ts.isJsxSelfClosingElement(child)) {
    return compileJsxSelfClosingElement(state, child);
  }

  if (ts.isJsxFragment(child)) {
    return compileJsxChildren(state, child.children);
  }

  throw new Error(`Unsupported JSX child in ${state.sourceFile.fileName}`);
}

function compileJsxChildren(
  state: CompileState,
  children: ts.NodeArray<ts.JsxChild>,
): string {
  return children.map((child) => compileJsxChild(state, child)).join("");
}

function compileHxSlotElement(
  state: CompileState,
  node: ts.JsxSelfClosingElement,
): string {
  let valueExpression: ts.Expression | undefined;
  let explicitTargetId: string | null = null;

  for (const property of node.attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) {
      throw new Error(
        `JSX spread attributes are not supported on hx-slot (${state.sourceFile.fileName})`,
      );
    }

    const attrName = jsxAttributeNameText(property.name);

    if (attrName === "value") {
      if (!property.initializer || !ts.isJsxExpression(property.initializer)) {
        throw new Error(
          `hx-slot value must be a JSX expression in ${state.sourceFile.fileName}`,
        );
      }

      valueExpression = property.initializer.expression;
      continue;
    }

    if (attrName === "target") {
      if (!property.initializer || !ts.isStringLiteral(property.initializer)) {
        throw new Error(
          `hx-slot target must be a string literal in ${state.sourceFile.fileName}`,
        );
      }

      explicitTargetId = property.initializer.text;
      continue;
    }

    throw new Error(
      `Unsupported hx-slot attribute "${attrName}" in ${state.sourceFile.fileName}`,
    );
  }

  if (!valueExpression) {
    throw new Error(
      `hx-slot requires a value expression in ${state.sourceFile.fileName}`,
    );
  }

  const targetId = explicitTargetId ?? nextTargetId(state);
  const token = nextToken(state, "html", targetId);
  const expressionSource = expressionSourceOrThrow(
    state.sourceFile,
    valueExpression,
  );

  state.patches.push({
    kind: "html",
    token,
    targetId,
    expressionSource,
  });

  return token;
}

function compileJsxSelfClosingElement(
  state: CompileState,
  node: ts.JsxSelfClosingElement,
): string {
  const tagName = jsxTagNameText(state.sourceFile, node.tagName);

  if (tagName === "hx-slot") {
    return compileHxSlotElement(state, node);
  }

  const attrs = renderAttributes(state, tagName, node.attributes);

  if (VOID_TAGS.has(tagName.toLowerCase())) {
    return `<${tagName}${attrs} />`;
  }

  return `<${tagName}${attrs}></${tagName}>`;
}

function compileJsxElement(state: CompileState, node: ts.JsxElement): string {
  const tagName = jsxTagNameText(state.sourceFile, node.openingElement.tagName);

  if (tagName === "hx-slot") {
    throw new Error(
      `Use self-closing syntax for hx-slot in ${state.sourceFile.fileName}`,
    );
  }

  const attrs = renderAttributes(
    state,
    tagName,
    node.openingElement.attributes,
  );
  const inner = compileJsxChildren(state, node.children);

  return `<${tagName}${attrs}>${inner}</${tagName}>`;
}

function unwrapParenthesizedExpression(
  expression: ts.Expression,
): ts.Expression {
  let current: ts.Expression = expression;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
}

function findDefaultViewFactory(sourceFile: ts.SourceFile): {
  propsIdentifier: string;
  jsx: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment;
} {
  for (const statement of sourceFile.statements) {
    if (!ts.isFunctionDeclaration(statement)) {
      continue;
    }

    const modifiers = statement.modifiers;
    const isDefaultExport =
      modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ) &&
      modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
      );

    if (!isDefaultExport) {
      continue;
    }

    const firstParam = statement.parameters[0];
    if (!firstParam || !ts.isIdentifier(firstParam.name)) {
      throw new Error(
        `Default exported TSX view must have an identifier parameter in ${sourceFile.fileName}`,
      );
    }

    if (!statement.body) {
      throw new Error(
        `Default exported TSX view has no body in ${sourceFile.fileName}`,
      );
    }

    for (const bodyStatement of statement.body.statements) {
      if (!ts.isReturnStatement(bodyStatement) || !bodyStatement.expression) {
        continue;
      }

      const returned = unwrapParenthesizedExpression(bodyStatement.expression);

      if (
        ts.isJsxElement(returned) ||
        ts.isJsxSelfClosingElement(returned) ||
        ts.isJsxFragment(returned)
      ) {
        return {
          propsIdentifier: firstParam.name.text,
          jsx: returned,
        };
      }
    }
  }

  throw new Error(
    `Could not find a default exported TSX view function with a JSX return in ${sourceFile.fileName}`,
  );
}

function inferHandlerExport(bindingId: string): string {
  return `on${toPascalCase(bindingId)}`;
}

function inferActionId(bindingId: string): string {
  return toCamelCase(bindingId);
}

function renderBindingMapSource(bindings: Map<string, BindingEvent>): string {
  const sortedBindings = Array.from(bindings.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  const events = sortedBindings
    .map(([id, event]) => {
      const lines = [
        `    "${id}": {`,
        `      id: "${id}",`,
        `      event: "${event}",`,
        `      actionId: "${inferActionId(id)}",`,
        '      chunk: "/client/actions.js",',
        `      handlerExport: "${inferHandlerExport(id)}",`,
      ];

      if (event === "submit") {
        lines.push("      preventDefault: true,");
      }

      lines.push("    }");
      return lines.join("\n");
    })
    .join(",\n");

  return `{
  events: {
${events}
  },
  lists: {},
}`;
}

function compileTsxView(
  sourceFile: ts.SourceFile,
  viewSlug: string,
): CompiledViewResult {
  const state: CompileState = {
    sourceFile,
    viewSlug,
    tokenCounter: 0,
    autoTargetCounter: 0,
    patches: [],
    bindings: new Map<string, BindingEvent>(),
  };

  const { jsx } = findDefaultViewFactory(sourceFile);

  const template = ts.isJsxElement(jsx)
    ? compileJsxElement(state, jsx)
    : ts.isJsxSelfClosingElement(jsx)
      ? compileJsxSelfClosingElement(state, jsx)
      : compileJsxChildren(state, jsx.children);

  return {
    template,
    patches: state.patches,
    bindings: state.bindings,
  };
}

function buildGeneratedModuleSource(
  fileBasename: string,
  propsIdentifier: string,
  compiled: CompiledViewResult,
): string {
  const viewPascal = toPascalCase(fileBasename);
  const viewCamel = toCamelCase(fileBasename);
  const artifactName = `${viewCamel}CompiledArtifact`;
  const renderFnName = `render${viewPascal}CompiledView`;
  const bindingFnName = `build${viewPascal}CompiledBindingMap`;

  const patchesSource = compiled.patches
    .map((patch) => {
      const shared = [
        `      kind: "${patch.kind}",`,
        `      token: ${JSON.stringify(patch.token)},`,
        `      targetId: ${JSON.stringify(patch.targetId)},`,
      ];

      if (patch.kind === "attr") {
        shared.push(`      attrName: ${JSON.stringify(patch.attrName ?? "")},`);
      }

      shared.push(
        `      evaluate: (${propsIdentifier}: any) => (${patch.expressionSource}),`,
      );

      return `    {\n${shared.join("\n")}\n    }`;
    })
    .join(",\n");

  const bindingMapSource = renderBindingMapSource(compiled.bindings);

  return `import type { BindingMap } from "../../../helix/types.js";
import {
  renderCompiledView,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

const compiledBindingMap: BindingMap = ${bindingMapSource};

export const ${artifactName}: CompiledViewArtifact<any> = {
  template: ${JSON.stringify(compiled.template)},
  patches: [
${patchesSource}
  ],
  bindingMap: compiledBindingMap,
};

export function ${renderFnName}(${propsIdentifier}: any): string {
  return renderCompiledView(${artifactName}, ${propsIdentifier});
}

export function ${bindingFnName}(): BindingMap {
  return compiledBindingMap;
}

export const ${viewCamel}CompiledPatchTable = ${artifactName}.patches;
`;
}

async function listTsxFiles(dirPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.name.endsWith(".tsx")) {
        continue;
      }

      results.push(absolutePath);
    }
  }

  await walk(dirPath);
  return results.sort();
}

async function main(): Promise<void> {
  const checkMode = process.argv.includes("--check");
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(scriptDir, "../../..");
  const sourceRoot = path.join(workspaceRoot, "src/example/views-tsx");
  const outputRoot = path.join(workspaceRoot, "src/example/views/compiled");

  const sourceFiles = await listTsxFiles(sourceRoot);
  if (sourceFiles.length === 0) {
    process.stdout.write("No TSX views found for compilation.\n");
    return;
  }

  await fs.mkdir(outputRoot, { recursive: true });

  let generatedCount = 0;
  for (const sourcePath of sourceFiles) {
    const source = await fs.readFile(sourcePath, "utf8");
    const sourceFile = ts.createSourceFile(
      sourcePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const basename = path.basename(sourcePath, ".tsx").replace(/\.view$/, "");
    const { propsIdentifier } = findDefaultViewFactory(sourceFile);
    const compiled = compileTsxView(sourceFile, basename);
    const outputContent = buildGeneratedModuleSource(
      basename,
      propsIdentifier,
      compiled,
    );

    const outputPath = path.join(outputRoot, `${basename}.compiled.ts`);

    if (checkMode) {
      let existing = "";
      try {
        existing = await fs.readFile(outputPath, "utf8");
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "ENOENT"
        ) {
          throw new Error(
            `Missing compiled view output ${path.relative(workspaceRoot, outputPath)}. Run: npm run gen:views`,
          );
        }
        throw error;
      }

      if (existing !== outputContent) {
        throw new Error(
          `Compiled view drift detected for ${path.relative(workspaceRoot, outputPath)}. Run: npm run gen:views`,
        );
      }

      continue;
    }

    await fs.writeFile(outputPath, outputContent, "utf8");
    generatedCount += 1;
  }

  if (checkMode) {
    process.stdout.write(
      `Compiled views are up to date (${sourceFiles.length} files checked).\n`,
    );
    return;
  }

  process.stdout.write(
    `Compiled ${generatedCount} TSX view files into ${path.relative(workspaceRoot, outputRoot)}.\n`,
  );
}

main().catch((error) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
