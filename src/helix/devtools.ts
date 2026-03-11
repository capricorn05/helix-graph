import type { CausalTraceEntry, GraphNode } from "./types.js";
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
        <div id="__helix_traces_view__">
          <h4 style="margin: 0 0 6px 0; color: #4ec9b0;">Causality Traces</h4>
          <div id="__helix_traces_list__" style="font-size: 11px; line-height: 1.4; max-height: 300px; overflow-y: auto;"></div>
        </div>
      </div>
      <div style="display: flex; gap: 4px; padding: 8px; border-top: 1px solid #333;">
        <button id="__helix_graph_tab__" style="flex: 1; padding: 4px; background: #333; color: #d4d4d4; border: 1px solid #555; border-radius: 3px; cursor: pointer;">Graph</button>
        <button id="__helix_traces_tab__" style="flex: 1; padding: 4px; background: #2d2d30; color: #d4d4d4; border: 1px solid #555; border-radius: 3px; cursor: pointer; font-weight: bold;">Traces</button>
        <button id="__helix_clear_btn__" style="flex: 1; padding: 4px; background: #333; color: #d4d4d4; border: 1px solid #555; border-radius: 3px; cursor: pointer;">Clear</button>
      </div>
    `;

    document.body.appendChild(panel);
    this.panelElement = panel;

    panel.querySelector("#__helix_devtools_close__")?.addEventListener("click", () => this.close());
    panel.querySelector("#__helix_graph_tab__")?.addEventListener("click", () => this.switchTab("graph"));
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

  private switchTab(tab: "graph" | "traces"): void {
    const graphView = this.panelElement?.querySelector("#__helix_graph_view__") as HTMLElement;
    const tracesView = this.panelElement?.querySelector("#__helix_traces_view__") as HTMLElement;
    const graphTab = this.panelElement?.querySelector("#__helix_graph_tab__") as HTMLElement;
    const tracesTab = this.panelElement?.querySelector("#__helix_traces_tab__") as HTMLElement;

    if (tab === "graph") {
      if (graphView) graphView.style.display = "block";
      if (tracesView) tracesView.style.display = "none";
      if (graphTab) graphTab.style.background = "#2d2d30";
      if (tracesTab) tracesTab.style.background = "#333";
      this.renderGraphView();
    } else {
      if (graphView) graphView.style.display = "none";
      if (tracesView) tracesView.style.display = "block";
      if (graphTab) graphTab.style.background = "#333";
      if (tracesTab) tracesTab.style.background = "#2d2d30";
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
