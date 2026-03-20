import path from "node:path";
import ts from "typescript";

/**
 * The DOM event type wired for a `data-hx-bind` binding.
 *
 * `click`, `submit`, `input`, and `change` are inferred automatically from
 * element type.
 * All other values must be set explicitly via `data-hx-event="<event>"` on the
 * same element as `data-hx-bind`.
 */
export type BindingEvent =
  | "click"
  | "submit"
  | "keydown"
  | "keyup"
  | "keypress"
  | "focus"
  | "blur"
  | "focusin"
  | "focusout"
  | "change"
  | "input"
  | "pointerdown"
  | "pointerup"
  | "pointermove"
  | "mousedown"
  | "mouseup"
  | "mousemove"
  | "mouseenter"
  | "mouseleave";
export type PatchKind = "text" | "attr" | "html";

export interface PatchDescriptor {
  kind: PatchKind;
  token: string;
  targetId: string;
  expressionSource: string;
  attrName?: string;
}

export interface CompiledViewResult {
  template: string;
  patches: PatchDescriptor[];
  bindings: Map<string, BindingEvent>;
  lists: string[];
}

export interface CompileTsxViewSourceResult {
  basename: string;
  propsIdentifier: string;
  compiled: CompiledViewResult;
}

interface CompileState {
  sourceFile: ts.SourceFile;
  viewSlug: string;
  tokenCounter: number;
  autoTargetCounter: number;
  patches: PatchDescriptor[];
  bindings: Map<string, BindingEvent>;
  lists: Set<string>;
  usedTargetIds: Set<string>;
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

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNodeLocation(sourceFile: ts.SourceFile, node: ts.Node): string {
  const location = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  return `${sourceFile.fileName}:${location.line + 1}:${location.character + 1}`;
}

function throwCompileError(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  message: string,
): never {
  throw new Error(`${message} (${formatNodeLocation(sourceFile, node)})`);
}

function registerTargetId(
  state: CompileState,
  targetId: string,
  node: ts.Node,
): void {
  if (state.usedTargetIds.has(targetId)) {
    throwCompileError(
      state.sourceFile,
      node,
      `Duplicate data-hx-id target "${targetId}" is not allowed in compiled views`,
    );
  }

  state.usedTargetIds.add(targetId);
}

function isValidBindingId(value: string): boolean {
  return /^[a-z][a-z0-9-]*$/i.test(value);
}

function registerBinding(
  state: CompileState,
  id: string,
  event: BindingEvent,
  node: ts.Node,
): void {
  if (!isValidBindingId(id)) {
    throwCompileError(
      state.sourceFile,
      node,
      `Invalid data-hx-bind id "${id}". Use alphanumeric and hyphen characters only`,
    );
  }

  const existing = state.bindings.get(id);
  if (existing && existing !== event) {
    throwCompileError(
      state.sourceFile,
      node,
      `Binding "${id}" is used with conflicting events (${existing} vs ${event})`,
    );
  }

  state.bindings.set(id, event);
}

function inferDefaultBindingEvent(tagName: string): BindingEvent {
  const normalizedTag = tagName.toLowerCase();

  if (normalizedTag === "form") {
    return "submit";
  }

  if (normalizedTag === "input" || normalizedTag === "textarea") {
    return "input";
  }

  if (normalizedTag === "select") {
    return "change";
  }

  return "click";
}

function expressionContainsJsx(node: ts.Node): boolean {
  if (
    ts.isJsxElement(node) ||
    ts.isJsxSelfClosingElement(node) ||
    ts.isJsxFragment(node)
  ) {
    return true;
  }

  return (
    ts.forEachChild(node, (child) =>
      expressionContainsJsx(child) ? true : undefined,
    ) === true
  );
}

function validateDynamicTextExpression(
  state: CompileState,
  expression: ts.Expression,
): void {
  if (
    ts.isArrowFunction(expression) ||
    ts.isFunctionExpression(expression) ||
    ts.isObjectLiteralExpression(expression) ||
    ts.isArrayLiteralExpression(expression) ||
    expressionContainsJsx(expression)
  ) {
    throwCompileError(
      state.sourceFile,
      expression,
      "Unsupported JSX child expression in compiled view. Use primitive text expressions or <hx-slot value={...} /> for HTML fragments",
    );
  }
}

function validateDynamicAttributeExpression(
  state: CompileState,
  attrName: string,
  expression: ts.Expression,
): void {
  if (attrName.toLowerCase().startsWith("on")) {
    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
      throwCompileError(
        state.sourceFile,
        expression,
        `Inline handler expressions are not supported for "${attrName}". Use data-hx-bind and a client action export instead`,
      );
    }

    throwCompileError(
      state.sourceFile,
      expression,
      `Event handler attribute "${attrName}" is not supported in compiled views. Use data-hx-bind instead`,
    );
  }

