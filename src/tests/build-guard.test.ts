import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  collectBrowserServerOnlyImportViolations,
  collectModuleSpecifierUsages,
  collectServerOnlyModuleInfo,
  createRelativeModuleResolver,
  isExampleBrowserSourceFile,
  listSourceFiles,
  parseSourceFiles,
  resolveExportedServerOnlySymbols,
} from "../helix/build-guard.js";
import { parseTypeScriptSourceFile } from "../helix/compiler-utils.js";

test("collectModuleSpecifierUsages captures runtime and type-only module references", () => {
  const sourceFile = parseTypeScriptSourceFile(
    "/tmp/browser.ts",
    `
import { runtimeDep } from "./runtime-dep.js";
import type { TypeDep } from "./type-dep.js";
export { runtimeExport } from "./runtime-export.js";
export type { TypeExport } from "./type-export.js";
const dynamicMod = import("./dynamic-dep.js");
const requiredMod = require("./required-dep.js");
type Nested = import("./nested-type.js").Value;
`,
  );

  const usageShapes = collectModuleSpecifierUsages(sourceFile)
    .map((usage) => `${usage.kind}:${usage.specifier}:${String(usage.isTypeOnly)}`)
    .sort();

  assert.deepEqual(usageShapes, [
    "dynamic import:./dynamic-dep.js:false",
    "export:./runtime-export.js:false",
    "export:./type-export.js:true",
    "import type:./nested-type.js:true",
    "import:./runtime-dep.js:false",
    "import:./type-dep.js:true",
    "require:./required-dep.js:false",
  ]);
});

test("server-only export analysis propagates across re-exports into browser boundary violations", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "helix-build-guard-"),
  );

  try {
    const srcRoot = path.join(workspaceRoot, "src");
    const resourcesDir = path.join(srcRoot, "example", "resources");
    const sharedDir = path.join(srcRoot, "example", "shared");
    const clientDir = path.join(srcRoot, "example", "client");

    await fs.mkdir(resourcesDir, { recursive: true });
    await fs.mkdir(sharedDir, { recursive: true });
    await fs.mkdir(clientDir, { recursive: true });

    await fs.writeFile(
      path.join(resourcesDir, "secure.resource.ts"),
      `
import { resource } from "../../helix/index.js";

export const secureUsers = resource(
  "secure-users",
  () => ["secure-users"],
  async () => [],
  { where: "server" },
);
`,
      "utf8",
    );

    await fs.writeFile(
      path.join(sharedDir, "reexport.ts"),
      `
export { secureUsers } from "../resources/secure.resource.js";
`,
      "utf8",
    );

    await fs.writeFile(
      path.join(clientDir, "entry.ts"),
      `
import { secureUsers } from "../shared/reexport.js";

export const leaked = secureUsers;
`,
      "utf8",
    );

    const sourceFilePaths = await listSourceFiles(srcRoot);
    const parsedSourceByPath = await parseSourceFiles(sourceFilePaths);
    const resolver = createRelativeModuleResolver();

    const moduleInfoByPath = new Map();
    for (const filePath of sourceFilePaths) {
      const sourceFile = parsedSourceByPath.get(filePath);
      assert.ok(sourceFile);

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

    const violations = browserFilePaths.flatMap((browserFilePath) => {
      const sourceFile = parsedSourceByPath.get(browserFilePath);
      assert.ok(sourceFile);

      return collectBrowserServerOnlyImportViolations({
        workspaceRoot,
        browserFilePath,
        sourceFile,
        resolvedServerOnlyByPath,
        resolveModulePath: resolver.resolve,
      });
    });

    assert.ok(
      violations.some((violation) =>
        violation.detail.includes("re-export secureUsers"),
      ),
    );
    assert.ok(
      violations.some((violation) =>
        violation.detail.includes("import secureUsers"),
      ),
    );
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});