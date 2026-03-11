import type { ServerResponse } from "node:http";
import { runtimeGraph } from "./graph.js";
import { writeResourcesIntoSnapshot } from "./resource.js";
import type { BindingMap, GraphSnapshot } from "./types.js";

export interface CreateGraphSnapshotOptions {
  includeGraph?: boolean;
}

export function createGraphSnapshot(
  cells: Record<string, unknown>,
  options?: CreateGraphSnapshotOptions
): GraphSnapshot {
  const includeGraph = options?.includeGraph ?? true;

  const snapshot: GraphSnapshot = {
    version: "0.1",
    cells,
    resources: {},
    tags: {},
    createdAt: Date.now()
  };

  if (includeGraph) {
    const { nodes, edges } = runtimeGraph.toJSON();
    snapshot.nodes = nodes;
    snapshot.edges = edges;
  }

  writeResourcesIntoSnapshot(snapshot);
  return snapshot;
}

export function escapeJsonForScript(input: unknown): string {
  return JSON.stringify(input)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function snapshotScript(snapshot: GraphSnapshot): string {
  return `<script id=\"__HELIX_SNAPSHOT__\" type=\"application/helix+snapshot\">${escapeJsonForScript(snapshot)}</script>`;
}

export function bindingMapScript(bindingMap: BindingMap): string {
  return `<script id=\"__HELIX_BINDINGS__\" type=\"application/helix+bindingmap\">${escapeJsonForScript(bindingMap)}</script>`;
}

export async function streamHtmlSegments(
  response: ServerResponse,
  segments: Array<string | Promise<string>>
): Promise<void> {
  for (const segment of segments) {
    const chunk = await segment;
    response.write(chunk);
  }
}