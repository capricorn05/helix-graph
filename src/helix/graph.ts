import type { GraphEdge, GraphNode } from "./types.js";

export class UnifiedGraph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly edges = new Map<string, GraphEdge>();
  private readonly outgoing = new Map<string, Set<string>>();
  private readonly incoming = new Map<string, Set<string>>();

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
    if (!this.outgoing.has(edge.from)) {
      this.outgoing.set(edge.from, new Set());
    }
    if (!this.incoming.has(edge.to)) {
      this.incoming.set(edge.to, new Set());
    }
    this.outgoing.get(edge.from)?.add(edge.id);
    this.incoming.get(edge.to)?.add(edge.id);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  hasEdge(id: string): boolean {
    return this.edges.has(id);
  }

  getDependents(nodeId: string): GraphNode[] {
    const edgeIds = this.outgoing.get(nodeId);
    if (!edgeIds) {
      return [];
    }

    const dependents: GraphNode[] = [];
    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId);
      if (!edge) {
        continue;
      }
      const target = this.nodes.get(edge.to);
      if (target) {
        dependents.push(target);
      }
    }
    return dependents;
  }

  getDependencies(nodeId: string): GraphNode[] {
    const edgeIds = this.incoming.get(nodeId);
    if (!edgeIds) {
      return [];
    }

    const dependencies: GraphNode[] = [];
    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId);
      if (!edge) {
        continue;
      }
      const source = this.nodes.get(edge.from);
      if (source) {
        dependencies.push(source);
      }
    }
    return dependencies;
  }

  toJSON(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  /** Return all nodes of a specific type — useful for devtools and introspection. */
  getNodesByType(type: GraphNode["type"]): GraphNode[] {
    const result: GraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.type === type) result.push(node);
    }
    return result;
  }

  /** Return node count (quick health-check). */
  get size(): number {
    return this.nodes.size;
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.outgoing.clear();
    this.incoming.clear();
  }
}

let globalNodeCounter = 0;
let globalEdgeCounter = 0;

export const runtimeGraph = new UnifiedGraph();

function stableEdgeId(
  type: GraphEdge["type"],
  from: string,
  to: string,
): string {
  return `${type}:${from}->${to}`;
}

export function connectRouteToView(routeId: string, viewId: string): void {
  runtimeGraph.addEdge({
    id: stableEdgeId("renders", routeId, viewId),
    from: routeId,
    to: viewId,
    type: "renders",
  });
}

export function connectViewToResource(
  viewId: string,
  resourceId: string,
): void {
  runtimeGraph.addEdge({
    id: stableEdgeId("dependsOn", resourceId, viewId),
    from: resourceId,
    to: viewId,
    type: "dependsOn",
  });
}

export function connectRouteViewResources(
  routeId: string,
  viewIds: readonly string[],
  resourceIds: readonly string[],
): void {
  for (const viewId of viewIds) {
    connectRouteToView(routeId, viewId);
    for (const resourceId of resourceIds) {
      connectViewToResource(viewId, resourceId);
    }
  }
}

export function resetRuntimeGraph(): void {
  runtimeGraph.clear();
  globalNodeCounter = 0;
  globalEdgeCounter = 0;
}

export function nextNodeId(prefix: string): string {
  globalNodeCounter += 1;
  return `${prefix}:${globalNodeCounter}`;
}

export function nextEdgeId(prefix: string): string {
  globalEdgeCounter += 1;
  return `${prefix}:${globalEdgeCounter}`;
}
