import { promises as fs, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { parseTypeScriptSourceFile } from "./compiler-utils.js";

export const SOURCE_EXTENSIONS = [".ts", ".tsx"] as const;
export const EXAMPLE_BROWSER_SEGMENTS = ["client", "shared"] as const;
export const SERVER_ONLY_WHERE = new Set(["server", "edge"]);

export type ModuleSpecifierUsageKind =
  | "import"
  | "export"
  | "dynamic import"
  | "require"
  | "import type";

export interface ModuleSpecifierUsage {
  kind: ModuleSpecifierUsageKind;
  specifier: string;
  node: ts.Node;
  isTypeOnly: boolean;
}

export interface NodeLocation {
  line: number;
  column: number;
}

export interface ModuleResolver {
  resolve: (fromFilePath: string, specifier: string) => string | null;
}

export interface ModuleReExportMapping {
  exportedName: string;
  importedName: string;
}

export interface ModuleReExport {
  type: "all" | "named";
  targetPath: string;
  mappings: ModuleReExportMapping[];
}

export interface ServerOnlyModuleInfo {
  filePath: string;
  exportedServerOnly: Set<string>;
  reExports: ModuleReExport[];
}

export interface CollectServerOnlyModuleInfoOptions {
  filePath: string;
  sourceFile: ts.SourceFile;
  resolveModulePath: (fromFilePath: string, specifier: string) => string | null;
  serverOnlyWhere?: ReadonlySet<string>;
}

export interface BrowserServerOnlyViolation {
  filePath: string;
  line: number;
  column: number;
  detail: string;
}

export interface CollectBrowserServerOnlyImportViolationsOptions {
  workspaceRoot: string;
  browserFilePath: string;
  sourceFile: ts.SourceFile;
  resolvedServerOnlyByPath: ReadonlyMap<string, ReadonlySet<string>>;
  resolveModulePath: (fromFilePath: string, specifier: string) => string | null;
}

function hasAllowedExtension(
  filePath: string,
  extensions: readonly string[],
): boolean {
  return extensions.some((extension) => filePath.endsWith(extension));
}

export function hasExportModifier(node: ts.Node): boolean {
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

export function getStringLiteralText(node: ts.Node | undefined): string | null {
  if (!node) {
    return null;
  }

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  return null;
}

export function getPropertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }

  return null;
}

export function unwrapExpression(
  expression: ts.Expression | undefined,
): ts.Expression | null {
  if (!expression) {
    return null;
  }

  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    (typeof ts.isSatisfiesExpression === "function" &&
      ts.isSatisfiesExpression(current))
  ) {
    current = current.expression;
  }

  return current;
}

export async function listSourceFiles(
  rootDir: string,
  extensions: readonly string[] = SOURCE_EXTENSIONS,
): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!hasAllowedExtension(absolutePath, extensions)) {
        continue;
      }

      results.push(absolutePath);
    }
  }

  await walk(rootDir);
  return results.sort();
}

export function isExampleBrowserSourceFile(
  filePath: string,
  options: {
    extensions?: readonly string[];
    browserSegments?: readonly string[];
  } = {},
): boolean {
  const extensions = options.extensions ?? SOURCE_EXTENSIONS;
  const browserSegments = options.browserSegments ?? EXAMPLE_BROWSER_SEGMENTS;

  if (!hasAllowedExtension(filePath, extensions)) {
    return false;
  }

  const parts = filePath.split(path.sep);
  const exampleIndex = parts.lastIndexOf("example");
  if (exampleIndex === -1) {
    return false;
  }

  const segment = parts[exampleIndex + 1];
  return browserSegments.includes(segment as (typeof browserSegments)[number]);
}

export function isExampleBrowserSafePath(
  filePath: string,
  browserSegments: readonly string[] = EXAMPLE_BROWSER_SEGMENTS,
): boolean {
  const parts = filePath.split(path.sep);
  const exampleIndex = parts.lastIndexOf("example");
  if (exampleIndex === -1) {
    return false;
  }

  const segment = parts[exampleIndex + 1];
  return browserSegments.includes(segment as (typeof browserSegments)[number]);
}

export async function listExampleBrowserSourceFiles(
  rootDir: string,
  options: {
    extensions?: readonly string[];
    browserSegments?: readonly string[];
  } = {},
): Promise<string[]> {
  const files = await listSourceFiles(rootDir, options.extensions);
  return files.filter((filePath) => isExampleBrowserSourceFile(filePath, options));
}

