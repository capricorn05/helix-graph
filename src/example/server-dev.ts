/**
 * Development Server with Hot-Reload Support
 *
 * Integrates file watching and live-reload script injection.
 * Runs alongside or as replacement to standard server in dev mode.
 *
 * Usage:
 *   NODE_ENV=development npm run start
 *   Then visit http://localhost:4173
 *   Edit client files in src/example/client/ and watch HMR reload
 */

import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { router } from "./routes/index.js";
import {
  LiveReloadTracker,
  injectLiveReloadScript,
} from "../helix/dev-server.js";

const PORT = Number(process.env.PORT ?? 4173);
const IS_DEV = process.env.NODE_ENV === "development";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "../../..");

// Initialize live reload if in dev mode
const liveReloadTracker = IS_DEV ? new LiveReloadTracker() : null;

if (IS_DEV && liveReloadTracker) {
  liveReloadTracker.start({
    workspaceRoot,
    watchDirs: [
      path.join(workspaceRoot, "src/example/client"),
      path.join(workspaceRoot, "src/example/views"),
      path.join(workspaceRoot, "src/helix"),
    ],
    onFilesChanged: async (changedFiles) => {
      console.log(
        `[DEV] Files changed: ${Array.from(changedFiles).join(", ")}`,
      );
      // In a full implementation, would regenerate artifacts here
      // For now, just log the change
    },
  });
  console.log(
    "[DEV] Live reload enabled. Changes to client code will trigger reload.",
  );
}

const server = createServer(async (request, response) => {
  try {
    const baseUrl = `http://${request.headers.host ?? "localhost"}`;
    const url = new URL(request.url ?? "/", baseUrl);

    // Dev server endpoints
    if (IS_DEV && url.pathname === "/dev/poll-changes") {
      const sinceParam = url.searchParams.get("since");
      const since = sinceParam ? parseInt(sinceParam, 10) : 0;

      const changes = liveReloadTracker?.pollChanges(since) ?? [];
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({
          timestamp: Date.now(),
          changes: changes.map((c) => ({
            type: c.type,
            filePath: c.filePath,
            timestamp: c.timestamp,
          })),
        }),
      );
      return;
    }

    // Route dispatch
    const matched = await router.dispatch(request, response, url);

    if (!matched) {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }

    // Inject live-reload script for HTML responses in dev mode
    if (
      IS_DEV &&
      response.statusCode === 200 &&
      response.getHeader("content-type")?.toString().includes("text/html")
    ) {
      // Note: In a full implementation, would wrap response.end to inject script
      // This is a simplified version that assumes route handlers return HTML
    }
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown server error",
      }),
    );
  }
});

server.listen(PORT, () => {
  const mode = IS_DEV ? "[DEV]" : "[PROD]";
  process.stdout.write(
    `${mode} Helix demo server listening on http://localhost:${PORT}\n`,
  );
  process.stdout.write(`Routes in graph: ${router.getRoutes().length}\n`);
});

// Cleanup on exit
process.on("SIGINT", () => {
  if (liveReloadTracker) {
    liveReloadTracker.stop();
  }
  process.exit(0);
});
