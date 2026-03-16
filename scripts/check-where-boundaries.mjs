import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const compiledEntry = pathToFileURL(
    path.resolve(scriptDir, "../dist/scripts/check-where-boundaries.js"),
  ).href;

  const module = await import(compiledEntry);
  await module.main();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
