import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  compileTsxViewSource,
  toCamelCase,
  toPascalCase,
  type BindingEvent,
  type CompiledViewResult,
} from "../../helix/tsx-view-compiler.js";

function inferHandlerExport(bindingId: string): string {
  return `on${toPascalCase(bindingId)}`;
}

function inferActionId(bindingId: string): string {
  return toCamelCase(bindingId);
}

function renderBindingMapSource(
  bindings: Map<string, BindingEvent>,
  lists: readonly string[],
): string {
  const sortedBindings = Array.from(bindings.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  const sortedLists = [...lists].sort((a, b) => a.localeCompare(b));

  const events = sortedBindings
    .map(([id, event]) => {
      const lines = [
        `    "${id}": {`,
        `      id: "${id}",`,
        `      event: "${event}",`,
        `      actionId: "${inferActionId(id)}",`,
        '      chunk: "/client/actions.js",',
        `      handlerExport: "${inferHandlerExport(id)}",`,
      ];

      if (event === "submit") {
        lines.push("      preventDefault: true,");
      }

      lines.push("    }");
      return lines.join("\n");
    })
    .join(",\n");

  const listsSource = sortedLists
    .map(
      (id) =>
        `    "${id}": {\n      listId: "${id}",\n      keyAttr: "data-hx-key",\n    }`,
    )
    .join(",\n");

  return `{
  events: {
${events}
  },
  lists: {
${listsSource}
  },
}`;
}

function buildGeneratedModuleSource(
  fileBasename: string,
  propsIdentifier: string,
  compiled: CompiledViewResult,
): string {
  const viewPascal = toPascalCase(fileBasename);
  const viewCamel = toCamelCase(fileBasename);
  const artifactName = `${viewCamel}CompiledArtifact`;
  const renderFnName = `render${viewPascal}CompiledView`;
  const bindingFnName = `build${viewPascal}CompiledBindingMap`;

  const patchesSource = compiled.patches
    .map((patch) => {
      const shared = [
        `      kind: "${patch.kind}",`,
        `      token: ${JSON.stringify(patch.token)},`,
        `      targetId: ${JSON.stringify(patch.targetId)},`,
      ];

      if (patch.kind === "attr") {
        shared.push(`      attrName: ${JSON.stringify(patch.attrName ?? "")},`);
      }

      shared.push(
        `      evaluate: (${propsIdentifier}: any) => (${patch.expressionSource}),`,
      );

      return `    {\n${shared.join("\n")}\n    }`;
    })
    .join(",\n");

  const bindingMapSource = renderBindingMapSource(
    compiled.bindings,
    compiled.lists,
  );

  return `import type { BindingMap } from "../../../helix/types.js";
import {
  renderCompiledView,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

const compiledBindingMap: BindingMap = ${bindingMapSource};

export const ${artifactName}: CompiledViewArtifact<any> = {
  template: ${JSON.stringify(compiled.template)},
  patches: [
${patchesSource}
  ],
  bindingMap: compiledBindingMap,
};

export function ${renderFnName}(${propsIdentifier}: any): string {
  return renderCompiledView(${artifactName}, ${propsIdentifier});
}

export function ${bindingFnName}(): BindingMap {
  return compiledBindingMap;
}

export const ${viewCamel}CompiledPatchTable = ${artifactName}.patches;
`;
}

async function listTsxFiles(dirPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.name.endsWith(".tsx")) {
        continue;
      }

      results.push(absolutePath);
    }
  }

  await walk(dirPath);
  return results.sort();
}

async function listCompiledOutputs(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".compiled.ts"))
    .map((entry) => path.join(dirPath, entry.name))
    .sort();
}

export async function main(): Promise<void> {
  const checkMode = process.argv.includes("--check");
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(scriptDir, "../../..");
  const sourceRoot = path.join(workspaceRoot, "src/example/views-tsx");
  const outputRoot = path.join(workspaceRoot, "src/example/views/compiled");

  const sourceFiles = await listTsxFiles(sourceRoot);
  await fs.mkdir(outputRoot, { recursive: true });

  const expectedOutputFiles = new Set<string>();
  let generatedCount = 0;
  for (const sourcePath of sourceFiles) {
    const source = await fs.readFile(sourcePath, "utf8");
    const { basename, propsIdentifier, compiled } = compileTsxViewSource(
      sourcePath,
      source,
    );

    const outputContent = buildGeneratedModuleSource(
      basename,
      propsIdentifier,
      compiled,
    );

    const outputPath = path.join(outputRoot, `${basename}.compiled.ts`);
    expectedOutputFiles.add(outputPath);

    if (checkMode) {
      let existing = "";
      try {
        existing = await fs.readFile(outputPath, "utf8");
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "ENOENT"
        ) {
          throw new Error(
            `Missing compiled view output ${path.relative(workspaceRoot, outputPath)}. Run: npm run gen:views`,
          );
        }
        throw error;
      }

      if (existing !== outputContent) {
        throw new Error(
          `Compiled view drift detected for ${path.relative(workspaceRoot, outputPath)}. Run: npm run gen:views`,
        );
      }

      continue;
    }

    await fs.writeFile(outputPath, outputContent, "utf8");
    generatedCount += 1;
  }

  const existingOutputs = await listCompiledOutputs(outputRoot);
  const staleOutputs = existingOutputs.filter(
    (outputPath) => !expectedOutputFiles.has(outputPath),
  );

  if (staleOutputs.length > 0) {
    const relativeStale = staleOutputs.map((outputPath) =>
      path.relative(workspaceRoot, outputPath),
    );

    if (checkMode) {
      throw new Error(
        `Stale compiled view outputs detected:\n${relativeStale.map((entry) => `- ${entry}`).join("\n")}\nRun: npm run gen:views`,
      );
    }

    await Promise.all(staleOutputs.map((outputPath) => fs.unlink(outputPath)));
  }

  if (checkMode) {
    if (sourceFiles.length === 0) {
      process.stdout.write("No TSX views found for compilation.\n");
      return;
    }

    process.stdout.write(
      `Compiled views are up to date (${sourceFiles.length} files checked).\n`,
    );
    return;
  }

  if (sourceFiles.length === 0) {
    process.stdout.write("No TSX views found for compilation.\n");
    return;
  }

  const staleSuffix =
    staleOutputs.length > 0
      ? ` Removed ${staleOutputs.length} stale outputs.`
      : "";
  process.stdout.write(
    `Compiled ${generatedCount} TSX view files into ${path.relative(workspaceRoot, outputRoot)}.${staleSuffix}\n`,
  );
}

function isExecutedAsEntryPoint(): boolean {
  const entryArg = process.argv[1];
  if (!entryArg) {
    return false;
  }

  return import.meta.url === pathToFileURL(path.resolve(entryArg)).href;
}

if (isExecutedAsEntryPoint()) {
  main().catch((error) => {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
