import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const DISALLOWED_IMPORT = /(?:^|\/)helix\/index(?:\.js)?$/;

function isClientSourceFile(filePath) {
  const parts = filePath.split(path.sep);
  return parts.includes("client") && filePath.endsWith(".ts");
}

async function listClientFiles(rootDir) {
  const result = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (isClientSourceFile(absolutePath)) {
        result.push(absolutePath);
      }
    }
  }

  await walk(rootDir);
  return result.sort();
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

  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      addViolation(node.moduleSpecifier, node.moduleSpecifier.text, "import");
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      addViolation(node.moduleSpecifier, node.moduleSpecifier.text, "export");
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      addViolation(node.arguments[0], node.arguments[0].text, "dynamic import");
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      addViolation(node.arguments[0], node.arguments[0].text, "require");
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
  const clientFiles = await listClientFiles(srcRoot);
  const violations = [];

  for (const filePath of clientFiles) {
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
        return `- ${relativePath}:${violation.line}:${violation.column} ${violation.kind} \"${violation.specifier}\"`;
      })
      .join("\n");

    throw new Error(
      `Disallowed client imports from helix/index detected. Import browser-safe modules directly instead.\n${relativeViolations}`,
    );
  }

  process.stdout.write(
    `Client import guard passed (${clientFiles.length} files scanned).\n`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