  if (attrName === "style" && ts.isObjectLiteralExpression(expression)) {
    throwCompileError(
      state.sourceFile,
      expression,
      "Dynamic style objects are not supported in compiled views",
    );
  }

  if (attrName === "data-hx-list") {
    throwCompileError(
      state.sourceFile,
      expression,
      "Dynamic data-hx-list values are not supported in compiled views",
    );
  }

  if (attrName === "data-hx-bind") {
    throwCompileError(
      state.sourceFile,
      expression,
      "Dynamic data-hx-bind values are not supported in compiled views",
    );
  }

  if (attrName === "data-hx-event") {
    throwCompileError(
      state.sourceFile,
      expression,
      "Dynamic data-hx-event values are not supported in compiled views. Use a string literal event name",
    );
  }
}

function nextTargetId(state: CompileState): string {
  while (true) {
    state.autoTargetCounter += 1;
    const candidate = `hx-${state.viewSlug}-slot-${state.autoTargetCounter}`;
    if (state.usedTargetIds.has(candidate)) {
      continue;
    }

    state.usedTargetIds.add(candidate);
    return candidate;
  }
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

function isNamedCallExpression(
  expression: ts.Expression,
  name: string,
): expression is ts.CallExpression {
  const unwrapped = unwrapParenthesizedExpression(expression);
  return ts.isCallExpression(unwrapped) && ts.isIdentifier(unwrapped.expression)
    ? unwrapped.expression.text === name
    : false;
}

function extractFactoryReturnExpression(
  state: CompileState,
  helperName: string,
  expression: ts.Expression,
): ts.Expression {
  const candidate = unwrapParenthesizedExpression(expression);

  if (ts.isArrowFunction(candidate)) {
    if (candidate.parameters.length > 0) {
      throwCompileError(
        state.sourceFile,
        candidate,
        `${helperName}() loader functions cannot accept parameters`,
      );
    }

    if (ts.isBlock(candidate.body)) {
      const returnStatement = candidate.body.statements.find(
        (statement): statement is ts.ReturnStatement =>
          ts.isReturnStatement(statement) && Boolean(statement.expression),
      );

      if (!returnStatement?.expression) {
        throwCompileError(
          state.sourceFile,
          candidate,
          `${helperName}() requires a return expression`,
        );
      }

      return unwrapParenthesizedExpression(returnStatement.expression);
    }

    return unwrapParenthesizedExpression(candidate.body);
  }

  if (ts.isFunctionExpression(candidate)) {
    if (candidate.parameters.length > 0) {
      throwCompileError(
        state.sourceFile,
        candidate,
        `${helperName}() loader functions cannot accept parameters`,
      );
    }

    const returnStatement = candidate.body.statements.find(
      (statement): statement is ts.ReturnStatement =>
        ts.isReturnStatement(statement) && Boolean(statement.expression),
    );

    if (!returnStatement?.expression) {
      throwCompileError(
        state.sourceFile,
        candidate,
        `${helperName}() requires a return expression`,
      );
    }

    return unwrapParenthesizedExpression(returnStatement.expression);
  }

  throwCompileError(
    state.sourceFile,
    expression,
    `${helperName}() requires a function expression`,
  );
}

function extractClientOnlyModuleSpecifier(
  state: CompileState,
  expression: ts.Expression,
): string {
  const returned = extractFactoryReturnExpression(
    state,
    "clientOnly",
    expression,
  );

  if (
    !ts.isCallExpression(returned) ||
    returned.expression.kind !== ts.SyntaxKind.ImportKeyword ||
    returned.arguments.length !== 1
  ) {
    throwCompileError(
      state.sourceFile,
      expression,
      'clientOnly() requires a loader like () => import("./widget.js")',
    );
  }

  const [specifier] = returned.arguments;
  if (
    !specifier ||
    (!ts.isStringLiteral(specifier) &&
      !ts.isNoSubstitutionTemplateLiteral(specifier))
  ) {
    throwCompileError(
      state.sourceFile,
      specifier ?? returned,
      "clientOnly() import specifier must be a string literal",
    );
  }

  return specifier.text;
}

function compileUncompiledViewExpression(
  state: CompileState,
  expression: ts.CallExpression,
): string {
  const [factory] = expression.arguments;
  if (!factory) {
    throwCompileError(
      state.sourceFile,
      expression,
      "uncompiledView() requires a factory function",
    );
  }

  const returned = extractFactoryReturnExpression(
    state,
    "uncompiledView",
    factory,
  );
  if (expressionContainsJsx(returned)) {
    throwCompileError(
      state.sourceFile,
      returned,
      "uncompiledView() must return HTML or another render function result, not raw JSX",
    );
  }

  const targetId = nextTargetId(state);
  const token = nextToken(state, "html", targetId);
  const expressionSource = expressionSourceOrThrow(state.sourceFile, returned);

  state.patches.push({
    kind: "html",
    token,
    targetId,
    expressionSource,
  });

  return token;
}

function validateClientOnlyPropsExpression(
  state: CompileState,
  expression: ts.Expression,
): void {
  if (
    ts.isArrowFunction(expression) ||
    ts.isFunctionExpression(expression) ||
    expressionContainsJsx(expression)
  ) {
    throwCompileError(
      state.sourceFile,
      expression,
      "clientOnly() props must be JSON-serializable values, not functions or JSX",
    );
  }
}

function compileClientOnlyExpression(
  state: CompileState,
  expression: ts.CallExpression,
): string {
  const [loaderExpression, propsExpression] = expression.arguments;
  if (!loaderExpression) {
    throwCompileError(
      state.sourceFile,
      expression,
      "clientOnly() requires a loader function",
    );
  }

  if (expression.arguments.length > 2) {
    throwCompileError(
      state.sourceFile,
      expression,
      "clientOnly() currently supports only loader and props arguments",
    );
  }

  const moduleSpecifier = extractClientOnlyModuleSpecifier(
    state,
    loaderExpression,
  );
  const targetId = nextTargetId(state);
  const renderedAttrs = [
    `data-hx-client-only="${escapeHtml(targetId)}"`,
    `data-hx-client-module="${escapeHtml(moduleSpecifier)}"`,
    `data-hx-id="${escapeHtml(targetId)}"`,
  ];

  if (propsExpression) {
    validateClientOnlyPropsExpression(state, propsExpression);
    const token = nextToken(state, "attr", targetId, "data-hx-client-props");
    const expressionSource = `serializeClientOnlyProps(${expressionSourceOrThrow(state.sourceFile, propsExpression)})`;
    state.patches.push({
      kind: "attr",
      token,
      targetId,
      attrName: "data-hx-client-props",
      expressionSource,
    });
    renderedAttrs.push(`data-hx-client-props="${token}"`);
  }

  return `<div ${renderedAttrs.join(" ")}></div>`;
}

function renderAttributes(
  state: CompileState,
  tagName: string,
  attributes: ts.JsxAttributes,
): string {
  const rendered: string[] = [];
  let targetId: string | null = null;
  let hasRenderedDataHxId = false;

  // Pre-scan: collect an explicit data-hx-event override on this element.
  // This allows any event type to be wired for a data-hx-bind binding, e.g.:
  //   <input data-hx-event="keydown" data-hx-bind="my-handler" />
  let eventOverride: BindingEvent | null = null;
  for (const prop of attributes.properties) {
    if (
      ts.isJsxAttribute(prop) &&
      prop.initializer !== undefined &&
      ts.isStringLiteral(prop.initializer) &&
      normalizeAttrName(jsxAttributeNameText(prop.name)) === "data-hx-event"
    ) {
      eventOverride = prop.initializer.text as BindingEvent;
    }
  }

  for (const property of attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) {
      throwCompileError(
        state.sourceFile,
        property,
        "JSX spread attributes are not supported in compiled views",
      );
    }

    const rawAttrName = jsxAttributeNameText(property.name);
    const attrName = normalizeAttrName(rawAttrName);
    const initializer = property.initializer;

    // data-hx-event is a compile-time directive; strip it from HTML output.
    // If it has a dynamic (JSX expression) value, reject it first.
    if (attrName === "data-hx-event") {
      if (
        initializer &&
        ts.isJsxExpression(initializer) &&
        initializer.expression
      ) {
        validateDynamicAttributeExpression(
          state,
          attrName,
          initializer.expression,
        );
      }
      continue;
    }

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
        registerTargetId(state, value, initializer);
      }

      if (attrName === "data-hx-bind") {
        const event: BindingEvent =
          eventOverride ?? inferDefaultBindingEvent(tagName);
        registerBinding(state, value, event, initializer);
      }

      if (attrName === "data-hx-list") {
        state.lists.add(value);
      }

      continue;
    }

    if (ts.isJsxExpression(initializer)) {
      const expression = initializer.expression;
      if (!expression) {
        throwCompileError(
          state.sourceFile,
          initializer,
          `Unsupported empty JSX expression for attribute "${attrName}"`,
        );
      }

      validateDynamicAttributeExpression(state, attrName, expression);

      const expressionSource = expressionSourceOrThrow(
        state.sourceFile,
        expression,
      );

      if (attrName === "data-hx-id") {
        throwCompileError(
          state.sourceFile,
          initializer,
          "Dynamic data-hx-id is not supported in compiled views",
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

    throwCompileError(
      state.sourceFile,
      initializer,
      `Unsupported JSX attribute initializer for "${attrName}"`,
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

    const expression = unwrapParenthesizedExpression(child.expression);
    if (isNamedCallExpression(expression, "uncompiledView")) {
      return compileUncompiledViewExpression(state, expression);
    }

    if (isNamedCallExpression(expression, "clientOnly")) {
      return compileClientOnlyExpression(state, expression);
    }

    validateDynamicTextExpression(state, expression);

    const targetId = nextTargetId(state);
    const token = nextToken(state, "text", targetId);
    const expressionSource = expressionSourceOrThrow(
      state.sourceFile,
      expression,
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

  throwCompileError(
    state.sourceFile,
    child,
    "Unsupported JSX child in compiled view",
  );
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
      throwCompileError(
        state.sourceFile,
        property,
        "JSX spread attributes are not supported on hx-slot",
      );
    }

    const attrName = jsxAttributeNameText(property.name);

    if (attrName === "value") {
      if (!property.initializer || !ts.isJsxExpression(property.initializer)) {
        throwCompileError(
          state.sourceFile,
          property,
          "hx-slot value must be a JSX expression",
        );
      }

      valueExpression = property.initializer.expression;
      continue;
    }

    if (attrName === "target") {
      if (!property.initializer || !ts.isStringLiteral(property.initializer)) {
        throwCompileError(
          state.sourceFile,
          property,
          "hx-slot target must be a string literal",
        );
      }

      explicitTargetId = property.initializer.text;
      registerTargetId(state, explicitTargetId, property.initializer);
      continue;
    }

    throwCompileError(
      state.sourceFile,
      property,
      `Unsupported hx-slot attribute "${attrName}"`,
    );
  }

  if (!valueExpression) {
    throwCompileError(
      state.sourceFile,
      node,
      "hx-slot requires a value expression",
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
    throwCompileError(
      state.sourceFile,
      node,
      "Use self-closing syntax for hx-slot",
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
      throwCompileError(
        sourceFile,
        statement,
        "Default exported TSX view must have an identifier parameter",
      );
    }

    if (!statement.body) {
      throwCompileError(
        sourceFile,
        statement,
        "Default exported TSX view has no body",
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
    `Could not find a default exported TSX view function with a JSX return (${sourceFile.fileName})`,
  );
}

export function compileTsxView(
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
    lists: new Set<string>(),
    usedTargetIds: new Set<string>(),
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
    lists: Array.from(state.lists),
  };
}

export function compileTsxViewSource(
  sourcePath: string,
  source: string,
): CompileTsxViewSourceResult {
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

  return {
    basename,
    propsIdentifier,
    compiled,
  };
}
