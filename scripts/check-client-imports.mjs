import { promises as fs, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const DISALLOWED_IMPORT = /(?:^|\/)helix\/index(?:\.js)?$/;

function isBrowserSourceFile(filePath) {
  const parts = filePath.split(path.sep);
  if (!filePath.endsWith(".ts")) {
    return false;
  }

  const exampleIndex = parts.lastIndexOf("example");
  if (exampleIndex === -1) {
    return false;
  }

  const segment = parts[exampleIndex + 1];
  return segment === "client" || segment === "shared";
}

async function listBrowserFiles(rootDir) {
  const result = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (isBrowserSourceFile(absolutePath)) {
        result.push(absolutePath);
      }
    }
  }

  await walk(rootDir);
  return result.sort();
}

function normalizeSpecifierForResolution(specifier) {
  if (specifier.endsWith(".js")) {
    return specifier.slice(0, -3);
  }

  return specifier;
}

const fsStatCache = new Map();

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

function isExampleBrowserSafePath(filePath) {
  const parts = filePath.split(path.sep);
  const exampleIndex = parts.lastIndexOf("example");
  if (exampleIndex === -1) {
    return false;
  }

  const segment = parts[exampleIndex + 1];
  return segment === "client" || segment === "shared";
}

function collectViolations(sourceFile) {
  const violations = [];

  function addViolation(node, specifier, kind) {
    if (!DISALLOWED_IMPORT.test(specifier)) {
      return;
    }

    const position = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    violations.push({
      filePath: sourceFile.fileName,
      line: position.line + 1,
      column: position.character + 1,
      specifier,
      kind,
    });
  }

  function addBoundaryViolation(node, specifier, kind) {
    const resolvedPath = resolveModulePath(sourceFile.fileName, specifier);
    if (!resolvedPath) {
      return;
    }

    if (!resolvedPath.includes(`${path.sep}example${path.sep}`)) {
      return;
    }

    if (isExampleBrowserSafePath(resolvedPath)) {
      return;
    }

    const position = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    violations.push({
      filePath: sourceFile.fileName,
      line: position.line + 1,
      column: position.character + 1,
      specifier,
      kind,
      reason:
        "Browser modules may only import from src/example/client, src/example/shared, or src/helix",
    });
  }

  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      addViolation(node.moduleSpecifier, node.moduleSpecifier.text, "import");
      if (!node.importClause?.isTypeOnly) {
        addBoundaryViolation(
          node.moduleSpecifier,
          node.moduleSpecifier.text,
          "import",
        );
      }
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      addViolation(node.moduleSpecifier, node.moduleSpecifier.text, "export");
      if (!node.isTypeOnly) {
        addBoundaryViolation(
          node.moduleSpecifier,
          node.moduleSpecifier.text,
          "export",
        );
      }
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      addViolation(node.arguments[0], node.arguments[0].text, "dynamic import");
      addBoundaryViolation(
        node.arguments[0],
        node.arguments[0].text,
        "dynamic import",
      );
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      addViolation(node.arguments[0], node.arguments[0].text, "require");
      addBoundaryViolation(
        node.arguments[0],
        node.arguments[0].text,
        "require",
      );
    }

    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      addViolation(
        node.argument.literal,
        node.argument.literal.text,
        "import type",
      );
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(scriptDir, "..");
  const srcRoot = path.join(workspaceRoot, "src");
  const browserFiles = await listBrowserFiles(srcRoot);
  const violations = [];

  for (const filePath of browserFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    violations.push(...collectViolations(sourceFile));
  }

  if (violations.length > 0) {
    const relativeViolations = violations
      .map((violation) => {
        const relativePath = path.relative(workspaceRoot, violation.filePath);
        const reasonSuffix = violation.reason ? ` — ${violation.reason}` : "";
        return `- ${relativePath}:${violation.line}:${violation.column} ${violation.kind} \"${violation.specifier}\"${reasonSuffix}`;
      })
      .join("\n");

    throw new Error(
      `Disallowed browser imports detected. Import browser-safe modules directly instead.\n${relativeViolations}`,
    );
  }

  process.stdout.write(
    `Browser import guard passed (${browserFiles.length} files scanned).\n`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
