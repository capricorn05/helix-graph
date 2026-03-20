import { createServer } from "node:http";
import "./env.js";
import { router } from "./routes/index.js";

const PORT = Number(process.env.PORT ?? 4173);

const server = createServer(async (request, response) => {
  try {
    const baseUrl = `http://${request.headers.host ?? "localhost"}`;
    const url     = new URL(request.url ?? "/", baseUrl);
    const matched = await router.dispatch(request, response, url);
    if (!matched) {
      response.statusCode = 404;
      response.end("Not found");
    }
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown server error"
    }));
  }
});

server.listen(PORT, () => {
  process.stdout.write(`Helix demo server listening on http://localhost:${PORT}\n`);
  process.stdout.write(`Routes in graph: ${router.getRoutes().length}\n`);
});
