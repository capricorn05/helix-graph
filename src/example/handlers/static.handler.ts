import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RouteContext } from "../../helix/index.js";
import { serveStaticTextFile } from "../../helix/node-http.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const STATIC_MOUNTS = [
  { prefix: "/client/", directory: path.join(ROOT, "client") },
  { prefix: "/helix/", directory: path.join(ROOT, "..", "helix") }
] as const;

export async function handleStaticFile(ctx: RouteContext): Promise<void> {
  const served = await serveStaticTextFile(ctx, STATIC_MOUNTS);
  if (!served) {
    ctx.response.statusCode = 404;
    ctx.response.end("Not found");
  }
}
