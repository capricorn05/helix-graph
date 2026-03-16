import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCompiledViewCodegen } from "../../helix/compiled-view-codegen.js";
import { isExecutedAsEntryPoint } from "../../helix/codegen-utils.js";

export async function main(): Promise<void> {
  const checkMode = process.argv.includes("--check");
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(scriptDir, "../../..");
  await runCompiledViewCodegen({
    checkMode,
    workspaceRoot,
    sourceRoot: path.join(workspaceRoot, "src/example/views-tsx"),
    outputRoot: path.join(workspaceRoot, "src/example/views/compiled"),
    bindingMapTypeImportPath: "../../../helix/types.js",
    viewCompilerImportPath: "../../../helix/view-compiler.js",
    actionChunkPath: "/client/actions.js",
    regenerateCommand: "npm run gen:views",
  });
}

if (isExecutedAsEntryPoint(import.meta.url)) {
  main().catch((error) => {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
