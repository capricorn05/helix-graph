import path from "node:path";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";

interface HasRequest {
  request: IncomingMessage;
}

interface HasResponse {
  response: ServerResponse;
}

interface HasUrl {
  url: URL;
}

export function sendJson(ctx: HasResponse, statusCode: number, data: unknown): void {
  ctx.response.statusCode = statusCode;
  ctx.response.setHeader("content-type", "application/json; charset=utf-8");
  ctx.response.end(JSON.stringify(data));
}

export async function readJsonBody<T>(ctx: HasRequest): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of ctx.request) {
    chunks.push(Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

export interface StaticMount {
  prefix: string;
  directory: string;
}

export interface StaticServeOptions {
  defaultContentType?: string;
}

function getContentType(filePath: string, fallback: string): string {
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }

  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }

  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }

  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }

  return fallback;
}

function resolveMountedFile(pathname: string, mount: StaticMount): string | null {
  if (!pathname.startsWith(mount.prefix)) {
    return null;
  }

  const relativePath = pathname.slice(mount.prefix.length);
  if (!relativePath) {
    return null;
  }

  const baseDir = path.resolve(mount.directory);
  const fullPath = path.resolve(baseDir, relativePath);

  if (fullPath !== baseDir && !fullPath.startsWith(`${baseDir}${path.sep}`)) {
    return null;
  }

  return fullPath;
}

export async function serveStaticTextFile(
  ctx: HasResponse & HasUrl,
  mounts: readonly StaticMount[],
  options: StaticServeOptions = {}
): Promise<boolean> {
  const defaultContentType = options.defaultContentType ?? "text/plain; charset=utf-8";

  for (const mount of mounts) {
    const filePath = resolveMountedFile(ctx.url.pathname, mount);
    if (!filePath) {
      continue;
    }

    try {
      const content = await readFile(filePath, "utf8");
      ctx.response.statusCode = 200;
      ctx.response.setHeader("content-type", getContentType(filePath, defaultContentType));
      ctx.response.end(content);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
