type GridColumn =
  | "id"
  | "title"
  | "brand"
  | "category"
  | "price"
  | "stock"
  | "rating";

type SortDirection = "asc" | "desc";

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
  sortColumn: GridColumn | null;
  sortDirection: SortDirection;
}

interface GridPageState {
  page: number;
  totalPages: number;
}

const ROOT_SELECTOR = '[data-hx-id="external-grid-root"]';
const BODY_SELECTOR = '[data-hx-id="external-grid-body"]';
const STATUS_SELECTOR = '[data-hx-id="external-grid-status"]';
const PAGE_STATE_SELECTOR = '[data-hx-id="external-grid-page-state"]';
const APP_CORE_SELECTOR = '[data-hx-id="app-core"]';
const APP_CORE_TITLE_SELECTOR = '[data-hx-id="app-core-title"]';

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

let currentGridState: GridState | null = null;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function getCellText(rowElement: HTMLTableRowElement, column: GridColumn): string {
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
    const rowKey = rowElement.dataset.gridRow ?? `external-grid-row-${index + 1}`;

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

function renderGridRow(row: GridRow): string {
  const cellsHtml = GRID_COLUMNS.map((column) => {
    const value = escapeHtml(formatCellValue(row, column));
    return `<td data-grid-col="${column}" contenteditable="true" spellcheck="false">${value}</td>`;
  }).join("");

  return `<tr data-grid-row="${escapeHtml(row.rowKey)}" data-hx-key="${escapeHtml(row.rowKey)}">${cellsHtml}</tr>`;
}

function renderRows(state: GridState): void {
  state.body.innerHTML = state.rows.map(renderGridRow).join("");
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

  currentGridState = {
    root,
    body,
    rows: parseRowsFromDom(body),
    sortColumn: null,
    sortDirection: "asc",
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

  if (!Number.isFinite(page) || !Number.isFinite(totalPages)) {
    return null;
  }

  return {
    page: Math.max(1, Math.floor(page)),
    totalPages: Math.max(1, Math.floor(totalPages)),
  };
}

function normalizeNavPath(pathname: string): string {
  if (pathname === "/users" || pathname.startsWith("/users/")) {
    return "/";
  }

  return pathname;
}

function updateActiveAdminNav(pathname: string): void {
  const normalizedPath = normalizeNavPath(pathname);

  for (const link of document.querySelectorAll("[data-nav-link]")) {
    if (!(link instanceof HTMLAnchorElement)) {
      continue;
    }

    const linkPath = link.dataset.navPath ?? "";
    const active = linkPath === normalizedPath;

    link.classList.toggle("is-active", active);
    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

async function navigateGridPage(nextPage: number): Promise<void> {
  const url = new URL(window.location.href);
  url.pathname = "/external-grid";
  url.searchParams.set("page", String(nextPage));

  const core = document.querySelector(APP_CORE_SELECTOR);
  const coreTitle = document.querySelector(APP_CORE_TITLE_SELECTOR);

  if (!(core instanceof HTMLElement)) {
    window.location.assign(url.toString());
    return;
  }

  core.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(
      `/components/app-core?path=${encodeURIComponent(`${url.pathname}${url.search}`)}`,
    );

    if (!response.ok) {
      throw new Error(`Core content fetch failed with status ${response.status}`);
    }

    core.innerHTML = await response.text();

    const title = response.headers.get("x-helix-title");
    if (title) {
      document.title = title;
      if (coreTitle instanceof HTMLElement) {
        coreTitle.textContent = title;
      }
    }

    window.history.replaceState({}, "", url.toString());
    updateActiveAdminNav(url.pathname);
  } catch {
    window.location.assign(url.toString());
  } finally {
    core.removeAttribute("aria-busy");
  }
}

function compareRows(left: GridRow, right: GridRow, column: GridColumn): number {
  switch (column) {
    case "id":
      return left.id - right.id;
    case "price":
      return left.price - right.price;
    case "stock":
      return left.stock - right.stock;
    case "rating":
      return left.rating - right.rating;
    case "title":
      return left.title.localeCompare(right.title, undefined, {
        sensitivity: "base",
        numeric: true,
      });
    case "brand":
      return left.brand.localeCompare(right.brand, undefined, {
        sensitivity: "base",
        numeric: true,
      });
    case "category":
      return left.category.localeCompare(right.category, undefined, {
        sensitivity: "base",
        numeric: true,
      });
  }
}

function sortRows(state: GridState, column: GridColumn): void {
  if (state.sortColumn === column) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.sortColumn = column;
    state.sortDirection = "asc";
  }

  const direction = state.sortDirection === "asc" ? 1 : -1;
  state.rows.sort((left, right) => compareRows(left, right, column) * direction);

  renderRows(state);
  updateSortIndicators(state);
  setStatus(
    state,
    `Sorted by ${GRID_COLUMN_LABELS[column]} (${state.sortDirection}).`,
  );
}

function findEditableCell(target: EventTarget | null): HTMLTableCellElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const cell = target.closest('td[data-grid-col][contenteditable="true"]');
  return cell instanceof HTMLTableCellElement ? cell : null;
}

function applyCellValue(row: GridRow, column: GridColumn, rawValue: string): boolean {
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

  if (state.sortColumn) {
    const activeColumn = state.sortColumn;
    const direction = state.sortDirection === "asc" ? 1 : -1;
    state.rows.sort(
      (left, right) => compareRows(left, right, activeColumn) * direction,
    );
    renderRows(state);
    updateSortIndicators(state);
  } else {
    cell.textContent = formatCellValue(row, column);
  }

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

  sortRows(state, column);
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
