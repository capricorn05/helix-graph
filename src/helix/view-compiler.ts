import { escapeHtml } from "./html.js";
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
  template: string;
  patches: readonly CompiledViewPatch<Props>[];
  bindingMap: BindingMap;
}

function normalizeRenderedValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function renderCompiledView<Props>(
  artifact: CompiledViewArtifact<Props>,
  props: Props,
): string {
  let html = artifact.template;

  for (const patch of artifact.patches) {
    const value = normalizeRenderedValue(patch.evaluate(props));
    const rendered = patch.kind === "html" ? value : escapeHtml(value);
    html = html.split(patch.token).join(rendered);
  }

  return html;
}
