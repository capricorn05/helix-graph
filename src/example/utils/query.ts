import type { SortColumn, SortDirection } from "../domain.js";
import {
  EXTERNAL_PRODUCTS_SORT_COLUMNS,
  type ExternalProductsFilters,
  type ExternalProductsSortColumn,
} from "../shared/external-products-query.js";

export { EXTERNAL_PRODUCTS_SORT_COLUMNS };
export type { ExternalProductsFilters, ExternalProductsSortColumn };

export const PAGE_SIZE = 6;

export interface ExternalProductsQuery {
  page: number;
  pageSize: number;
  sortCol: ExternalProductsSortColumn;
  sortDir: SortDirection;
  filters: ExternalProductsFilters;
}

export interface UsersResourceContext {
  page: number;
  pageSize: number;
  sortCol: SortColumn;
  sortDir: SortDirection;
}

export function parseSortColumn(value: string | null): SortColumn {
  return value === "email" ? "email" : "name";
}

export function parseSortDirection(value: string | null): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

export function parseExternalProductsSortColumn(
  value: string | null,
): ExternalProductsSortColumn {
  return EXTERNAL_PRODUCTS_SORT_COLUMNS.includes(
    value as ExternalProductsSortColumn,
  )
    ? (value as ExternalProductsSortColumn)
    : "id";
}

export function parsePage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function resolveExternalProductsFilters(
  searchParams: URLSearchParams,
): ExternalProductsFilters {
  const filters: ExternalProductsFilters = {};

  for (const column of EXTERNAL_PRODUCTS_SORT_COLUMNS) {
    const value = searchParams.get(column)?.trim();
    if (value) {
      filters[column] = value;
    }
  }

  return filters;
}

export function createExternalProductsQuery(
  pageSize: number,
  overrides: Partial<ExternalProductsQuery> = {},
): ExternalProductsQuery {
  return {
    page: overrides.page ?? 1,
    pageSize,
    sortCol: overrides.sortCol ?? "id",
    sortDir: overrides.sortDir ?? "asc",
    filters: overrides.filters ?? {},
  };
}

export function resolveExternalProductsQuery(
  url: URL,
  pageSize: number,
): ExternalProductsQuery {
  return createExternalProductsQuery(pageSize, {
    page: parsePage(url.searchParams.get("page")),
    sortCol: parseExternalProductsSortColumn(url.searchParams.get("sortCol")),
    sortDir: parseSortDirection(url.searchParams.get("sortDir")),
    filters: resolveExternalProductsFilters(url.searchParams),
  });
}

export function resolveUsersQuery(url: URL): UsersResourceContext {
  return {
    page: parsePage(url.searchParams.get("page")),
    pageSize: PAGE_SIZE,
    sortCol: parseSortColumn(url.searchParams.get("sortCol")),
    sortDir: parseSortDirection(url.searchParams.get("sortDir")),
  };
}
