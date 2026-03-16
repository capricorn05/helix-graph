import ts from "typescript";

export type BindingEvent = "click" | "submit";

export interface BindingRecord {
  id: string;
  event: BindingEvent;
}

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined;
  return (
    modifiers?.some(
      (modifier: ts.ModifierLike) =>
        modifier.kind === ts.SyntaxKind.ExportKeyword,
    ) ?? false
  );
}

function getPropertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }

  if (ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

function getStringLiteralLikeText(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function templateExpressionStaticText(node: ts.TemplateExpression): string {
  let text = node.head.text;
  for (const span of node.templateSpans) {
    text += "${expr}";
    text += span.literal.text;
  }
  return text;
}

function nodeLiteralText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (ts.isTemplateExpression(node)) {
    return templateExpressionStaticText(node);
  }

  return null;
}

function addBindingRecord(
  bindings: Map<string, BindingEvent>,
  id: string,
  event: BindingEvent,
  sourceLabel: string,
): void {
  if (!id) {
    return;
  }

  const existing = bindings.get(id);
  if (existing && existing !== event) {
    throw new Error(
      `Conflicting event types for binding "${id}" (${existing} vs ${event}) at ${sourceLabel}`,
    );
  }

  bindings.set(id, event);
}

function collectBindingsFromHtmlLiteral(
  literalText: string,
  sourceLabel: string,
  bindings: Map<string, BindingEvent>,
): void {
  const explicitBindingRegex =
    /<([a-zA-Z][\w:-]*)\b[^>]*\bdata-hx-bind="([^"]+)"/g;

  for (const match of literalText.matchAll(explicitBindingRegex)) {
    const tag = match[1]?.toLowerCase() ?? "";
    const id = match[2] ?? "";
    const event: BindingEvent = tag === "form" ? "submit" : "click";
    addBindingRecord(bindings, id, event, sourceLabel);
  }
}

function collectListsFromHtmlLiteral(
  literalText: string,
  listIds: Set<string>,
): void {
  const explicitListRegex = /data-hx-list="([^"]+)"/g;
  for (const match of literalText.matchAll(explicitListRegex)) {
    const id = match[1] ?? "";
    if (id) {
      listIds.add(id);
    }
  }
}

export function collectBindingsAndListsFromViewSource(
  sourceFile: ts.SourceFile,
): {
  bindings: BindingRecord[];
  listIds: string[];
} {
  const bindings = new Map<string, BindingEvent>();
  const listIds = new Set<string>();

  const visit = (node: ts.Node): void => {
    const literalText = nodeLiteralText(node);
    if (literalText) {
      collectBindingsFromHtmlLiteral(
        literalText,
        sourceFile.fileName,
        bindings,
      );
      collectListsFromHtmlLiteral(literalText, listIds);
    }

    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }

        const key = getPropertyNameText(property.name);
        if (key === "data-hx-list") {
          const listId = getStringLiteralLikeText(property.initializer);
          if (listId) {
            listIds.add(listId);
          }
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (
        node.expression.text === "uiButton" &&
        node.arguments.length > 0 &&
        ts.isObjectLiteralExpression(node.arguments[0])
      ) {
        for (const property of node.arguments[0].properties) {
          if (!ts.isPropertyAssignment(property)) {
            continue;
          }

          const key = getPropertyNameText(property.name);
          if (key !== "bind") {
            continue;
          }

          const bindId = getStringLiteralLikeText(property.initializer);
          if (bindId) {
            addBindingRecord(bindings, bindId, "click", sourceFile.fileName);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return {
    bindings: Array.from(bindings.entries()).map(([id, event]) => ({
      id,
      event,
    })),
    listIds: Array.from(listIds),
  };
}

export function collectClientHandlersFromSource(
  sourceFile: ts.SourceFile,
): string[] {
  const handlers = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && hasExportModifier(statement)) {
      if (statement.name?.text) {
        handlers.add(statement.name.text);
      }
      continue;
    }

    if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
        continue;
      }

      if (
        ts.isArrowFunction(declaration.initializer) ||
        ts.isFunctionExpression(declaration.initializer)
      ) {
        handlers.add(declaration.name.text);
      }
    }
  }

  return Array.from(handlers);
}
