import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectModuleSpecifierUsages,
  createRelativeModuleResolver,
  getNodeLocation,
  isExampleBrowserSafePath,
  listExampleBrowserSourceFiles,
  parseSourceFiles,
} from "../helix/build-guard.js";

const DISALLOWED_IMPORT = /(?:^|\/)helix\/index(?:\.js)?$/;

interface BrowserImportViolation {
  filePath: string;
  line: number;
  column: number;
  specifier: string;
  kind: string;
  reason?: string;
}

export async function main(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(scriptDir, "../..");
  const srcRoot = path.join(workspaceRoot, "src");

  const browserFiles = await listExampleBrowserSourceFiles(srcRoot, {
    extensions: [".ts"],
  });
  const parsedSourceByPath = await parseSourceFiles(browserFiles);
  const resolver = createRelativeModuleResolver();

  const violations: BrowserImportViolation[] = [];

  for (const filePath of browserFiles) {
    const sourceFile = parsedSourceByPath.get(filePath);
    if (!sourceFile) {
      continue;
    }

    const usages = collectModuleSpecifierUsages(sourceFile);
    for (const usage of usages) {
      if (DISALLOWED_IMPORT.test(usage.specifier)) {
        const location = getNodeLocation(sourceFile, usage.node);
        violations.push({
          filePath,
          line: location.line,
          column: location.column,
          specifier: usage.specifier,
          kind: usage.kind,
        });
      }

      if (usage.isTypeOnly) {
        continue;
      }

      const resolvedPath = resolver.resolve(filePath, usage.specifier);
      if (!resolvedPath) {
        continue;
      }

      if (!resolvedPath.includes(`${path.sep}example${path.sep}`)) {
        continue;
      }

      if (isExampleBrowserSafePath(resolvedPath)) {
        continue;
      }

      const location = getNodeLocation(sourceFile, usage.node);
      violations.push({
        filePath,
        line: location.line,
        column: location.column,
        specifier: usage.specifier,
        kind: usage.kind,
        reason:
          "Browser modules may only import from src/example/client, src/example/shared, or src/helix",
      });
    }
  }

  if (violations.length > 0) {
    const relativeViolations = violations
      .map((violation) => {
        const relativePath = path.relative(workspaceRoot, violation.filePath);
        const reasonSuffix = violation.reason ? ` — ${violation.reason}` : "";
        return `- ${relativePath}:${violation.line}:${violation.column} ${violation.kind} "${violation.specifier}"${reasonSuffix}`;
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
