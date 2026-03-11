export type Scope = "app" | "route" | "view" | "session";

export type GraphNodeType =
  | "RouteNode"
  | "ViewNode"
  | "CellNode"
  | "DerivedNode"
  | "ResourceNode"
  | "ActionNode"
  | "EffectNode"
  | "AssetNode"
  | "ModuleNode";

export type GraphEdgeType =
  | "dependsOn"
  | "renders"
  | "invalidates"
  | "imports"
  | "activates"
  | "owns";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  meta?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: GraphEdgeType;
  meta?: Record<string, unknown>;
}

export interface CellOptions {
  scope?: Scope;
  serializable?: boolean;
  secure?: boolean;
  clientOnly?: boolean;
  name?: string;
}

export interface DerivedOptions {
  scope?: Scope;
  name?: string;
}

export interface ResourcePolicy {
  where: "server" | "edge" | "client" | "any";
  cache: "memory" | "disk" | "kv" | "none";
  staleMs?: number;
  revalidateMs?: number;
  maxEntries?: number;
  dedupe?: "inflight" | "none";
  tags?: string[] | ((ctx: unknown) => string[]);
}

export interface ActionPolicy<I = unknown> {
  where: "server" | "edge" | "client" | "any";
  invalidates?: string[] | ((ctx: unknown, input: I) => string[]);
  capabilities?: string[];
  idempotency?: string;
}

export interface GraphSnapshot {
  version: string;
  cells: Record<string, unknown>;
  resources: Record<string, unknown>;
  tags: Record<string, string[]>;
  createdAt: number;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
}

export interface HelixEventBinding {
  id: string;
  event: string;
  actionId: string;
  chunk: string;
  handlerExport: string;
  payload?: Record<string, unknown>;
  preventDefault?: boolean;
}

export interface HelixListBinding {
  listId: string;
  keyAttr: string;
}

export interface BindingMap {
  events: Record<string, HelixEventBinding>;
  lists: Record<string, HelixListBinding>;
}

export type Lane = "input" | "animation" | "viewport" | "network" | "idle";

export type SetTextPatch = {
  op: "setText";
  targetId: string;
  value: string;
};

export type SetAttrPatch = {
  op: "setAttr";
  targetId: string;
  name: string;
  value: string | null;
};

export type ToggleClassPatch = {
  op: "toggleClass";
  targetId: string;
  className: string;
  enabled: boolean;
};

export type SetValuePatch = {
  op: "setValue";
  targetId: string;
  value: string;
};

export type SetCheckedPatch = {
  op: "setChecked";
  targetId: string;
  value: boolean;
};

export type SetStylePatch = {
  op: "setStyle";
  targetId: string;
  prop: string;
  value: string;
};

export type PatchOp =
  | SetTextPatch
  | SetAttrPatch
  | ToggleClassPatch
  | SetValuePatch
  | SetCheckedPatch
  | SetStylePatch;

export interface CausalTraceEntry {
  trigger: string;
  lane: Lane;
  patches: number;
  durationMs: number;
  nodes: string[];
  at: number;
}

export interface FormActionError {
  fieldErrors: Record<string, string>;
  formError?: string;
}

export interface HelixView<Props> {
  id: string;
  render: (props: Props) => string;
}
