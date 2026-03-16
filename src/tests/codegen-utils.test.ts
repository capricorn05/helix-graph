import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  isExecutedAsEntryPoint,
  listFilesWithExtension,
  listFilesWithSuffix,
} from "../helix/codegen-utils.js";

test("listFilesWithExtension recursively collects matching files", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "helix-codegen-"));

  try {
    await fs.mkdir(path.join(rootDir, "nested"), { recursive: true });
    await fs.writeFile(path.join(rootDir, "top.ts"), "export {};\n", "utf8");
    await fs.writeFile(
      path.join(rootDir, "nested", "inner.ts"),
      "export {};\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(rootDir, "nested", "ignored.tsx"),
      "export {};\n",
      "utf8",
    );

    const files = await listFilesWithExtension(rootDir, ".ts");
    assert.deepEqual(files, [
      path.join(rootDir, "nested", "inner.ts"),
      path.join(rootDir, "top.ts"),
    ]);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test("listFilesWithSuffix and isExecutedAsEntryPoint provide script helpers", async () => {
  const rootDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "helix-codegen-out-"),
  );

  try {
    await fs.mkdir(path.join(rootDir, "nested"), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, "one.compiled.ts"),
      "export {};\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(rootDir, "two.generated.ts"),
      "export {};\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(rootDir, "nested", "three.compiled.ts"),
      "export {};\n",
      "utf8",
    );

    const outputs = await listFilesWithSuffix(rootDir, ".compiled.ts");
    assert.deepEqual(outputs, [path.join(rootDir, "one.compiled.ts")]);

    assert.equal(
      isExecutedAsEntryPoint(
        pathToFileURL("/tmp/demo-script.mjs").href,
        "/tmp/demo-script.mjs",
      ),
      true,
    );
    assert.equal(
      isExecutedAsEntryPoint(
        pathToFileURL("/tmp/demo-script.mjs").href,
        "/tmp/other-script.mjs",
      ),
      false,
    );
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});
