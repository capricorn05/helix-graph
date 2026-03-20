import type { CausalTraceEntry, GraphEdge, GraphNode } from "./types.js";
import { runtimeGraph } from "./graph.js";
import type { HelixScheduler } from "./scheduler.js";

export interface DevtoolsConfig {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  startOpen?: boolean;
  maxTraceEntries?: number;
}

export class HelixDevtools {
  private config: Required<DevtoolsConfig>;
  private panelElement: HTMLElement | null = null;
  private isOpen = false;
  private scheduler: HelixScheduler | null = null;
  private traces: CausalTraceEntry[] = [];

  constructor(config?: DevtoolsConfig) {
    this.config = {
      position: config?.position ?? "bottom-right",
      startOpen: config?.startOpen ?? false,
      maxTraceEntries: config?.maxTraceEntries ?? 50
    };
  }

  setScheduler(scheduler: HelixScheduler): void {
    this.scheduler = scheduler;
  }

  mount(): void {
    this.createPanel();
    if (this.config.startOpen) {
      this.open();
    }
  }

  private createPanel(): void {
    const panel = document.createElement("div");
    panel.id = "__helix_devtools__";
    panel.style.cssText = `
      position: fixed;
      ${this.config.position.startsWith("top") ? "top: 10px" : "bottom: 10px"};
      ${this.config.position.includes("right") ? "right: 10px" : "left: 10px"};
      width: 420px;
      max-height: 500px;
      background: #1e1e1e;
      border: 1px solid #333;
      border-radius: 8px;
      color: #d4d4d4;
      font-family: monospace;
      font-size: 12px;
      z-index: 999999;
      display: none;
      flex-direction: column;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #333;">
        <strong style="font-size: 13px;">Helix DevTools</strong>
        <button id="__helix_devtools_close__" style="background: none; border: none; color: #d4d4d4; cursor: pointer; font-size: 14px;">✕</button>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 8px;">
        <div id="__helix_graph_view__" style="display: none;">
          <h4 style="margin: 0 0 6px 0; color: #4ec9b0;">Graph Nodes</h4>
          <div id="__helix_nodes_list__" style="font-size: 11px; line-height: 1.4;"></div>
        </div>
        <div id="__helix_topology_view__" style="display: none;">
          <h4 style="margin: 0 0 6px 0; color: #4ec9b0;">Scope / Effect Topology</h4>
          <div id="__helix_topology_list__" style="font-size: 11px; line-height: 1.4;"></div>
        </div>
        <div id="__helix_traces_view__">
          <h4 style="margin: 0 0 6px 0; color: #4ec9b0;">Causality Traces</h4>
          <div id="__helix_traces_list__" style="font-size: 11px; line-height: 1.4; max-height: 300px; overflow-y: auto;"></div>
        </div>
      </div>
      <div style="display: flex; gap: 4px; padding: 8px; border-top: 1px solid #333;">
        <button id="__helix_graph_tab__" style="flex: 1; padding: 4px; background: #333; color: #d4d4d4; border: 1px solid #555; border-radius: 3px; cursor: pointer;">Graph</button>
        <button id="__helix_topology_tab__" style="flex: 1; padding: 4px; background: #333; color: #d4d4d4; border: 1px solid #555; border-radius: 3px; cursor: pointer;">Topology</button>
        <button id="__helix_traces_tab__" style="flex: 1; padding: 4px; background: #2d2d30; color: #d4d4d4; border: 1px solid #555; border-radius: 3px; cursor: pointer; font-weight: bold;">Traces</button>
        <button id="__helix_clear_btn__" style="flex: 1; padding: 4px; background: #333; color: #d4d4d4; border: 1px solid #555; border-radius: 3px; cursor: pointer;">Clear</button>
      </div>
    `;

    document.body.appendChild(panel);
    this.panelElement = panel;

    panel.querySelector("#__helix_devtools_close__")?.addEventListener("click", () => this.close());
    panel.querySelector("#__helix_graph_tab__")?.addEventListener("click", () => this.switchTab("graph"));
    panel.querySelector("#__helix_topology_tab__")?.addEventListener("click", () => this.switchTab("topology"));
    panel.querySelector("#__helix_traces_tab__")?.addEventListener("click", () => this.switchTab("traces"));
    panel.querySelector("#__helix_clear_btn__")?.addEventListener("click", () => this.clearTraces());

    // Make panel draggable
    this.makeHeaderDraggable(panel);
  }

