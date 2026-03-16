import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function listFilesWithExtension(
  rootDir: string,
  extension: string,
): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.name.endsWith(extension)) {
        continue;
      }

      results.push(absolutePath);
    }
  }

  await walk(rootDir);
  return results.sort();
}

export async function listFilesWithSuffix(
  dirPath: string,
  suffix: string,
): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => path.join(dirPath, entry.name))
    .sort();
}

export function isExecutedAsEntryPoint(
  importMetaUrl: string,
  entryArg: string | undefined = process.argv[1],
): boolean {
  if (!entryArg) {
    return false;
  }

  return importMetaUrl === pathToFileURL(path.resolve(entryArg)).href;
}
