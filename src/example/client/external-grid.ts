import { PatchRuntime } from "../../helix/patch.js";
import {
  cell,
  derived,
  type Cell,
  type Derived,
} from "../../helix/reactive.js";
import { HelixScheduler } from "../../helix/scheduler.js";
import type { Lane, PatchOp } from "../../helix/types.js";

type GridColumn =
  | "id"
  | "title"
  | "brand"
  | "category"
  | "price"
  | "stock"
  | "rating";

type SortDirection = "asc" | "desc";
type GridFilters = Partial<Record<GridColumn, string>>;
type GridColumnValueType = "string" | "number";
type GridFilterControl = HTMLInputElement | HTMLSelectElement;

interface GridRow {
  rowKey: string;
  id: number;
  title: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
}

interface GridState {
  root: HTMLElement;
  body: HTMLTableSectionElement;
  rows: GridRow[];
  rowElements: Map<string, HTMLTableRowElement>;
  filters: GridFilters;
  viewStateCell: Cell<GridViewState>;
  viewDerived: GridDerivedState;
  patchRuntime: PatchRuntime;
  scheduler: HelixScheduler;
}

interface GridViewState {
  rowCount: number;
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  sortColumn: GridColumn | null;
  sortDirection: SortDirection;
}

interface GridDerivedState {
  pageLabel: Derived<string>;
  totalLabel: Derived<string>;
  prevDisabled: Derived<boolean>;
  nextDisabled: Derived<boolean>;
}

interface ExternalProductsApiRow {
  id: number;
  title: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
}

interface ExternalProductsApiResponse {
  rows: ExternalProductsApiRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortCol: string;
  sortDir: SortDirection;
  filters: Partial<Record<GridColumn, string>>;
}

const ROOT_SELECTOR = '[data-hx-id="external-grid-root"]';
const BODY_SELECTOR = '[data-hx-id="external-grid-body"]';
const STATUS_SELECTOR = '[data-hx-id="external-grid-status"]';
const PAGE_STATE_SELECTOR = '[data-hx-id="external-grid-page-state"]';
const FILTER_SELECTOR = "[data-hx-column-filter]";

const GRID_COLUMNS: GridColumn[] = [
  "id",
  "title",
  "brand",
  "category",
  "price",
  "stock",
  "rating",
];

const GRID_COLUMN_LABELS: Record<GridColumn, string> = {
  id: "ID",
  title: "Title",
  brand: "Brand",
  category: "Category",
  price: "Price",
  stock: "Stock",
  rating: "Rating",
};

const GRID_COLUMN_TYPES: Record<GridColumn, GridColumnValueType> = {
  id: "number",
  title: "string",
  brand: "string",
  category: "string",
  price: "number",
  stock: "number",
  rating: "number",
};

let currentGridState: GridState | null = null;
let pendingFilterNavigation: ReturnType<typeof setTimeout> | null = null;

function asGridColumn(value: string | undefined): GridColumn | null {
  if (!value) {
    return null;
  }

  if ((GRID_COLUMNS as string[]).includes(value)) {
    return value as GridColumn;
  }

  return null;
}