export async function parseSourceFiles(
  filePaths: readonly string[],
): Promise<Map<string, ts.SourceFile>> {
  const sourceFiles = new Map<string, ts.SourceFile>();

  for (const filePath of filePaths) {
    const content = await fs.readFile(filePath, "utf8");
    sourceFiles.set(filePath, parseTypeScriptSourceFile(filePath, content));
  }

  return sourceFiles;
}

export function normalizeSpecifierForResolution(specifier: string): string {
  if (specifier.endsWith(".js")) {
    return specifier.slice(0, -3);
  }

  return specifier;
}

export function createRelativeModuleResolver(
  extensions: readonly string[] = SOURCE_EXTENSIONS,
): ModuleResolver {
  const fsStatCache = new Map<string, boolean>();

  function resolve(fromFilePath: string, specifier: string): string | null {
    if (!specifier.startsWith(".")) {
      return null;
    }

    const base = path.resolve(
      path.dirname(fromFilePath),
      normalizeSpecifierForResolution(specifier),
    );

    const candidates = [base];
    for (const extension of extensions) {
      candidates.push(`${base}${extension}`);
      candidates.push(path.join(base, `index${extension}`));
    }

    for (const candidate of candidates) {
      if (fsStatCache.get(candidate) === true) {
        return candidate;
      }

      if (fsStatCache.get(candidate) === false) {
        continue;
      }

      try {
        const stat = statSync(candidate);
        const exists = stat.isFile();
        fsStatCache.set(candidate, exists);
        if (exists) {
          return candidate;
        }
      } catch {
        fsStatCache.set(candidate, false);
      }
    }

    return null;
  }

  return { resolve };
}

export function getNodeLocation(
  sourceFile: ts.SourceFile,
  node: ts.Node,
): NodeLocation {
  const location = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );

  return {
    line: location.line + 1,
    column: location.character + 1,
  };
}

export function collectModuleSpecifierUsages(
  sourceFile: ts.SourceFile,
): ModuleSpecifierUsage[] {
  const usages: ModuleSpecifierUsage[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      usages.push({
        kind: "import",
        specifier: node.moduleSpecifier.text,
        node: node.moduleSpecifier,
        isTypeOnly: Boolean(node.importClause?.isTypeOnly),
      });
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      usages.push({
        kind: "export",
        specifier: node.moduleSpecifier.text,
        node: node.moduleSpecifier,
        isTypeOnly: Boolean(node.isTypeOnly),
      });
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      usages.push({
        kind: "dynamic import",
        specifier: node.arguments[0].text,
        node: node.arguments[0],
        isTypeOnly: false,
      });
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      usages.push({
        kind: "require",
        specifier: node.arguments[0].text,
        node: node.arguments[0],
        isTypeOnly: false,
      });
    }

    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      usages.push({
        kind: "import type",
        specifier: node.argument.literal.text,
        node: node.argument.literal,
        isTypeOnly: true,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return usages;
}

function resolveWhereFromObjectLiteral(
  objectLiteral: ts.ObjectLiteralExpression | undefined,
): string | null {
  if (!objectLiteral) {
    return null;
  }

  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    if (getPropertyNameText(property.name) !== "where") {
      continue;
    }

    return getStringLiteralText(property.initializer);
  }

  return null;
}

function collectLocalPolicyObjectLiterals(
  sourceFile: ts.SourceFile,
): Map<string, ts.ObjectLiteralExpression> {
  const result = new Map<string, ts.ObjectLiteralExpression>();

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
        continue;
      }

      const initializer = unwrapExpression(declaration.initializer);
      if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
        continue;
      }

      result.set(declaration.name.text, initializer);
    }
  }

  return result;
}

function resolveWhereFromPolicyArg(
  arg: ts.Expression | undefined,
  localPolicies: ReadonlyMap<string, ts.ObjectLiteralExpression>,
): string | null {
  const normalizedArg = unwrapExpression(arg);
  if (!normalizedArg) {
    return null;
  }

  if (ts.isIdentifier(normalizedArg)) {
    return resolveWhereFromObjectLiteral(localPolicies.get(normalizedArg.text));
  }

  if (!ts.isObjectLiteralExpression(normalizedArg)) {
    return null;
  }

  return resolveWhereFromObjectLiteral(normalizedArg);
}

