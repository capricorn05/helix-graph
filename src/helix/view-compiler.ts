import { escapeHtml } from "./html.js";
import { runtimeGraph } from "./graph.js";
import type { BindingMap } from "./types.js";

export interface CompiledTextPatch<Props> {
  kind: "text";
  token: string;
  targetId: string;
  evaluate: (props: Props) => unknown;
}

export interface CompiledAttrPatch<Props> {
  kind: "attr";
  token: string;
  targetId: string;
  attrName: string;
  evaluate: (props: Props) => unknown;
}

export interface CompiledHtmlPatch<Props> {
  kind: "html";
  token: string;
  targetId: string;
  evaluate: (props: Props) => unknown;
}

export type CompiledViewPatch<Props> =
  | CompiledTextPatch<Props>
  | CompiledAttrPatch<Props>
  | CompiledHtmlPatch<Props>;

export interface CompiledViewArtifact<Props> {
  id?: string;
  label?: string;
  template: string;
  patches: readonly CompiledViewPatch<Props>[];
  bindingMap: BindingMap;
}

interface PreparedCompiledViewArtifact<Props> {
  tokenPattern: RegExp;
  patchByToken: Map<string, CompiledViewPatch<Props>>;
}

const preparedArtifactCache = new WeakMap<
  object,
  PreparedCompiledViewArtifact<unknown>
>();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeRenderedValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return "";
  }

  return String(value);
}

export function compiledViewId(fileBasename: string): string {
  return `view:compiled:${fileBasename}`;
}

export function defineCompiledViewArtifact<Props>(
  id: string,
  label: string,
  artifact: Omit<CompiledViewArtifact<Props>, "id" | "label">,
): CompiledViewArtifact<Props> {
  runtimeGraph.addNode({
    id,
    type: "ViewNode",
    label,
    meta: {
      compiled: true,
    },
  });

  return {
    id,
    label,
    ...artifact,
  };
}

export function serializeClientOnlyProps(value: unknown): string {
  if (value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    throw new Error(
      `clientOnly props must be JSON-serializable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function uncompiledView<T>(factory: () => T): T {
  return factory();
}

export function clientOnly<TProps = unknown>(
  _loader: () => Promise<unknown>,
  _props?: TProps,
): string {
  return "";
}

function prepareCompiledViewArtifact<Props>(
  artifact: CompiledViewArtifact<Props>,
): PreparedCompiledViewArtifact<Props> {
  if (artifact.patches.length === 0) {
    return {
      tokenPattern: /$^/g,
      patchByToken: new Map<string, CompiledViewPatch<Props>>(),
    };
  }

  const patchByToken = new Map<string, CompiledViewPatch<Props>>();
  for (const patch of artifact.patches) {
    if (patchByToken.has(patch.token)) {
      throw new Error(
        `Compiled view contains duplicate patch token "${patch.token}"`,
      );
    }

    if (!artifact.template.includes(patch.token)) {
      throw new Error(
        `Compiled view patch token "${patch.token}" is missing from template`,
      );
    }

    patchByToken.set(patch.token, patch);
  }

  const tokenPattern = new RegExp(
    Array.from(patchByToken.keys())
      .sort((a, b) => b.length - a.length)
      .map((token) => escapeRegExp(token))
      .join("|"),
    "g",
  );

  return {
    tokenPattern,
    patchByToken,
  };
}

export function renderCompiledView<Props>(
  artifact: CompiledViewArtifact<Props>,
  props: Props,
): string {
  if (artifact.patches.length === 0) {
    return artifact.template;
  }

  let prepared = preparedArtifactCache.get(artifact) as
    | PreparedCompiledViewArtifact<Props>
    | undefined;
  if (!prepared) {
    prepared = prepareCompiledViewArtifact(artifact);
    preparedArtifactCache.set(
      artifact,
      prepared as PreparedCompiledViewArtifact<unknown>,
    );
  }

  return artifact.template.replace(prepared.tokenPattern, (token) => {
    const patch = prepared.patchByToken.get(token);
    if (!patch) {
      return token;
    }

    const value = normalizeRenderedValue(patch.evaluate(props));
    const rendered = patch.kind === "html" ? value : escapeHtml(value);
    return rendered;
  });
}
