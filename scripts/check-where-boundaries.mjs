import { promises as fs, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const SERVER_ONLY_WHERE = new Set(["server", "edge"]);

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

function resolveWhereFromPolicyArg(arg) {
  if (!arg || !ts.isObjectLiteralExpression(arg)) {
    return null;
  }

  for (const property of arg.properties) {
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
          );
        } else if (actionAliases.has(callee)) {
          where = resolveWhereFromPolicyArg(
            declaration.initializer.arguments[2],
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

function collectClientImportViolations(
  workspaceRoot,
  clientFilePath,
  sourceFile,
  resolvedServerOnlyByPath,
) {
  const violations = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }

    const specifier = getStringLiteralText(statement.moduleSpecifier);
    if (!specifier) {
      continue;
    }

    const targetPath = resolveModulePath(clientFilePath, specifier);
    if (!targetPath) {
      continue;
    }

    const serverOnlyExports = resolvedServerOnlyByPath.get(targetPath);
    if (!serverOnlyExports || serverOnlyExports.size === 0) {
      continue;
    }

    const importClause = statement.importClause;
    const location = sourceFile.getLineAndCharacterOfPosition(
      statement.moduleSpecifier.getStart(sourceFile),
    );

    const relativePath = path.relative(workspaceRoot, clientFilePath);

    if (!importClause) {
      continue;
    }

    if (importClause.name) {
      violations.push({
        filePath: relativePath,
        line: location.line + 1,
        column: location.character + 1,
        detail: `default import from ${specifier}`,
      });
      continue;
    }

    if (
      importClause.namedBindings &&
      ts.isNamespaceImport(importClause.namedBindings)
    ) {
      violations.push({
        filePath: relativePath,
        line: location.line + 1,
        column: location.character + 1,
        detail: `namespace import from ${specifier}`,
      });
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

        violations.push({
          filePath: relativePath,
          line: location.line + 1,
          column: location.character + 1,
          detail: `import ${importedName} from ${specifier}`,
        });
      }
    }
  }

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

  const clientFilePaths = sourceFilePaths.filter((filePath) => {
    const parts = filePath.split(path.sep);
    return parts.includes("client");
  });

  const violations = [];
  for (const clientFilePath of clientFilePaths) {
    const sourceFile = parsedSourceByPath.get(clientFilePath);
    if (!sourceFile) {
      continue;
    }

    violations.push(
      ...collectClientImportViolations(
        workspaceRoot,
        clientFilePath,
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
      `Client files import server/edge-only resources or actions.\n${lines}`,
    );
  }

  process.stdout.write(
    `Where boundary guard passed (${clientFilePaths.length} client files scanned).\n`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