function parseNumericValue(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function collectRowElements(
  body: HTMLTableSectionElement,
): Map<string, HTMLTableRowElement> {
  const rowElements = new Map<string, HTMLTableRowElement>();

  for (const rowElement of body.querySelectorAll<HTMLTableRowElement>(
    "tr[data-grid-row]",
  )) {
    const rowKey = rowElement.dataset.gridRow;
    if (rowKey) {
      rowElements.set(rowKey, rowElement);
    }
  }

  return rowElements;
}

function normalizeCellText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatCellValue(row: GridRow, column: GridColumn): string {
  switch (column) {
    case "id":
      return String(row.id);
    case "title":
      return row.title;
    case "brand":
      return row.brand;
    case "category":
      return row.category;
    case "price":
      return row.price.toFixed(2);
    case "stock":
      return String(row.stock);
    case "rating":
      return row.rating.toFixed(1);
  }
}

function getCellText(
  rowElement: HTMLTableRowElement,
  column: GridColumn,
): string {
  const cell = rowElement.querySelector(`td[data-grid-col="${column}"]`);
  if (!(cell instanceof HTMLTableCellElement)) {
    return "";
  }

  return normalizeCellText(cell.textContent ?? "");
}

function parseRowsFromDom(body: HTMLTableSectionElement): GridRow[] {
  const rows: GridRow[] = [];
  const rowElements = Array.from(
    body.querySelectorAll<HTMLTableRowElement>("tr[data-grid-row]"),
  );

  for (const [index, rowElement] of rowElements.entries()) {
    const rowKey =
      rowElement.dataset.gridRow ?? `external-grid-row-${index + 1}`;

    const id = parseNumericValue(getCellText(rowElement, "id")) ?? index + 1;
    const price = parseNumericValue(getCellText(rowElement, "price")) ?? 0;
    const stock = parseNumericValue(getCellText(rowElement, "stock")) ?? 0;
    const rating = parseNumericValue(getCellText(rowElement, "rating")) ?? 0;

    rows.push({
      rowKey,
      id: Math.max(1, Math.floor(id)),
      title: getCellText(rowElement, "title"),
      brand: getCellText(rowElement, "brand"),
      category: getCellText(rowElement, "category"),
      price: Math.max(0, Number(price.toFixed(2))),
      stock: Math.max(0, Math.floor(stock)),
      rating: Math.max(0, Math.min(5, Number(rating.toFixed(1)))),
    });
  }

  return rows;
}

function readFilters(root: HTMLElement): GridFilters {
  const filters: GridFilters = {};

  for (const control of root.querySelectorAll(FILTER_SELECTOR)) {
    if (
      !(
        control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement
      )
    ) {
      continue;
    }

    const column = asGridColumn(control.dataset.hxColumnFilter);
    if (!column) {
      continue;
    }

    filters[column] = control.value;
  }

  return filters;
}

function ensureRowCell(
  rowElement: HTMLTableRowElement,
  column: GridColumn,
): HTMLTableCellElement {
  const existingCell = rowElement.querySelector(
    `td[data-grid-col="${column}"]`,
  );
  if (existingCell instanceof HTMLTableCellElement) {
    return existingCell;
  }

  const nextCell = document.createElement("td");
  nextCell.setAttribute("data-grid-col", column);
  rowElement.appendChild(nextCell);
  return nextCell;
}

function syncRowElement(rowElement: HTMLTableRowElement, row: GridRow): void {
  rowElement.setAttribute("data-grid-row", row.rowKey);
  rowElement.setAttribute("data-hx-key", row.rowKey);

  for (const column of GRID_COLUMNS) {
    const cell = ensureRowCell(rowElement, column);
    cell.textContent = formatCellValue(row, column);
  }
}

function createRowElement(
  row: GridRow,
  templateRow: HTMLTableRowElement | null,
): HTMLTableRowElement {
  const rowElement = templateRow
    ? (templateRow.cloneNode(true) as HTMLTableRowElement)
    : document.createElement("tr");

  if (!templateRow) {
    for (const column of GRID_COLUMNS) {
      const cell = document.createElement("td");
      cell.setAttribute("data-grid-col", column);
      cell.setAttribute("contenteditable", "true");
      cell.setAttribute("spellcheck", "false");
      rowElement.appendChild(cell);
    }
  }

  syncRowElement(rowElement, row);
  return rowElement;
}

function renderRows(state: GridState): void {
  const templateRow = state.rowElements.values().next().value ?? null;
  const orderedRows = state.rows.map((row) => {
    const existingRow = state.rowElements.get(row.rowKey);
    if (existingRow) {
      syncRowElement(existingRow, row);
      return existingRow;
    }

    const nextRow = createRowElement(row, templateRow);
    state.rowElements.set(row.rowKey, nextRow);
    return nextRow;
  });

  state.body.replaceChildren(...orderedRows);
}

function setStatus(state: GridState, message: string): void {
  const statusElement = state.root.querySelector(STATUS_SELECTOR);
  if (!(statusElement instanceof HTMLElement)) {
    return;
  }

  statusElement.textContent = message;
}

function updateSortIndicators(state: GridState): void {
  const viewState = state.viewStateCell.get();

  for (const indicator of state.root.querySelectorAll<HTMLElement>(
    "[data-grid-sort-indicator]",
  )) {
    const column = asGridColumn(indicator.dataset.gridSortIndicator);
    if (!column) {
      continue;
    }

    const isActive = viewState.sortColumn === column;
    const arrow =
      isActive && viewState.sortDirection === "asc"
        ? "▲"
        : isActive && viewState.sortDirection === "desc"
          ? "▼"
          : "↕";

    indicator.textContent = arrow;

    const button = indicator.closest(".grid-sort-btn");
    if (button instanceof HTMLElement) {
      button.classList.toggle("is-active", isActive);
      button.setAttribute(
        "aria-label",
        isActive
          ? `Sort by ${GRID_COLUMN_LABELS[column]} (${viewState.sortDirection})`
          : `Sort by ${GRID_COLUMN_LABELS[column]}`,
      );
    }
  }
}

function makeInitialGridViewState(
  root: HTMLElement,
  rowCount: number,
): GridViewState {
  const element = root.querySelector(PAGE_STATE_SELECTOR);
  const pageStateElement =
    element instanceof HTMLElement ? element : null;

  const page = Number(pageStateElement?.dataset.page);
  const pageSize = Number(pageStateElement?.dataset.pageSize);
  const totalRows = Number(pageStateElement?.dataset.total);
  const totalPages = Number(pageStateElement?.dataset.totalPages);
  const sortColumn = asGridColumn(pageStateElement?.dataset.sortCol);
  const sortDirection: SortDirection =
    pageStateElement?.dataset.sortDir === "desc" ? "desc" : "asc";

  return {
    rowCount: Math.max(0, Math.floor(rowCount)),
    page: Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1,
    pageSize: Number.isFinite(pageSize)
      ? Math.max(1, Math.floor(pageSize))
      : Math.max(1, Math.floor(rowCount) || 1),
    totalRows: Number.isFinite(totalRows)
      ? Math.max(0, Math.floor(totalRows))
      : Math.max(0, Math.floor(rowCount)),
    totalPages: Number.isFinite(totalPages)
      ? Math.max(1, Math.floor(totalPages))
      : 1,
    sortColumn,
    sortDirection,
  };
}

function makeGridDerivedState(
  viewStateCell: Cell<GridViewState>,
): GridDerivedState {
  return {
    pageLabel: derived(
      () => {
        const viewState = viewStateCell.get();
        return `Page ${viewState.page} / ${viewState.totalPages}`;
      },
      { scope: "view", name: "external-grid-page-label" },
    ),
    totalLabel: derived(
      () => {
        const viewState = viewStateCell.get();
        return `(${viewState.totalRows} total)`;
      },
      { scope: "view", name: "external-grid-total-label" },
    ),
    prevDisabled: derived(
      () => viewStateCell.get().page <= 1,
      { scope: "view", name: "external-grid-prev-disabled" },
    ),
    nextDisabled: derived(
      () => {
        const viewState = viewStateCell.get();
        return viewState.page >= viewState.totalPages;
      },
      { scope: "view", name: "external-grid-next-disabled" },
    ),
  };
}

function scheduleGridPatchBatch(
  state: GridState,
  trigger: string,
  lane: Lane,
  patches: PatchOp[],
): void {
  state.scheduler.schedule({
    trigger,
    lane,
    patches,
    nodes: Array.from(new Set(patches.map((patch) => patch.targetId))),
    run: (batch) => state.patchRuntime.applyBatch(batch),
  });
}

function hasGridPatchTarget(state: GridState, targetId: string): boolean {
  return state.root.querySelector(`[data-hx-id="${targetId}"]`) instanceof Element;
}

function scheduleGridReactivePatches(
  state: GridState,
  trigger: string,
  patches: PatchOp[],
): void {
  const presentPatches = patches.filter((patch) =>
    hasGridPatchTarget(state, patch.targetId),
  );
  if (presentPatches.length === 0) {
    return;
  }

  scheduleGridPatchBatch(state, trigger, "input", presentPatches);
}

function installGridViewReactivity(state: GridState): void {
  state.viewStateCell.subscribe((viewState) => {
    scheduleGridReactivePatches(state, "external-grid:view-state", [
      {
        op: "setText",
        targetId: "external-grid-row-count",
        value: String(viewState.rowCount),
      },
      {
        op: "setText",
        targetId: "external-grid-summary-page",
        value: String(viewState.page),
      },
      {
        op: "setText",
        targetId: "external-grid-summary-total",
        value: String(viewState.totalRows),
      },
      {
        op: "setAttr",
        targetId: "external-grid-page-state",
        name: "data-page",
        value: String(viewState.page),
      },
      {
        op: "setAttr",
        targetId: "external-grid-page-state",
        name: "data-page-size",
        value: String(viewState.pageSize),
      },
      {
        op: "setAttr",
        targetId: "external-grid-page-state",
        name: "data-total",
        value: String(viewState.totalRows),
      },
      {
        op: "setAttr",
        targetId: "external-grid-page-state",
        name: "data-total-pages",
        value: String(viewState.totalPages),
      },
      {
        op: "setAttr",
        targetId: "external-grid-page-state",
        name: "data-sort-col",
        value: viewState.sortColumn ?? "",
      },
      {
        op: "setAttr",
        targetId: "external-grid-page-state",
        name: "data-sort-dir",
        value: viewState.sortDirection,
      },
    ]);
  });

  state.viewDerived.pageLabel.subscribe((value) => {
    scheduleGridReactivePatches(state, "external-grid:page-label", [
      { op: "setText", targetId: "external-grid-page-label", value },
    ]);
  });

  state.viewDerived.totalLabel.subscribe((value) => {
    scheduleGridReactivePatches(state, "external-grid:total-label", [
      { op: "setText", targetId: "external-grid-total-label", value },
    ]);
  });

  state.viewDerived.prevDisabled.subscribe((disabled) => {
    scheduleGridReactivePatches(state, "external-grid:prev-disabled", [
      {
        op: "setAttr",
        targetId: "external-grid-prev",
        name: "disabled",
        value: disabled ? "disabled" : null,
      },
    ]);
  });

  state.viewDerived.nextDisabled.subscribe((disabled) => {
    scheduleGridReactivePatches(state, "external-grid:next-disabled", [
      {
        op: "setAttr",
        targetId: "external-grid-next",
        name: "disabled",
        value: disabled ? "disabled" : null,
      },
    ]);
  });
}

function ensureGridState(): GridState | null {
  const root = document.querySelector(ROOT_SELECTOR);
  if (!(root instanceof HTMLElement)) {
    currentGridState = null;
    return null;
  }

  const body = root.querySelector(BODY_SELECTOR);
  if (!(body instanceof HTMLTableSectionElement)) {
    currentGridState = null;
    return null;
  }

  if (currentGridState && currentGridState.root === root) {
    return currentGridState;
  }

  const rows = parseRowsFromDom(body);
  const viewStateCell = cell(makeInitialGridViewState(root, rows.length), {
    scope: "view",
    name: "external-grid-view-state",
    clientOnly: true,
    serializable: false,
  });

  currentGridState = {
    root,
    body,
    rows,
    rowElements: collectRowElements(body),
    filters: readFilters(root),
    viewStateCell,
    viewDerived: makeGridDerivedState(viewStateCell),
    patchRuntime: new PatchRuntime(root),
    scheduler: new HelixScheduler(),
  };

  installGridViewReactivity(currentGridState);
  updateSortIndicators(currentGridState);
  return currentGridState;
}

function updateGridViewState(
  state: GridState,
  productsPage: ExternalProductsApiResponse,
): void {
  state.viewStateCell.set({
    rowCount: productsPage.rows.length,
    page: productsPage.page,
    pageSize: productsPage.pageSize,
    totalRows: productsPage.total,
    totalPages: productsPage.totalPages,
    sortColumn: asGridColumn(productsPage.sortCol),
    sortDirection: productsPage.sortDir === "desc" ? "desc" : "asc",
  });
}

function applyFiltersToControls(
  state: GridState,
  filters: Partial<Record<GridColumn, string>>,
): void {
  for (const control of state.root.querySelectorAll(FILTER_SELECTOR)) {
    if (
      !(
        control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement
      )
    ) {
      continue;
    }

    const column = asGridColumn(control.dataset.hxColumnFilter);
    if (!column) {
      continue;
    }

    const nextValue = filters[column] ?? "";
    if (control.value !== nextValue) {
      control.value = nextValue;
    }
  }
}

function toGridRows(rows: ExternalProductsApiRow[]): GridRow[] {
  return rows.map((row) => ({
    rowKey: `external-grid-row-${row.id}`,
    id: row.id,
    title: row.title,
    brand: row.brand,
    category: row.category,
    price: row.price,
    stock: row.stock,
    rating: row.rating,
  }));
}

function applyExternalProductsPage(
  state: GridState,
  productsPage: ExternalProductsApiResponse,
): void {
  state.rows = toGridRows(productsPage.rows);
  state.filters = { ...productsPage.filters };
  updateGridViewState(state, productsPage);

  renderRows(state);
  updateSortIndicators(state);
  applyFiltersToControls(state, productsPage.filters);
}

function buildHistoryUrl(productsPage: ExternalProductsApiResponse): string {
  const url = new URL(window.location.href);
  url.pathname = "/external-grid";
  url.searchParams.set("page", String(productsPage.page));
  url.searchParams.set("sortCol", productsPage.sortCol);
  url.searchParams.set("sortDir", productsPage.sortDir);

  for (const column of GRID_COLUMNS) {
    url.searchParams.delete(column);
    const filterValue = productsPage.filters[column]?.trim();
    if (filterValue) {
      url.searchParams.set(column, filterValue);
    }
  }

  return `${url.pathname}${url.search}`;
}

function clearPendingFilterNavigation(): void {
  if (pendingFilterNavigation !== null) {
    clearTimeout(pendingFilterNavigation);
    pendingFilterNavigation = null;
  }
}

async function navigateGridUrl(url: URL): Promise<void> {
  clearPendingFilterNavigation();

  const state = ensureGridState();
  if (!state) {
    window.location.assign(url.toString());
    return;
  }

  state.root.setAttribute("aria-busy", "true");
  try {
    const apiUrl = new URL("/api/external-data", window.location.origin);
    apiUrl.search = url.search;
    const response = await fetch(apiUrl.toString());

    if (!response.ok) {
      throw new Error(
        `External grid fetch failed with status ${response.status}`,
      );
    }

    const productsPage = (await response.json()) as ExternalProductsApiResponse;
    applyExternalProductsPage(state, productsPage);
    window.history.replaceState({}, "", buildHistoryUrl(productsPage));
  } catch {
    window.location.assign(url.toString());
  } finally {
    state.root.removeAttribute("aria-busy");
  }
}

async function navigateGridPage(nextPage: number): Promise<void> {
  const url = new URL(window.location.href);
  url.pathname = "/external-grid";
  url.searchParams.set("page", String(nextPage));
  await navigateGridUrl(url);
}

function buildGridUrl(): URL {
  const url = new URL(window.location.href);
  url.pathname = "/external-grid";
  return url;
}

function getFilterQueryKey(control: GridFilterControl): string | null {
  const name = control.getAttribute("name")?.trim();
  if (name) {
    return name;
  }

  const column = control.dataset.hxColumnFilter?.trim();
  return column && column.length > 0 ? column : null;
}

function applyFilterControlToUrl(
  url: URL,
  control: GridFilterControl,
): boolean {
  const key = getFilterQueryKey(control);
  if (!key) {
    return false;
  }

  const value = control.value.trim();
  if (value.length === 0) {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("page", "1");
  return true;
}

function scheduleFilterNavigation(url: URL): void {
  clearPendingFilterNavigation();
  pendingFilterNavigation = setTimeout(() => {
    pendingFilterNavigation = null;
    void navigateGridUrl(url);
  }, 250);
}

function findEditableCell(
  target: EventTarget | null,
): HTMLTableCellElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const cell = target.closest('td[data-grid-col][contenteditable="true"]');
  return cell instanceof HTMLTableCellElement ? cell : null;
}

function findFilterControl(
  target: EventTarget | null,
): GridFilterControl | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const control = target.closest(FILTER_SELECTOR);
  if (
    control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement
  ) {
    return control;
  }

  return null;
}

