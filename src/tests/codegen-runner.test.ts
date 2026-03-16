import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  processGeneratedFileTasks,
  reconcileStaleGeneratedOutputs,
} from "../helix/codegen-runner.js";

test("processGeneratedFileTasks writes generated outputs in write mode", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "helix-codegen-runner-write-"),
  );

  try {
    const outputPath = path.join(workspaceRoot, "generated", "demo.ts");
    const result = await processGeneratedFileTasks({
      mode: "write",
      workspaceRoot,
      tasks: [{ outputPath, content: "export const demo = 1;\n" }],
      onMissing: () => "missing",
      onDrift: () => "drift",
    });

    assert.deepEqual(result, { checkedCount: 0, writtenCount: 1 });

    const output = await fs.readFile(outputPath, "utf8");
    assert.equal(output, "export const demo = 1;\n");
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("processGeneratedFileTasks check mode rejects missing and drifted outputs", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "helix-codegen-runner-check-"),
  );

  try {
    const missingPath = path.join(workspaceRoot, "generated", "missing.ts");
    await assert.rejects(
      () =>
        processGeneratedFileTasks({
          mode: "check",
          workspaceRoot,
          tasks: [{ outputPath: missingPath, content: "export {};\n" }],
          onMissing: (relativePath) => `missing ${relativePath}`,
          onDrift: (relativePath) => `drift ${relativePath}`,
        }),
      /missing generated\/missing\.ts/,
    );

    const driftPath = path.join(workspaceRoot, "generated", "drift.ts");
    await fs.mkdir(path.dirname(driftPath), { recursive: true });
    await fs.writeFile(driftPath, "export const value = 1;\n", "utf8");

    await assert.rejects(
      () =>
        processGeneratedFileTasks({
          mode: "check",
          workspaceRoot,
          tasks: [
            { outputPath: driftPath, content: "export const value = 2;\n" },
          ],
          onMissing: (relativePath) => `missing ${relativePath}`,
          onDrift: (relativePath) => `drift ${relativePath}`,
        }),
      /drift generated\/drift\.ts/,
    );
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("reconcileStaleGeneratedOutputs enforces and prunes stale outputs", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "helix-codegen-runner-stale-"),
  );

  try {
    const outputDir = path.join(workspaceRoot, "generated");
    const keepOutput = path.join(outputDir, "keep.ts");
    const staleOutput = path.join(outputDir, "stale.ts");

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(keepOutput, "export const keep = true;\n", "utf8");
    await fs.writeFile(staleOutput, "export const stale = true;\n", "utf8");

    await assert.rejects(
      () =>
        reconcileStaleGeneratedOutputs({
          mode: "check",
          workspaceRoot,
          expectedOutputFiles: new Set([keepOutput]),
          existingOutputFiles: [keepOutput, staleOutput],
          onStale: (relativeOutputPaths) =>
            `stale\n${relativeOutputPaths.map((entry) => `- ${entry}`).join("\n")}`,
        }),
      /stale[\s\S]*generated\/stale\.ts/,
    );

    const result = await reconcileStaleGeneratedOutputs({
      mode: "write",
      workspaceRoot,
      expectedOutputFiles: new Set([keepOutput]),
      existingOutputFiles: [keepOutput, staleOutput],
      onStale: (relativeOutputPaths) =>
        `stale\n${relativeOutputPaths.map((entry) => `- ${entry}`).join("\n")}`,
    });

    assert.equal(result.removedCount, 1);
    assert.deepEqual(result.staleOutputPaths, [staleOutput]);

    await assert.rejects(() => fs.access(staleOutput), /ENOENT/);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});
