import { promises as fs, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const SERVER_ONLY_WHERE = new Set(["server", "edge"]);
const BROWSER_EXAMPLE_SEGMENTS = new Set(["client", "shared"]);

function hasExportModifier(node) {
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined;
  return (
    modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    ) ?? false
  );
}

function getStringLiteralText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function getPropertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }
  return null;
}

function normalizeSpecifierForResolution(specifier) {
  if (specifier.endsWith(".js")) {
    return specifier.slice(0, -3);
  }
  return specifier;
}

function resolveModulePath(fromFilePath, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const base = path.resolve(
    path.dirname(fromFilePath),
    normalizeSpecifierForResolution(specifier),
  );

  const candidates = [base];
  for (const ext of SOURCE_EXTENSIONS) {
    candidates.push(`${base}${ext}`);
    candidates.push(path.join(base, `index${ext}`));
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

function isBrowserSourceFile(filePath) {
  if (!SOURCE_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
    return false;
  }

  const parts = filePath.split(path.sep);
  const exampleIndex = parts.lastIndexOf("example");
  if (exampleIndex === -1) {
    return false;
  }

  const segment = parts[exampleIndex + 1];
  return BROWSER_EXAMPLE_SEGMENTS.has(segment);
}

function unwrapExpression(expression) {
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

function resolveWhereFromObjectLiteral(objectLiteral) {
  if (!objectLiteral || !ts.isObjectLiteralExpression(objectLiteral)) {
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

function collectLocalPolicyObjectLiterals(sourceFile) {
  const result = new Map();

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

function resolveWhereFromPolicyArg(arg, localPolicies) {
  if (!arg || !ts.isObjectLiteralExpression(arg)) {
    const normalizedArg = unwrapExpression(arg);
    if (!normalizedArg) {
      return null;
    }

    if (ts.isIdentifier(normalizedArg)) {
      return resolveWhereFromObjectLiteral(
        localPolicies.get(normalizedArg.text),
      );
    }

    if (!ts.isObjectLiteralExpression(normalizedArg)) {
      return null;
    }

    return resolveWhereFromObjectLiteral(normalizedArg);
  }

  return resolveWhereFromObjectLiteral(arg);
}

function collectFactoryAliases(sourceFile) {
  const resourceAliases = new Set();
  const actionAliases = new Set();

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

function collectModuleInfo(filePath, sourceFile) {
  const { resourceAliases, actionAliases } = collectFactoryAliases(sourceFile);
  const localPolicies = collectLocalPolicyObjectLiterals(sourceFile);
  const localServerOnly = new Set();
  const exportedServerOnly = new Set();
  const reExports = [];

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
        let where = null;

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

        if (!where || !SERVER_ONLY_WHERE.has(where)) {
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
      let where = null;

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

      if (where && SERVER_ONLY_WHERE.has(where)) {
        exportedServerOnly.add("default");
      }

      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      const specifier = getStringLiteralText(statement.moduleSpecifier);
      if (!specifier) {
        continue;
      }

      const targetPath = resolveModulePath(filePath, specifier);
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
    filePath,
    exportedServerOnly,
    reExports,
  };
}

function resolveExportedServerOnly(
  filePath,
  moduleInfoByPath,
  cache,
  stack = new Set(),
) {
  if (cache.has(filePath)) {
    return cache.get(filePath);
  }

  if (stack.has(filePath)) {
    return new Set();
  }

  const info = moduleInfoByPath.get(filePath);
  if (!info) {
    return new Set();
  }

  stack.add(filePath);
  const resolved = new Set(info.exportedServerOnly);

  for (const reExport of info.reExports) {
    const targetResolved = resolveExportedServerOnly(
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

function collectBrowserImportViolations(
  workspaceRoot,
  browserFilePath,
  sourceFile,
  resolvedServerOnlyByPath,
) {
  const violations = [];
  const relativePath = path.relative(workspaceRoot, browserFilePath);

  function getServerOnlyExports(specifier) {
    const targetPath = resolveModulePath(browserFilePath, specifier);
    if (!targetPath) {
      return null;
    }

    const serverOnlyExports = resolvedServerOnlyByPath.get(targetPath);
    if (!serverOnlyExports || serverOnlyExports.size === 0) {
      return null;
    }

    return serverOnlyExports;
  }

  function addViolation(node, detail) {
    const location = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );

    violations.push({
      filePath: relativePath,
      line: location.line + 1,
      column: location.character + 1,
      detail,
    });
  }

  for (const statement of sourceFile.statements) {
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
        addViolation(
          statement.moduleSpecifier,
          `side-effect import from ${specifier}`,
        );
        continue;
      }

      if (importClause.name && serverOnlyExports.has("default")) {
        addViolation(
          statement.moduleSpecifier,
          `default import from ${specifier}`,
        );
      }

      if (
        importClause.namedBindings &&
        ts.isNamespaceImport(importClause.namedBindings)
      ) {
        addViolation(
          statement.moduleSpecifier,
          `namespace import from ${specifier}`,
        );
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

      continue;
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
        addViolation(
          statement.moduleSpecifier,
          `namespace re-export from ${specifier}`,
        );
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

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const specifier = node.arguments[0].text;
      const serverOnlyExports = getServerOnlyExports(specifier);
      if (serverOnlyExports) {
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
      const serverOnlyExports = getServerOnlyExports(specifier);
      if (serverOnlyExports) {
        addViolation(node.arguments[0], `require from ${specifier}`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

async function listSourceFiles(srcRoot) {
  const results = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        continue;
      }

      results.push(absolutePath);
    }
  }

  await walk(srcRoot);
  return results.sort();
}

const fsStatCache = new Map();

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(scriptDir, "..");
  const srcRoot = path.join(workspaceRoot, "src");

  const sourceFilePaths = await listSourceFiles(srcRoot);
  const moduleInfoByPath = new Map();
  const parsedSourceByPath = new Map();

  for (const filePath of sourceFilePaths) {
    const content = await fs.readFile(filePath, "utf8");
    const scriptKind = filePath.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    parsedSourceByPath.set(filePath, sourceFile);
    moduleInfoByPath.set(filePath, collectModuleInfo(filePath, sourceFile));
  }

  const resolvedServerOnlyByPath = new Map();
  for (const filePath of sourceFilePaths) {
    resolvedServerOnlyByPath.set(
      filePath,
      resolveExportedServerOnly(
        filePath,
        moduleInfoByPath,
        resolvedServerOnlyByPath,
      ),
    );
  }

  const browserFilePaths = sourceFilePaths.filter((filePath) =>
    isBrowserSourceFile(filePath),
  );

  const violations = [];
  for (const browserFilePath of browserFilePaths) {
    const sourceFile = parsedSourceByPath.get(browserFilePath);
    if (!sourceFile) {
      continue;
    }

    violations.push(
      ...collectBrowserImportViolations(
        workspaceRoot,
        browserFilePath,
        sourceFile,
        resolvedServerOnlyByPath,
      ),
    );
  }

  if (violations.length > 0) {
    const lines = violations
      .map(
        (violation) =>
          `- ${violation.filePath}:${violation.line}:${violation.column} ${violation.detail}`,
      )
      .join("\n");

    throw new Error(
      `Browser files import or re-export server/edge-only resources or actions.\n${lines}`,
    );
  }

  process.stdout.write(
    `Where boundary guard passed (${browserFilePaths.length} browser files scanned).\n`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