function applyCellValue(
  row: GridRow,
  column: GridColumn,
  rawValue: string,
): boolean {
  switch (column) {
    case "id": {
      const parsed = parseNumericValue(rawValue);
      if (parsed === null) {
        return false;
      }

      row.id = Math.max(1, Math.floor(parsed));
      return true;
    }
    case "title":
      row.title = rawValue;
      return true;
    case "brand":
      row.brand = rawValue;
      return true;
    case "category":
      row.category = rawValue;
      return true;
    case "price": {
      const parsed = parseNumericValue(rawValue);
      if (parsed === null) {
        return false;
      }

      row.price = Math.max(0, Number(parsed.toFixed(2)));
      return true;
    }
    case "stock": {
      const parsed = parseNumericValue(rawValue);
      if (parsed === null) {
        return false;
      }

      row.stock = Math.max(0, Math.floor(parsed));
      return true;
    }
    case "rating": {
      const parsed = parseNumericValue(rawValue);
      if (parsed === null) {
        return false;
      }

      row.rating = Math.max(0, Math.min(5, Number(parsed.toFixed(1))));
      return true;
    }
  }
}

function commitCellEdit(state: GridState, cell: HTMLTableCellElement): void {
  const rowElement = cell.closest("tr[data-grid-row]");
  if (!(rowElement instanceof HTMLTableRowElement)) {
    return;
  }

  const rowKey = rowElement.dataset.gridRow;
  const column = asGridColumn(cell.dataset.gridCol);
  if (!rowKey || !column) {
    return;
  }

  const row = state.rows.find((candidate) => candidate.rowKey === rowKey);
  if (!row) {
    return;
  }

  const rawValue = normalizeCellText(cell.textContent ?? "");
  const applied = applyCellValue(row, column, rawValue);
  if (!applied) {
    cell.textContent = formatCellValue(row, column);
    setStatus(state, `${GRID_COLUMN_LABELS[column]} requires a numeric value.`);
    return;
  }

  cell.textContent = formatCellValue(row, column);

  setStatus(state, `Updated ${GRID_COLUMN_LABELS[column]} for row ${row.id}.`);
}

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const pageButton = event.target.closest("button[data-grid-page]");
  if (pageButton instanceof HTMLButtonElement) {
    const state = ensureGridState();
    if (!state || !state.root.contains(pageButton) || pageButton.disabled) {
      return;
    }

    const viewState = state.viewStateCell.get();

    const direction = pageButton.dataset.gridPage;
    if (direction !== "prev" && direction !== "next") {
      return;
    }

    const delta = direction === "prev" ? -1 : 1;
    const nextPage = Math.min(
      viewState.totalPages,
      Math.max(1, viewState.page + delta),
    );

    if (nextPage === viewState.page) {
      return;
    }

    setStatus(state, `Loading page ${nextPage}…`);
    void navigateGridPage(nextPage);
    return;
  }

  const sortButton = event.target.closest("[data-grid-sort]");
  if (!(sortButton instanceof HTMLElement)) {
    return;
  }

  const state = ensureGridState();
  if (!state || !state.root.contains(sortButton)) {
    return;
  }

  const column = asGridColumn(sortButton.dataset.gridSort);
  if (!column) {
    return;
  }

  const viewState = state.viewStateCell.get();
  const url = buildGridUrl();
  const nextDirection: SortDirection =
    viewState.sortColumn === column && viewState.sortDirection === "asc"
      ? "desc"
      : "asc";

  url.searchParams.set("sortCol", column);
  url.searchParams.set("sortDir", nextDirection);
  url.searchParams.set("page", "1");

  setStatus(
    state,
    `Sorting by ${GRID_COLUMN_LABELS[column]} (${nextDirection})…`,
  );
  void navigateGridUrl(url);
});