  private makeHeaderDraggable(panel: HTMLElement): void {
    const header = panel.querySelector("div");
    if (!header) return;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener("mousedown", (e) => {
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging || !panel) return;
      panel.style.left = e.clientX - offsetX + "px";
      panel.style.top = e.clientY - offsetY + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  private switchTab(tab: "graph" | "topology" | "traces"): void {
    const graphView = this.panelElement?.querySelector("#__helix_graph_view__") as HTMLElement;
    const topologyView = this.panelElement?.querySelector("#__helix_topology_view__") as HTMLElement;
    const tracesView = this.panelElement?.querySelector("#__helix_traces_view__") as HTMLElement;
    const graphTab = this.panelElement?.querySelector("#__helix_graph_tab__") as HTMLElement;
    const topologyTab = this.panelElement?.querySelector("#__helix_topology_tab__") as HTMLElement;
    const tracesTab = this.panelElement?.querySelector("#__helix_traces_tab__") as HTMLElement;

    const inactiveStyle = "#333";
    const activeStyle = "#2d2d30";

    if (graphView) graphView.style.display = "none";
    if (topologyView) topologyView.style.display = "none";
    if (tracesView) tracesView.style.display = "none";
    if (graphTab) { graphTab.style.background = inactiveStyle; graphTab.style.fontWeight = "normal"; }
    if (topologyTab) { topologyTab.style.background = inactiveStyle; topologyTab.style.fontWeight = "normal"; }
    if (tracesTab) { tracesTab.style.background = inactiveStyle; tracesTab.style.fontWeight = "normal"; }

    if (tab === "graph") {
      if (graphView) graphView.style.display = "block";
      if (graphTab) { graphTab.style.background = activeStyle; graphTab.style.fontWeight = "bold"; }
      this.renderGraphView();
    } else if (tab === "topology") {
      if (topologyView) topologyView.style.display = "block";
      if (topologyTab) { topologyTab.style.background = activeStyle; topologyTab.style.fontWeight = "bold"; }
      this.renderTopologyView();
    } else {
      if (tracesView) tracesView.style.display = "block";
      if (tracesTab) { tracesTab.style.background = activeStyle; tracesTab.style.fontWeight = "bold"; }
      this.renderTracesView();
    }
  }

  private renderGraphView(): void {
    const nodesList = this.panelElement?.querySelector("#__helix_nodes_list__");
    if (!nodesList) return;

    const { nodes } = runtimeGraph.toJSON();
    if (nodes.length === 0) {
      nodesList.innerHTML = "<div style=\"color: #888;\">No nodes</div>";
      return;
    }

    const TYPE_COLORS: Record<string, string> = {
      RouteNode:    "#c586c0",
      ViewNode:     "#4ec9b0",
      ResourceNode: "#dcdcaa",
      ActionNode:   "#f44747",
      CellNode:     "#9cdcfe",
      DerivedNode:  "#4fc1ff",
      EffectNode:   "#ce9178",
      AssetNode:    "#b5cea8",
      ModuleNode:   "#808080"
    };

    // Group by type
    const groups = new Map<string, GraphNode[]>();
    for (const node of nodes) {
      const list = groups.get(node.type) ?? [];
      list.push(node);
      groups.set(node.type, list);
    }

    const ORDER = ["RouteNode", "ViewNode", "ResourceNode", "ActionNode", "CellNode", "DerivedNode", "EffectNode", "AssetNode", "ModuleNode"];
    const sortedGroups = [...groups.entries()].sort(
      ([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b)
    );

    const html = sortedGroups.map(([type, groupNodes]) => {
      const color = TYPE_COLORS[type] ?? "#d4d4d4";
      const items = groupNodes.map((node) => {
        const meta = node.meta ? JSON.stringify(node.meta, null, 2) : "";
        const title = meta ? ` title="${meta.replace(/"/g, "&quot;")}"` : "";
        return `<div style="padding: 3px 6px; border-left: 2px solid ${color}; margin-bottom: 2px;"${title}>
          <span style="color: #d4d4d4;">${node.label}</span>
          <span style="color: #555; font-size: 10px; margin-left: 6px;">${node.id}</span>
        </div>`;
      }).join("");
      return `<div style="margin-bottom: 8px;">
        <div style="color: ${color}; font-weight: bold; margin-bottom: 3px; font-size: 11px;">${type} (${groupNodes.length})</div>
        ${items}
      </div>`;
    }).join("");

    nodesList.innerHTML = html;
  }

  private renderTopologyView(): void {
    const container = this.panelElement?.querySelector("#__helix_topology_list__");
    if (!container) return;

    const { nodes, edges } = runtimeGraph.toJSON();
    if (nodes.length === 0) {
      container.innerHTML = "<div style=\"color: #888;\">No reactive nodes registered</div>";
      return;
    }

    // Build lookup maps
    const nodeMap = new Map<string, GraphNode>(nodes.map((n) => [n.id, n]));
    const ownedBy = new Map<string, string[]>(); // owner id → owned node ids
    const depsOf = new Map<string, string[]>();   // node id → dependency node ids

    for (const edge of edges as GraphEdge[]) {
      if (edge.type === "owns") {
        const list = ownedBy.get(edge.from) ?? [];
        list.push(edge.to);
        ownedBy.set(edge.from, list);
      } else if (edge.type === "dependsOn") {
        const list = depsOf.get(edge.from) ?? [];
        list.push(edge.to);
        depsOf.set(edge.from, list);
      }
    }

    // Identify scope roots (nodes with meta.kind === "reactive-scope")
    const scopeNodes = nodes.filter(
      (n) => n.meta?.["kind"] === "reactive-scope",
    );
    const ownedIds = new Set<string>(
      [...ownedBy.values()].flat(),
    );
    // Nodes not owned by any scope
    const orphanNodes = nodes.filter(
      (n) => !ownedIds.has(n.id) && n.meta?.["kind"] !== "reactive-scope",
    );

    const TYPE_COLORS: Record<string, string> = {
      CellNode:    "#9cdcfe",
      DerivedNode: "#4fc1ff",
      EffectNode:  "#ce9178",
    };

    const renderNode = (node: GraphNode): string => {
      const color = TYPE_COLORS[node.type] ?? "#d4d4d4";
      const deps = (depsOf.get(node.id) ?? [])
        .map((depId) => nodeMap.get(depId))
        .filter(Boolean) as GraphNode[];

      const depsHtml = deps.length > 0
        ? `<div style="padding-left: 12px; color: #888; margin-top: 2px;">
            deps: ${deps.map((d) => `<span style="color: ${TYPE_COLORS[d.type] ?? "#aaa"};">${d.label}</span>`).join(", ")}
           </div>`
        : "";

      const kindBadge = node.meta?.["kind"]
        ? `<span style="color: #555; font-size: 9px; text-transform: uppercase; margin-left: 4px;">[${node.meta["kind"]}]</span>`
        : "";

      return `<div style="padding: 3px 6px; border-left: 2px solid ${color}; margin-bottom: 3px;">
        <span style="color: ${color};">${node.type.replace("Node", "")}</span>
        <span style="color: #d4d4d4; margin-left: 4px;">${node.label}</span>
        ${kindBadge}
        ${depsHtml}
      </div>`;
    };

    const scopeHtml = scopeNodes.map((scope) => {
      const owned = (ownedBy.get(scope.id) ?? [])
        .map((id) => nodeMap.get(id))
        .filter(Boolean) as GraphNode[];

      const childrenHtml = owned.length > 0
        ? owned.map((n) => `<div style="padding-left: 12px;">${renderNode(n)}</div>`).join("")
        : "<div style=\"padding-left: 12px; color: #555; font-size: 10px;\">empty</div>";

      const scopeColor = "#c586c0";
      return `<div style="margin-bottom: 10px; border: 1px solid #333; border-radius: 4px; padding: 6px;">
        <div style="color: ${scopeColor}; font-weight: bold; margin-bottom: 4px;">
          &#x25BC; Scope: <span style="color: #d4d4d4;">${scope.label}</span>
          <span style="color: #555; font-size: 10px; margin-left: 4px;">${scope.id}</span>
        </div>
        ${childrenHtml}
      </div>`;
    }).join("");

    const orphanHtml = orphanNodes.length > 0
      ? `<div style="margin-bottom: 6px; color: #888; font-size: 10px; text-transform: uppercase;">Unowned nodes</div>`
        + orphanNodes.map((n) => renderNode(n)).join("")
      : "";

    container.innerHTML = (scopeHtml + orphanHtml) || "<div style=\"color: #888;\">No scope topology to display</div>";
  }

  private renderTracesView(): void {
    const tracesList = this.panelElement?.querySelector("#__helix_traces_list__");
    if (!tracesList) return;

    const traces = this.scheduler?.getTraces() ?? [];
    const html = traces
      .slice(-this.config.maxTraceEntries)
      .reverse()
      .map(
        (trace: CausalTraceEntry) =>
          `<div style="margin-bottom: 6px; padding: 4px; background: #2d2d30; border-left: 2px solid #007acc; border-radius: 2px;">
            <div style="color: #4ec9b0; font-weight: bold;">${trace.trigger}</div>
            <div style="color: #ce9178; margin-top: 2px;">Lane: <span style="color: #9cdcfe;">${trace.lane}</span></div>
            <div style="color: #ce9178;">Patches: <span style="color: #9cdcfe;">${trace.patches}</span></div>
            <div style="color: #ce9178;">Duration: <span style="color: #9cdcfe;">${trace.durationMs.toFixed(2)}ms</span></div>
          </div>`
      )
      .join("");

    tracesList.innerHTML = html || "<div style=\"color: #888;\">No traces recorded</div>";
  }

  private clearTraces(): void {
    const tracesList = this.panelElement?.querySelector("#__helix_traces_list__");
    if (tracesList) {
      tracesList.innerHTML = "<div style=\"color: #888;\">Traces cleared</div>";
    }
  }

  open(): void {
    if (this.panelElement) {
      this.panelElement.style.display = "flex";
      this.isOpen = true;
      this.switchTab("traces");
    }
  }

  close(): void {
    if (this.panelElement) {
      this.panelElement.style.display = "none";
      this.isOpen = false;
    }
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

// Global devtools instance
let globalDevtools: HelixDevtools | null = null;

export function initializeDevtools(config?: DevtoolsConfig): HelixDevtools {
  if (!globalDevtools) {
    globalDevtools = new HelixDevtools(config);
    globalDevtools.mount();
    (window as any).__HELIX_DEVTOOLS__ = globalDevtools;
  }
  return globalDevtools;
}

export function getDevtools(): HelixDevtools | null {
  return globalDevtools;
}