function collectFactoryAliases(sourceFile: ts.SourceFile): {
  resourceAliases: Set<string>;
  actionAliases: Set<string>;
} {
  const resourceAliases = new Set<string>();
  const actionAliases = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }

    const moduleSpecifier = getStringLiteralText(statement.moduleSpecifier);
    if (!moduleSpecifier) {
      continue;
    }

    if (
      !moduleSpecifier.endsWith("/helix/index.js") &&
      !moduleSpecifier.endsWith("/helix/resource.js") &&
      !moduleSpecifier.endsWith("/helix/action.js")
    ) {
      continue;
    }

    const importClause = statement.importClause;
    if (
      !importClause?.namedBindings ||
      !ts.isNamedImports(importClause.namedBindings)
    ) {
      continue;
    }

    for (const element of importClause.namedBindings.elements) {
      const importedName = (element.propertyName ?? element.name).text;
      const localName = element.name.text;

      if (importedName === "resource") {
        resourceAliases.add(localName);
      }

      if (importedName === "action") {
        actionAliases.add(localName);
      }
    }
  }

  return { resourceAliases, actionAliases };
}

export function collectServerOnlyModuleInfo(
  options: CollectServerOnlyModuleInfoOptions,
): ServerOnlyModuleInfo {
  const serverOnlyWhere = options.serverOnlyWhere ?? SERVER_ONLY_WHERE;
  const { sourceFile } = options;

  const { resourceAliases, actionAliases } = collectFactoryAliases(sourceFile);
  const localPolicies = collectLocalPolicyObjectLiterals(sourceFile);
  const localServerOnly = new Set<string>();
  const exportedServerOnly = new Set<string>();
  const reExports: ModuleReExport[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      const exported = hasExportModifier(statement);

      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          continue;
        }

        if (!ts.isCallExpression(declaration.initializer)) {
          continue;
        }

        if (!ts.isIdentifier(declaration.initializer.expression)) {
          continue;
        }

        const callee = declaration.initializer.expression.text;
        let where: string | null = null;

        if (resourceAliases.has(callee)) {
          where = resolveWhereFromPolicyArg(
            declaration.initializer.arguments[3],
            localPolicies,
          );
        } else if (actionAliases.has(callee)) {
          where = resolveWhereFromPolicyArg(
            declaration.initializer.arguments[2],
            localPolicies,
          );
        }

        if (!where || !serverOnlyWhere.has(where)) {
          continue;
        }

        localServerOnly.add(declaration.name.text);
        if (exported) {
          exportedServerOnly.add(declaration.name.text);
        }
      }
    }

    if (ts.isExportAssignment(statement)) {
      const exportedExpression = unwrapExpression(statement.expression);
      if (!exportedExpression) {
        continue;
      }

      if (ts.isIdentifier(exportedExpression)) {
        if (localServerOnly.has(exportedExpression.text)) {
          exportedServerOnly.add("default");
        }
        continue;
      }

      if (
        !ts.isCallExpression(exportedExpression) ||
        !ts.isIdentifier(exportedExpression.expression)
      ) {
        continue;
      }

      const callee = exportedExpression.expression.text;
      let where: string | null = null;

      if (resourceAliases.has(callee)) {
        where = resolveWhereFromPolicyArg(
          exportedExpression.arguments[3],
          localPolicies,
        );
      } else if (actionAliases.has(callee)) {
        where = resolveWhereFromPolicyArg(
          exportedExpression.arguments[2],
          localPolicies,
        );
      }

      if (where && serverOnlyWhere.has(where)) {
        exportedServerOnly.add("default");
      }

      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      const specifier = getStringLiteralText(statement.moduleSpecifier);
      if (!specifier) {
        continue;
      }

      const targetPath = options.resolveModulePath(options.filePath, specifier);
      if (!targetPath) {
        continue;
      }

      if (!statement.exportClause) {
        reExports.push({
          type: "all",
          targetPath,
          mappings: [],
        });
        continue;
      }

      if (!ts.isNamedExports(statement.exportClause)) {
        continue;
      }

      const mappings = statement.exportClause.elements.map((element) => ({
        exportedName: element.name.text,
        importedName: (element.propertyName ?? element.name).text,
      }));

      reExports.push({
        type: "named",
        targetPath,
        mappings,
      });
    }

    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        const localName = (element.propertyName ?? element.name).text;
        if (!localServerOnly.has(localName)) {
          continue;
        }
        exportedServerOnly.add(element.name.text);
      }
    }
  }

  return {
    filePath: options.filePath,
    exportedServerOnly,
    reExports,
  };
}