document.addEventListener("input", (event) => {
  const filterControl = findFilterControl(event.target);
  if (!(filterControl instanceof HTMLInputElement)) {
    return;
  }

  const state = ensureGridState();
  if (!state || !state.root.contains(filterControl)) {
    return;
  }

  const url = buildGridUrl();
  if (!applyFilterControlToUrl(url, filterControl)) {
    return;
  }

  setStatus(
    state,
    `Filtering ${GRID_COLUMN_LABELS[filterControl.dataset.hxColumnFilter as GridColumn] ?? "rows"}…`,
  );
  scheduleFilterNavigation(url);
});

document.addEventListener("change", (event) => {
  const filterControl = findFilterControl(event.target);
  if (!(filterControl instanceof HTMLSelectElement)) {
    return;
  }

  const state = ensureGridState();
  if (!state || !state.root.contains(filterControl)) {
    return;
  }

  const url = buildGridUrl();
  if (!applyFilterControlToUrl(url, filterControl)) {
    return;
  }

  setStatus(state, `Filtering rows…`);
  void navigateGridUrl(url);
});

document.addEventListener("focusout", (event) => {
  const cell = findEditableCell(event.target);
  if (!cell) {
    return;
  }

  const state = ensureGridState();
  if (!state || !state.root.contains(cell)) {
    return;
  }

  commitCellEdit(state, cell);
});

document.addEventListener("keydown", (event) => {
  const filterControl = findFilterControl(event.target);
  if (filterControl && event.key === "Enter") {
    const state = ensureGridState();
    if (!state || !state.root.contains(filterControl)) {
      return;
    }

    const url = buildGridUrl();
    if (!applyFilterControlToUrl(url, filterControl)) {
      return;
    }

    clearPendingFilterNavigation();
    event.preventDefault();
    setStatus(state, "Filtering rows…");
    void navigateGridUrl(url);
    return;
  }

  const cell = findEditableCell(event.target);
  if (!cell) {
    return;
  }

  const state = ensureGridState();
  if (!state || !state.root.contains(cell)) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    cell.blur();
  }
});

ensureGridState();
