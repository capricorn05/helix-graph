import { escapeHtml } from "./html.js";

export type HtmlAttributeValue = string | number | boolean | null | undefined;
export type HtmlAttributes = Record<string, HtmlAttributeValue>;

function renderAttributes(attrs: HtmlAttributes): string {
  return Object.entries(attrs)
    .flatMap(([name, value]) => {
      if (value === null || value === undefined || value === false) {
        return [];
      }

      if (value === true) {
        return [name];
      }

      return [`${name}="${escapeHtml(String(value))}"`];
    })
    .map((attr) => ` ${attr}`)
    .join("");
}

function joinClassNames(...parts: Array<string | undefined>): string {
  return parts.filter((part) => part && part.trim().length > 0).join(" ");
}

export interface UIButtonOptions {
  label?: string;
  contentHtml?: string;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  type?: "button" | "submit" | "reset";
  id?: string;
  bind?: string;
  disabled?: boolean;
  className?: string;
  attrs?: HtmlAttributes;
}

export function uiButton(options: UIButtonOptions): string {
  const variant = options.variant ?? "primary";
  const attrs: HtmlAttributes = {
    type: options.type ?? "button",
    id: options.id,
    "data-hx-bind": options.bind,
    disabled: options.disabled ?? false,
    class: joinClassNames("hx-btn", variant === "primary" ? undefined : `hx-btn--${variant}`, options.className),
    ...(options.attrs ?? {})
  };

  const content = options.contentHtml ?? escapeHtml(options.label ?? "");
  return `<button${renderAttributes(attrs)}>${content}</button>`;
}

export interface UICardOptions {
  title?: string;
  description?: string;
  content: string;
  footer?: string;
  as?: "section" | "article" | "div";
  className?: string;
  attrs?: HtmlAttributes;
}

export function uiCard(options: UICardOptions): string {
  const tag = options.as ?? "section";
  const attrs: HtmlAttributes = {
    class: joinClassNames("hx-card", options.className),
    ...(options.attrs ?? {})
  };

  const headerParts: string[] = [];
  if (options.title) {
    headerParts.push(`<h3 class="hx-card__title">${escapeHtml(options.title)}</h3>`);
  }

  if (options.description) {
    headerParts.push(`<p class="hx-card__description">${escapeHtml(options.description)}</p>`);
  }

  const headerHtml = headerParts.length > 0
    ? `<header class="hx-card__header">${headerParts.join("")}</header>`
    : "";

  const footerHtml = options.footer
    ? `<footer class="hx-card__footer">${options.footer}</footer>`
    : "";

  return `<${tag}${renderAttributes(attrs)}>${headerHtml}<div class="hx-card__content">${options.content}</div>${footerHtml}</${tag}>`;
}

export interface UIInputOptions {
  name: string;
  type?: "text" | "email" | "password" | "number" | "search" | "url" | "checkbox";
  id?: string;
  value?: string;
  placeholder?: string;
  checked?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  attrs?: HtmlAttributes;
}

export function uiInput(options: UIInputOptions): string {
  const attrs: HtmlAttributes = {
    name: options.name,
    type: options.type ?? "text",
    id: options.id,
    value: options.value,
    placeholder: options.placeholder,
    checked: options.checked ?? false,
    required: options.required ?? false,
    disabled: options.disabled ?? false,
    class: joinClassNames("hx-input", options.className),
    ...(options.attrs ?? {})
  };

  return `<input${renderAttributes(attrs)} />`;
}

export interface UISelectOption {
  value: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
}

export interface UISelectOptions {
  name: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  options: UISelectOption[];
  attrs?: HtmlAttributes;
}

export function uiSelect(options: UISelectOptions): string {
  const attrs: HtmlAttributes = {
    name: options.name,
    id: options.id,
    required: options.required ?? false,
    disabled: options.disabled ?? false,
    class: joinClassNames("hx-input", options.className),
    ...(options.attrs ?? {})
  };

  const optionsHtml = options.options
    .map((option) => {
      const optionAttrs: HtmlAttributes = {
        value: option.value,
        selected: option.selected ?? false,
        disabled: option.disabled ?? false
      };

      return `<option${renderAttributes(optionAttrs)}>${escapeHtml(option.label)}</option>`;
    })
    .join("");

  return `<select${renderAttributes(attrs)}>${optionsHtml}</select>`;
}

export interface UITableOptions {
  headers?: string[];
  headersHtml?: string[];
  headerCellAttrs?: HtmlAttributes[];
  rows?: string[][];
  rowsHtml?: string[][];
  rowAttrs?: HtmlAttributes[];
  cellAttrs?: HtmlAttributes[][];
  headAttrs?: HtmlAttributes;
  bodyAttrs?: HtmlAttributes;
  className?: string;
  attrs?: HtmlAttributes;
}

export function uiTable(options: UITableOptions): string {
  const attrs: HtmlAttributes = {
    class: joinClassNames("hx-table", options.className),
    ...(options.attrs ?? {})
  };

  const headersHtml = (options.headersHtml ?? options.headers?.map((header) => escapeHtml(header)) ?? [])
    .map((header, headerIndex) => {
      const headerAttrs = options.headerCellAttrs?.[headerIndex] ?? {};
      return `<th${renderAttributes(headerAttrs)}>${header}</th>`;
    })
    .join("");

  const rowsHtml = (options.rowsHtml ?? options.rows?.map((row) => row.map((cell) => escapeHtml(cell))) ?? [])
    .map((row, rowIndex) => {
      const rowAttrs = options.rowAttrs?.[rowIndex] ?? {};
      const cellsHtml = row
        .map((cell, cellIndex) => {
          const cellAttrs = options.cellAttrs?.[rowIndex]?.[cellIndex] ?? {};
          return `<td${renderAttributes(cellAttrs)}>${cell}</td>`;
        })
        .join("");

      return `<tr${renderAttributes(rowAttrs)}>${cellsHtml}</tr>`;
    })
    .join("");

  const headAttrs = options.headAttrs ?? {};
  const bodyAttrs = options.bodyAttrs ?? {};
  return `<table${renderAttributes(attrs)}><thead${renderAttributes(headAttrs)}><tr>${headersHtml}</tr></thead><tbody${renderAttributes(bodyAttrs)}>${rowsHtml}</tbody></table>`;
}
