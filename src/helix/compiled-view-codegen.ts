import { promises as fs } from "node:fs";
import path from "node:path";
import { buildCompiledViewModuleSource } from "./codegen-emitters.js";
import {
  listFilesWithExtension,
  listFilesWithSuffix,
} from "./codegen-utils.js";
import {
  processGeneratedFileTasks,
  reconcileStaleGeneratedOutputs,
  resolveCodegenRunMode,
  type CodegenRunMode,
  type GeneratedFileTask,
} from "./codegen-runner.js";
import { compileTsxViewSource } from "./tsx-view-compiler.js";

export interface RunCompiledViewCodegenOptions {
  checkMode: boolean;
  workspaceRoot: string;
  sourceRoot: string;
  outputRoot: string;
  bindingMapTypeImportPath: string;
  viewCompilerImportPath: string;
  actionChunkPath: string;
  regenerateCommand?: string;
  statusWriter?: (message: string) => void;
}

export interface RunCompiledViewCodegenResult {
  mode: CodegenRunMode;
  sourceFileCount: number;
  generatedFileCount: number;
  removedCount: number;
}

function toImportPath(fromFilePath: string, toFilePath: string): string {
  const relativePath = path.relative(path.dirname(fromFilePath), toFilePath);
  const normalized = relativePath.split(path.sep).join("/");
  return normalized.startsWith(".") ? normalized : `./${normalized}`;
}

export async function runCompiledViewCodegen(
  options: RunCompiledViewCodegenOptions,
): Promise<RunCompiledViewCodegenResult> {
  const mode = resolveCodegenRunMode(options.checkMode);
  const command = options.regenerateCommand ?? "npm run gen:views";
  const writeStatus =
    options.statusWriter ??
    ((message: string) => process.stdout.write(message));

  const sourceFiles = await listFilesWithExtension(options.sourceRoot, ".tsx");
  await fs.mkdir(options.outputRoot, { recursive: true });

  const expectedOutputFiles = new Set<string>();
  const generatedFileTasks: GeneratedFileTask[] = [];

  for (const sourcePath of sourceFiles) {
    const source = await fs.readFile(sourcePath, "utf8");
    const { basename, propsIdentifier, compiled } = compileTsxViewSource(
      sourcePath,
      source,
    );
    const outputPath = path.join(options.outputRoot, `${basename}.compiled.ts`);
    const sourceModuleImportPath = toImportPath(outputPath, sourcePath).replace(
      /\.tsx$/,
      ".js",
    );

    const outputContent = buildCompiledViewModuleSource({
      fileBasename: basename,
      propsIdentifier,
      compiled,
      sourceModuleImportPath,
      bindingMapTypeImportPath: options.bindingMapTypeImportPath,
      viewCompilerImportPath: options.viewCompilerImportPath,
      bindingInference: {
        actionChunkPath: options.actionChunkPath,
      },
    });

    expectedOutputFiles.add(outputPath);
    generatedFileTasks.push({
      outputPath,
      content: outputContent,
    });
  }

  await processGeneratedFileTasks({
    mode,
    workspaceRoot: options.workspaceRoot,
    tasks: generatedFileTasks,
    onMissing: (relativeOutputPath) =>
      `Missing compiled view output ${relativeOutputPath}. Run: ${command}`,
    onDrift: (relativeOutputPath) =>
      `Compiled view drift detected for ${relativeOutputPath}. Run: ${command}`,
  });

  const existingOutputs = await listFilesWithSuffix(
    options.outputRoot,
    ".compiled.ts",
  );
  const { removedCount } = await reconcileStaleGeneratedOutputs({
    mode,
    workspaceRoot: options.workspaceRoot,
    expectedOutputFiles,
    existingOutputFiles: existingOutputs,
    onStale: (relativeOutputPaths) =>
      `Stale compiled view outputs detected:\n${relativeOutputPaths
        .map((entry) => `- ${entry}`)
        .join("\n")}\nRun: ${command}`,
  });

  if (mode === "check") {
    if (sourceFiles.length === 0) {
      writeStatus("No TSX views found for compilation.\n");
    } else {
      writeStatus(
        `Compiled views are up to date (${sourceFiles.length} files checked).\n`,
      );
    }

    return {
      mode,
      sourceFileCount: sourceFiles.length,
      generatedFileCount: generatedFileTasks.length,
      removedCount,
    };
  }

  if (sourceFiles.length === 0) {
    writeStatus("No TSX views found for compilation.\n");
    return {
      mode,
      sourceFileCount: sourceFiles.length,
      generatedFileCount: generatedFileTasks.length,
      removedCount,
    };
  }

  const staleSuffix =
    removedCount > 0 ? ` Removed ${removedCount} stale outputs.` : "";
  writeStatus(
    `Compiled ${generatedFileTasks.length} TSX view files into ${path.relative(options.workspaceRoot, options.outputRoot)}.${staleSuffix}\n`,
  );

  return {
    mode,
    sourceFileCount: sourceFiles.length,
    generatedFileCount: generatedFileTasks.length,
    removedCount,
  };
}
