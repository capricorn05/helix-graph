import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_MARKER = "# helix-graph3 pre-commit hook";

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(scriptDir, "..");
  const gitDir = path.join(rootDir, ".git");
  const hooksDir = path.join(gitDir, "hooks");
  const preCommitPath = path.join(hooksDir, "pre-commit");

  if (!(await fileExists(gitDir))) {
    throw new Error(`No .git directory found at ${gitDir}`);
  }

  await fs.mkdir(hooksDir, { recursive: true });

  const hookBody = `#!/usr/bin/env sh
${HOOK_MARKER}
set -e

echo "[helix] running npm run verify"
npm run verify
`;

  if (await fileExists(preCommitPath)) {
    const existing = await fs.readFile(preCommitPath, "utf8");
    if (!existing.includes(HOOK_MARKER)) {
      throw new Error(
        `Existing ${preCommitPath} is not managed by this project. Add \"npm run verify\" manually or move your hook aside before running hooks:install.`,
      );
    }
  }

  await fs.writeFile(preCommitPath, hookBody, "utf8");
  await fs.chmod(preCommitPath, 0o755);

  process.stdout.write(`Installed pre-commit hook at ${preCommitPath}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
