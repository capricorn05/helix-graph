import type { SortColumn, SortDirection } from "../domain.js";

export const PAGE_SIZE = 6;

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

export function parsePage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function resolveUsersQuery(url: URL): UsersResourceContext {
  return {
    page: parsePage(url.searchParams.get("page")),
    pageSize: PAGE_SIZE,
    sortCol: parseSortColumn(url.searchParams.get("sortCol")),
    sortDir: parseSortDirection(url.searchParams.get("sortDir"))
  };
}