export function resolveExportedServerOnlySymbols(
  filePath: string,
  moduleInfoByPath: ReadonlyMap<string, ServerOnlyModuleInfo>,
  cache: Map<string, Set<string>>,
  stack: Set<string> = new Set(),
): Set<string> {
  if (cache.has(filePath)) {
    return cache.get(filePath) ?? new Set<string>();
  }

  if (stack.has(filePath)) {
    return new Set<string>();
  }

  const info = moduleInfoByPath.get(filePath);
  if (!info) {
    return new Set<string>();
  }

  stack.add(filePath);

  const resolved = new Set(info.exportedServerOnly);
  for (const reExport of info.reExports) {
    const targetResolved = resolveExportedServerOnlySymbols(
      reExport.targetPath,
      moduleInfoByPath,
      cache,
      stack,
    );

    if (reExport.type === "all") {
      for (const name of targetResolved) {
        resolved.add(name);
      }
      continue;
    }

    for (const mapping of reExport.mappings) {
      if (targetResolved.has(mapping.importedName)) {
        resolved.add(mapping.exportedName);
      }
    }
  }

  stack.delete(filePath);
  cache.set(filePath, resolved);
  return resolved;
}

export function collectBrowserServerOnlyImportViolations(
  options: CollectBrowserServerOnlyImportViolationsOptions,
): BrowserServerOnlyViolation[] {
  const violations: BrowserServerOnlyViolation[] = [];
  const relativePath = path.relative(options.workspaceRoot, options.browserFilePath);

  function addViolation(node: ts.Node, detail: string): void {
    const location = getNodeLocation(options.sourceFile, node);
    violations.push({
      filePath: relativePath,
      line: location.line,
      column: location.column,
      detail,
    });
  }

  function getServerOnlyExports(specifier: string): ReadonlySet<string> | null {
    const targetPath = options.resolveModulePath(options.browserFilePath, specifier);
    if (!targetPath) {
      return null;
    }

    const serverOnlyExports = options.resolvedServerOnlyByPath.get(targetPath);
    if (!serverOnlyExports || serverOnlyExports.size === 0) {
      return null;
    }

    return serverOnlyExports;
  }

  for (const statement of options.sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = getStringLiteralText(statement.moduleSpecifier);
      if (!specifier || statement.importClause?.isTypeOnly) {
        continue;
      }

      const serverOnlyExports = getServerOnlyExports(specifier);
      if (!serverOnlyExports) {
        continue;
      }

      const importClause = statement.importClause;
      if (!importClause) {
        addViolation(statement.moduleSpecifier, `side-effect import from ${specifier}`);
        continue;
      }

      if (importClause.name && serverOnlyExports.has("default")) {
        addViolation(statement.moduleSpecifier, `default import from ${specifier}`);
      }

      if (
        importClause.namedBindings &&
        ts.isNamespaceImport(importClause.namedBindings)
      ) {
        addViolation(statement.moduleSpecifier, `namespace import from ${specifier}`);
        continue;
      }

      if (
        importClause.namedBindings &&
        ts.isNamedImports(importClause.namedBindings)
      ) {
        for (const element of importClause.namedBindings.elements) {
          const importedName = (element.propertyName ?? element.name).text;
          if (!serverOnlyExports.has(importedName)) {
            continue;
          }

          addViolation(
            statement.moduleSpecifier,
            `import ${importedName} from ${specifier}`,
          );
        }
      }
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      !statement.isTypeOnly
    ) {
      const specifier = getStringLiteralText(statement.moduleSpecifier);
      if (!specifier) {
        continue;
      }

      const serverOnlyExports = getServerOnlyExports(specifier);
      if (!serverOnlyExports) {
        continue;
      }

      if (!statement.exportClause) {
        addViolation(statement.moduleSpecifier, `export * from ${specifier}`);
        continue;
      }

      if (!ts.isNamedExports(statement.exportClause)) {
        addViolation(statement.moduleSpecifier, `namespace re-export from ${specifier}`);
        continue;
      }

      for (const element of statement.exportClause.elements) {
        const importedName = (element.propertyName ?? element.name).text;
        if (!serverOnlyExports.has(importedName)) {
          continue;
        }

        addViolation(
          statement.moduleSpecifier,
          `re-export ${importedName} from ${specifier}`,
        );
      }
    }
  }

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const specifier = node.arguments[0].text;
      if (getServerOnlyExports(specifier)) {
        addViolation(node.arguments[0], `dynamic import from ${specifier}`);
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const specifier = node.arguments[0].text;
      if (getServerOnlyExports(specifier)) {
        addViolation(node.arguments[0], `require from ${specifier}`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(options.sourceFile);
  return violations;
}