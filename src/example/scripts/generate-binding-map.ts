import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectBindingsAndListsFromViewSource,
  collectClientHandlersFromSource,
  type BindingEvent,
} from "../../helix/binding-map-compiler.js";
import { resolveClientActionEventEntries } from "../../helix/client-action-metadata.js";
import {
  buildBindingMapModuleSource,
  type BindingMapListEntry,
} from "../../helix/codegen-emitters.js";
import { parseTypeScriptSourceFile } from "../../helix/compiler-utils.js";
import {
  isExecutedAsEntryPoint,
  listFilesWithExtension,
} from "../../helix/codegen-utils.js";
import {
  processGeneratedFileTasks,
  resolveCodegenRunMode,
} from "../../helix/codegen-runner.js";
import { appClientActionMetadata } from "../shared/client-action-metadata.js";

export async function main(): Promise<void> {
  const mode = resolveCodegenRunMode(process.argv.includes("--check"));
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(scriptDir, "../../..");
  const viewsDir = path.join(workspaceRoot, "src/example/views");
  const clientDir = path.join(workspaceRoot, "src/example/client");
  const outputPath = path.join(viewsDir, "binding-map.generated.ts");

  const viewFiles = await listFilesWithExtension(viewsDir, ".ts");
  const clientFiles = await listFilesWithExtension(clientDir, ".ts");

  const bindingsMap = new Map<string, BindingEvent>();
  const listIds = new Set<string>();

  for (const filePath of viewFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const sourceFile = parseTypeScriptSourceFile(filePath, content);

    const { bindings, listIds: discoveredLists } =
      collectBindingsAndListsFromViewSource(sourceFile);

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
    const sourceFile = parseTypeScriptSourceFile(filePath, content);

    for (const handler of collectClientHandlersFromSource(sourceFile)) {
      handlers.add(handler);
    }
  }

  const bindings = Array.from(bindingsMap.entries()).map(([id, event]) => ({
    id,
    event,
  }));

  const eventEntries = resolveClientActionEventEntries({
    bindings,
    availableHandlers: handlers,
    metadata: appClientActionMetadata,
    defaultChunk: "/client/actions.js",
  });

  const listEntries: BindingMapListEntry[] = Array.from(listIds).map(
    (listId) => ({
      listId,
      keyAttr: "data-hx-key",
    }),
  );

  const generated = buildBindingMapModuleSource({
    generatedBy: "src/example/scripts/generate-binding-map.ts",
    bindingMapImportPath: "../../helix/index.js",
    bindingMapConstName: "appBindingMap",
    bindingMapBuilderName: "buildAppBindingMap",
    events: eventEntries,
    lists: listEntries,
  });

  await processGeneratedFileTasks({
    mode,
    workspaceRoot,
    tasks: [{ outputPath, content: generated }],
    onMissing: (relativeOutputPath) =>
      `Missing generated binding map at ${relativeOutputPath}. Run: npm run gen:bindings`,
    onDrift: (relativeOutputPath) =>
      `Binding map drift detected at ${relativeOutputPath}. Run: npm run gen:bindings`,
  });

  if (mode === "check") {
    process.stdout.write(
      `Binding map is up to date (${bindings.length} bindings, ${listIds.size} lists).\n`,
    );
    return;
  }

  process.stdout.write(
    `Generated binding map with ${bindings.length} bindings and ${listIds.size} list bindings at ${outputPath}\n`,
  );
}

if (isExecutedAsEntryPoint(import.meta.url)) {
  main().catch((error) => {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
