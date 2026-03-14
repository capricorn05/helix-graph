import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

type BindingEvent = "click" | "submit";

interface BindingRecord {
  id: string;
  event: BindingEvent;
}

const HANDLER_OVERRIDES = new Map<string, string>([
  ["app-nav", "onAppNavigate"],
  ["page-prev", "onPrevPage"],
  ["page-next", "onNextPage"],
  ["sort-name", "onSortByName"],
  ["sort-email", "onSortByEmail"],
]);

const ACTION_ID_OVERRIDES = new Map<string, string>([
  ["app-nav", "navigate"],
  ["page-prev", "setPage"],
  ["page-next", "setPage"],
  ["sort-name", "setSort"],
  ["sort-email", "setSort"],
  ["create-user", "createUser"],
  ["load-users-panel", "loadUsersPanel"],
  ["external-page-prev", "external-page"],
  ["external-page-next", "external-page"],
  ["external-detail-open", "external-detail"],
  ["external-detail-close", "external-detail"],
  ["external-media-page-prev", "external-media-page"],
  ["external-media-page-next", "external-media-page"],
  ["external-media-detail-open", "external-media-detail"],
  ["external-media-detail-close", "external-media-detail"],
  ["posts-page-prev", "posts-page"],
  ["posts-page-next", "posts-page"],
]);

const PREVENT_DEFAULT_BINDS = new Set(["app-nav"]);

function toPascalCase(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.length > 0 ? pascal[0].toLowerCase() + pascal.slice(1) : "";
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

function inferHandlerCandidates(bindingId: string): string[] {
  const parts = bindingId.split("-").filter(Boolean);
  const candidates = new Set<string>();
  candidates.add(`on${toPascalCase(bindingId)}`);

  if (parts.length >= 2) {
    candidates.add(
      `on${toPascalCase(parts[0])}By${toPascalCase(parts.slice(1).join("-"))}`,
    );
  }

  if (parts.length === 2 && parts[1] === "nav") {
    candidates.add(`on${toPascalCase(parts[0])}Navigate`);
  }

  return Array.from(candidates);
}

function formatEvent(event: BindingEvent): string {
  return event === "submit" ? "submit" : "click";
}

async function listTsFiles(rootDir: string): Promise<string[]> {
  const result: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }

      if (!entry.name.endsWith(".ts")) {
        continue;
      }

      result.push(absolute);
    }
  }

  await walk(rootDir);
  return result;
}

function collectFromViewSource(sourceFile: ts.SourceFile): {
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

function collectClientHandlersFromSource(sourceFile: ts.SourceFile): string[] {
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

function resolveHandlerExport(
  bindingId: string,
  availableHandlers: ReadonlySet<string>,
): string {
  const override = HANDLER_OVERRIDES.get(bindingId);
  if (override) {
    if (!availableHandlers.has(override)) {
      throw new Error(
        `Handler override for "${bindingId}" points to missing export "${override}"`,
      );
    }
    return override;
  }

  for (const candidate of inferHandlerCandidates(bindingId)) {
    if (availableHandlers.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `No exported client handler found for binding "${bindingId}". Expected one of: ${inferHandlerCandidates(bindingId).join(", ")}`,
  );
}

function resolveActionId(bindingId: string): string {
  return ACTION_ID_OVERRIDES.get(bindingId) ?? toCamelCase(bindingId);
}

function renderGeneratedModule(
  bindings: BindingRecord[],
  listIds: string[],
  handlerSet: ReadonlySet<string>,
): string {
  const eventEntries = bindings
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((binding) => {
      const handlerExport = resolveHandlerExport(binding.id, handlerSet);
      const actionId = resolveActionId(binding.id);
      const preventDefaultLine = PREVENT_DEFAULT_BINDS.has(binding.id)
        ? "\n      preventDefault: true,"
        : "";

      return `    "${binding.id}": {
      id: "${binding.id}",
      event: "${formatEvent(binding.event)}",
      actionId: "${actionId}",
      chunk: "/client/actions.js",
      handlerExport: "${handlerExport}",${preventDefaultLine}
    }`;
    })
    .join(",\n");

  const listEntries = listIds
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .map(
      (id) => `    "${id}": {
      listId: "${id}",
      keyAttr: "data-hx-key",
    }`,
    )
    .join(",\n");

  return `import type { BindingMap } from "../../helix/index.js";

// This file is auto-generated by src/example/scripts/generate-binding-map.ts
// Do not edit by hand.

export const appBindingMap: BindingMap = {
  events: {
${eventEntries}
  },
  lists: {
${listEntries}
  },
};

export function buildAppBindingMap(): BindingMap {
  return appBindingMap;
}
`;
}

async function main(): Promise<void> {
  const checkMode = process.argv.includes("--check");
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(scriptDir, "../../..");
  const viewsDir = path.join(workspaceRoot, "src/example/views");
  const clientDir = path.join(workspaceRoot, "src/example/client");
  const outputPath = path.join(viewsDir, "binding-map.generated.ts");

  const viewFiles = await listTsFiles(viewsDir);
  const clientFiles = await listTsFiles(clientDir);

  const bindingsMap = new Map<string, BindingEvent>();
  const listIds = new Set<string>();

  for (const filePath of viewFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const { bindings, listIds: discoveredLists } =
      collectFromViewSource(sourceFile);

    for (const binding of bindings) {
      const existing = bindingsMap.get(binding.id);
      if (existing && existing !== binding.event) {
        throw new Error(
          `Binding "${binding.id}" has conflicting events across view files: ${existing} vs ${binding.event}`,
        );
      }
      bindingsMap.set(binding.id, binding.event);
    }

    for (const listId of discoveredLists) {
      listIds.add(listId);
    }
  }

  const handlers = new Set<string>();
  for (const filePath of clientFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    for (const handler of collectClientHandlersFromSource(sourceFile)) {
      handlers.add(handler);
    }
  }

  const bindings = Array.from(bindingsMap.entries()).map(([id, event]) => ({
    id,
    event,
  }));
  const generated = renderGeneratedModule(
    bindings,
    Array.from(listIds),
    handlers,
  );

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
          `Missing generated binding map at ${outputPath}. Run: npm run gen:bindings`,
        );
      }
      throw error;
    }

    if (existing !== generated) {
      throw new Error(
        `Binding map drift detected at ${outputPath}. Run: npm run gen:bindings`,
      );
    }

    process.stdout.write(
      `Binding map is up to date (${bindings.length} bindings, ${listIds.size} lists).\n`,
    );
    return;
  }

  await fs.writeFile(outputPath, generated, "utf8");
  process.stdout.write(
    `Generated binding map with ${bindings.length} bindings and ${listIds.size} list bindings at ${outputPath}\n`,
  );
}

main().catch((error) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
