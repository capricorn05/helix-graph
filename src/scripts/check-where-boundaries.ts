import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectBrowserServerOnlyImportViolations,
  collectServerOnlyModuleInfo,
  createRelativeModuleResolver,
  isExampleBrowserSourceFile,
  listSourceFiles,
  parseSourceFiles,
  resolveExportedServerOnlySymbols,
} from "../helix/build-guard.js";

export async function main(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(scriptDir, "../..");
  const srcRoot = path.join(workspaceRoot, "src");

  const sourceFilePaths = await listSourceFiles(srcRoot);
  const parsedSourceByPath = await parseSourceFiles(sourceFilePaths);
  const moduleInfoByPath = new Map();
  const resolver = createRelativeModuleResolver();

  for (const filePath of sourceFilePaths) {
    const sourceFile = parsedSourceByPath.get(filePath);
    if (!sourceFile) {
      continue;
    }

    moduleInfoByPath.set(
      filePath,
      collectServerOnlyModuleInfo({
        filePath,
        sourceFile,
        resolveModulePath: resolver.resolve,
      }),
    );
  }

  const resolvedServerOnlyByPath = new Map<string, Set<string>>();
  for (const filePath of sourceFilePaths) {
    resolvedServerOnlyByPath.set(
      filePath,
      resolveExportedServerOnlySymbols(
        filePath,
        moduleInfoByPath,
        resolvedServerOnlyByPath,
      ),
    );
  }

  const browserFilePaths = sourceFilePaths.filter((filePath) =>
    isExampleBrowserSourceFile(filePath),
  );

  const violations = [];
  for (const browserFilePath of browserFilePaths) {
    const sourceFile = parsedSourceByPath.get(browserFilePath);
    if (!sourceFile) {
      continue;
    }

    violations.push(
      ...collectBrowserServerOnlyImportViolations({
        workspaceRoot,
        browserFilePath,
        sourceFile,
        resolvedServerOnlyByPath,
        resolveModulePath: resolver.resolve,
      }),
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
