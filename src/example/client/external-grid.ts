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
  sortColumn: GridColumn | null;
  sortDirection: SortDirection;
}

interface GridPageState {
  page: number;
  totalPages: number;
  sortColumn: GridColumn | null;
  sortDirection: SortDirection;
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
  for (const indicator of state.root.querySelectorAll<HTMLElement>(
    "[data-grid-sort-indicator]",
  )) {
    const column = asGridColumn(indicator.dataset.gridSortIndicator);
    if (!column) {
      continue;
    }

    const isActive = state.sortColumn === column;
    const arrow =
      isActive && state.sortDirection === "asc"
        ? "▲"
        : isActive && state.sortDirection === "desc"
          ? "▼"
          : "↕";

    indicator.textContent = arrow;

    const button = indicator.closest(".grid-sort-btn");
    if (button instanceof HTMLElement) {
      button.classList.toggle("is-active", isActive);
      button.setAttribute(
        "aria-label",
        isActive
          ? `Sort by ${GRID_COLUMN_LABELS[column]} (${state.sortDirection})`
          : `Sort by ${GRID_COLUMN_LABELS[column]}`,
      );
    }
  }
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

  const pageState = parsePageState(root);

  currentGridState = {
    root,
    body,
    rows: parseRowsFromDom(body),
    rowElements: collectRowElements(body),
    filters: readFilters(root),
    sortColumn: pageState?.sortColumn ?? null,
    sortDirection: pageState?.sortDirection ?? "asc",
  };

  updateSortIndicators(currentGridState);
  return currentGridState;
}

function parsePageState(root: HTMLElement): GridPageState | null {
  const element = root.querySelector(PAGE_STATE_SELECTOR);
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const page = Number(element.dataset.page);
  const totalPages = Number(element.dataset.totalPages);
  const sortColumn = asGridColumn(element.dataset.sortCol);
  const sortDirection: SortDirection =
    element.dataset.sortDir === "desc" ? "desc" : "asc";

  if (!Number.isFinite(page) || !Number.isFinite(totalPages)) {
    return null;
  }

  return {
    page: Math.max(1, Math.floor(page)),
    totalPages: Math.max(1, Math.floor(totalPages)),
    sortColumn,
    sortDirection,
  };
}

function setTextByHxId(
  root: HTMLElement,
  targetId: string,
  value: string,
): void {
  const element = root.querySelector(`[data-hx-id="${targetId}"]`);
  if (element instanceof HTMLElement) {
    element.textContent = value;
  }
}

function updateGridMeta(
  state: GridState,
  productsPage: ExternalProductsApiResponse,
): void {
  const root = state.root;
  const pageStateElement = root.querySelector(PAGE_STATE_SELECTOR);
  if (pageStateElement instanceof HTMLElement) {
    pageStateElement.dataset.page = String(productsPage.page);
    pageStateElement.dataset.pageSize = String(productsPage.pageSize);
    pageStateElement.dataset.total = String(productsPage.total);
    pageStateElement.dataset.totalPages = String(productsPage.totalPages);
    pageStateElement.dataset.sortCol = productsPage.sortCol;
    pageStateElement.dataset.sortDir = productsPage.sortDir;
  }

  const prevButton = root.querySelector('[data-hx-id="external-grid-prev"]');
  if (prevButton instanceof HTMLButtonElement) {
    prevButton.disabled = productsPage.page <= 1;
  }

  const nextButton = root.querySelector('[data-hx-id="external-grid-next"]');
  if (nextButton instanceof HTMLButtonElement) {
    nextButton.disabled = productsPage.page >= productsPage.totalPages;
  }

  setTextByHxId(
    root,
    "external-grid-page-label",
    `Page ${productsPage.page} / ${productsPage.totalPages}`,
  );
  setTextByHxId(
    root,
    "external-grid-total-label",
    `(${productsPage.total} total)`,
  );
  setTextByHxId(
    root,
    "hx-external-grid-slot-1",
    String(productsPage.rows.length),
  );
  setTextByHxId(root, "hx-external-grid-slot-2", String(productsPage.page));
  setTextByHxId(root, "hx-external-grid-slot-3", String(productsPage.total));
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
  state.sortColumn = asGridColumn(productsPage.sortCol);
  state.sortDirection = productsPage.sortDir === "desc" ? "desc" : "asc";

  renderRows(state);
  updateSortIndicators(state);
  applyFiltersToControls(state, productsPage.filters);
  updateGridMeta(state, productsPage);
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

    const pageState = parsePageState(state.root);
    if (!pageState) {
      return;
    }

    const direction = pageButton.dataset.gridPage;
    if (direction !== "prev" && direction !== "next") {
      return;
    }

    const delta = direction === "prev" ? -1 : 1;
    const nextPage = Math.min(
      pageState.totalPages,
      Math.max(1, pageState.page + delta),
    );

    if (nextPage === pageState.page) {
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

  const url = buildGridUrl();
  const nextDirection: SortDirection =
    state.sortColumn === column && state.sortDirection === "asc"
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
