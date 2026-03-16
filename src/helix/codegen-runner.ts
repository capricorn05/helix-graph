import { promises as fs } from "node:fs";
import path from "node:path";

export type CodegenRunMode = "check" | "write";

export interface GeneratedFileTask {
  outputPath: string;
  content: string;
}

export interface ProcessGeneratedFileTasksOptions {
  mode: CodegenRunMode;
  workspaceRoot: string;
  tasks: readonly GeneratedFileTask[];
  onMissing: (relativeOutputPath: string) => string;
  onDrift: (relativeOutputPath: string) => string;
}

export interface ProcessGeneratedFileTasksResult {
  checkedCount: number;
  writtenCount: number;
}

export interface ReconcileStaleGeneratedOutputsOptions {
  mode: CodegenRunMode;
  workspaceRoot: string;
  expectedOutputFiles: ReadonlySet<string>;
  existingOutputFiles: readonly string[];
  onStale: (relativeOutputPaths: readonly string[]) => string;
}

export interface ReconcileStaleGeneratedOutputsResult {
  staleOutputPaths: string[];
  removedCount: number;
}

function toWorkspaceRelativePath(
  workspaceRoot: string,
  absolutePath: string,
): string {
  return path.relative(workspaceRoot, absolutePath);
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

export function resolveCodegenRunMode(checkMode: boolean): CodegenRunMode {
  return checkMode ? "check" : "write";
}

export async function processGeneratedFileTasks(
  options: ProcessGeneratedFileTasksOptions,
): Promise<ProcessGeneratedFileTasksResult> {
  let checkedCount = 0;
  let writtenCount = 0;

  for (const task of options.tasks) {
    const relativeOutputPath = toWorkspaceRelativePath(
      options.workspaceRoot,
      task.outputPath,
    );

    if (options.mode === "check") {
      let existing = "";
      try {
        existing = await fs.readFile(task.outputPath, "utf8");
      } catch (error) {
        if (isMissingFileError(error)) {
          throw new Error(options.onMissing(relativeOutputPath));
        }
        throw error;
      }

      if (existing !== task.content) {
        throw new Error(options.onDrift(relativeOutputPath));
      }

      checkedCount += 1;
      continue;
    }

    await fs.mkdir(path.dirname(task.outputPath), { recursive: true });
    await fs.writeFile(task.outputPath, task.content, "utf8");
    writtenCount += 1;
  }

  return { checkedCount, writtenCount };
}

export async function reconcileStaleGeneratedOutputs(
  options: ReconcileStaleGeneratedOutputsOptions,
): Promise<ReconcileStaleGeneratedOutputsResult> {
  const staleOutputPaths = options.existingOutputFiles
    .filter((outputPath) => !options.expectedOutputFiles.has(outputPath))
    .sort();

  if (staleOutputPaths.length === 0) {
    return {
      staleOutputPaths: [],
      removedCount: 0,
    };
  }

  const relativeOutputPaths = staleOutputPaths.map((outputPath) =>
    toWorkspaceRelativePath(options.workspaceRoot, outputPath),
  );

  if (options.mode === "check") {
    throw new Error(options.onStale(relativeOutputPaths));
  }

  await Promise.all(
    staleOutputPaths.map((outputPath) => fs.unlink(outputPath)),
  );

  return {
    staleOutputPaths,
    removedCount: staleOutputPaths.length,
  };
}
