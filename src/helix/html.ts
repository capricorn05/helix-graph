import type { BindingMap, GraphSnapshot } from "./types.js";
import { bindingMapScript, snapshotScript } from "./ssr.js";

export interface HtmlDocumentStartOptions {
  title?: string;
  lang?: string;
  headContent?: string;
  bodyAttributes?: string;
}

export interface HelixDocumentEndOptions {
  snapshot: GraphSnapshot;
  bindingMap: BindingMap;
  bootstrapModuleSrc?: string;
  bodyEndContent?: string;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeAttributeSegment(attributes?: string): string {
  const trimmed = attributes?.trim();
  return trimmed ? ` ${trimmed}` : "";
}

export function renderHtmlDocumentStart(options: HtmlDocumentStartOptions = {}): string {
  const title = options.title ?? "Helix";
  const lang = options.lang ?? "en";
  const headContent = options.headContent ? `${options.headContent}\n` : "";
  const bodyAttributes = normalizeAttributeSegment(options.bodyAttributes);

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
${headContent}</head>
<body${bodyAttributes}>`;
}

export function renderHelixDocumentEnd(options: HelixDocumentEndOptions): string {
  const bootstrapModuleSrc = options.bootstrapModuleSrc ?? "/client/bootstrap.js";
  const bodyEndContent = options.bodyEndContent ? `${options.bodyEndContent}\n` : "";

  return `${snapshotScript(options.snapshot)}
${bindingMapScript(options.bindingMap)}
<script type="module" src="${escapeHtml(bootstrapModuleSrc)}"></script>
${bodyEndContent}</body></html>`;
}
