import { resource } from "../../helix/index.js";
import type { SortDirection } from "../domain.js";
import {
  EXTERNAL_PRODUCTS_SORT_COLUMNS,
  type ExternalProductsFilters,
  type ExternalProductsQuery,
  type ExternalProductsSortColumn,
} from "../utils/query.js";

export const EXTERNAL_PRODUCTS_PAGE_SIZE = 30;
export const EXTERNAL_PRODUCTS_TOTAL_ROWS = 10_000;

export interface ExternalProductRow {
  id: number;
  title: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
}

export interface ExternalProductDetail extends ExternalProductRow {
  description: string;
  thumbnail: string;
  sourceId: number;
}

export interface ExternalProductsPage {
  rows: ExternalProductRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortCol: ExternalProductsSortColumn;
  sortDir: SortDirection;
  filters: ExternalProductsFilters;
}

type ExternalProductsContext = ExternalProductsQuery;

interface DummyJsonProductsResponse {
  products: Array<{
    id: number;
    title: string;
    brand?: string;
    category: string;
    price: number;
    stock: number;
    rating: number;
    description?: string;
    thumbnail?: string;
  }>;
  total: number;
  skip: number;
  limit: number;
}

let seedProductsCache: DummyJsonProductsResponse["products"] | null = null;
let allProductsCache: ExternalProductRow[] | null = null;

async function getSeedProducts(): Promise<
  DummyJsonProductsResponse["products"]
> {
  if (seedProductsCache) {
    return seedProductsCache;
  }

  const response = await fetch(
    "https://dummyjson.com/products?limit=100&skip=0&select=id,title,brand,category,price,stock,rating,description,thumbnail",
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch external dataset seeds: ${response.status}`,
    );
  }

  const payload = (await response.json()) as DummyJsonProductsResponse;
  if (!Array.isArray(payload.products) || payload.products.length === 0) {
    throw new Error("External dataset returned no products");
  }

  seedProductsCache = payload.products;
  return seedProductsCache;
}

function clampRating(value: number): number {
  return Math.max(0, Math.min(5, Number(value.toFixed(1))));
}

function normalizeFilterValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function synthesizeProductById(
  syntheticId: number,
  seeds: DummyJsonProductsResponse["products"],
): ExternalProductDetail {
  const seed = seeds[(syntheticId - 1) % seeds.length];
  const variant = Math.floor((syntheticId - 1) / seeds.length) + 1;

  const price = Number((seed.price + (variant % 12) * 0.75).toFixed(2));
  const stock = Math.max(0, seed.stock + ((variant % 9) - 4) * 3);
  const rating = clampRating(seed.rating + ((variant % 5) - 2) * 0.1);

  return {
    id: syntheticId,
    title: `${seed.title} v${variant}`,
    brand: seed.brand ?? "Unknown",
    category: seed.category,
    price,
    stock,
    rating,
    description: seed.description ?? "No description available.",
    thumbnail: seed.thumbnail ?? "",
    sourceId: seed.id,
  };
}

export async function getExternalProductDetailById(
  id: number,
): Promise<ExternalProductDetail | null> {
  if (!Number.isInteger(id) || id < 1 || id > EXTERNAL_PRODUCTS_TOTAL_ROWS) {
    return null;
  }

  const seeds = await getSeedProducts();
  return synthesizeProductById(id, seeds);
}

function fallbackExternalProductDetail(
  row: ExternalProductRow,
): ExternalProductDetail {
  return {
    id: row.id,
    title: row.title,
    brand: row.brand,
    category: row.category,
    price: row.price,
    stock: row.stock,
    rating: row.rating,
    description: "No description available.",
    thumbnail: "",
    sourceId: row.id,
  };
}

export async function resolveExternalProductDetails(
  rows: readonly ExternalProductRow[],
): Promise<ExternalProductDetail[]> {
  const details = await Promise.all(
    rows.map((row) => getExternalProductDetailById(row.id)),
  );

  return rows.map(
    (row, index) => details[index] ?? fallbackExternalProductDetail(row),
  );
}

async function getAllExternalProductRows(): Promise<ExternalProductRow[]> {
  if (allProductsCache) {
    return allProductsCache;
  }

  const seeds = await getSeedProducts();
  const rows: ExternalProductRow[] = [];

  for (let id = 1; id <= EXTERNAL_PRODUCTS_TOTAL_ROWS; id += 1) {
    const product = synthesizeProductById(id, seeds);
    rows.push({
      id: product.id,
      title: product.title,
      brand: product.brand,
      category: product.category,
      price: product.price,
      stock: product.stock,
      rating: product.rating,
    });
  }

  allProductsCache = rows;
  return allProductsCache;
}

function compareExternalProducts(
  left: ExternalProductRow,
  right: ExternalProductRow,
  sortCol: ExternalProductsSortColumn,
): number {
  switch (sortCol) {
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
    default:
      return 0;
  }
}

function filterExternalProducts(
  rows: ExternalProductRow[],
  filters: ExternalProductsFilters,
): ExternalProductRow[] {
  return rows.filter((row) => {
    for (const column of EXTERNAL_PRODUCTS_SORT_COLUMNS) {
      const rawFilter = filters[column]?.trim();
      if (!rawFilter) {
        continue;
      }

      if (
        column === "id" ||
        column === "price" ||
        column === "stock" ||
        column === "rating"
      ) {
        const expected = Number(rawFilter);
        const actual = row[column];
        if (!Number.isFinite(expected) || actual !== expected) {
          return false;
        }
        continue;
      }

      const query = normalizeFilterValue(rawFilter);
      const actual = row[column].toLocaleLowerCase();
      if (!actual.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

export function setExternalProductSeedsForTests(
  products: DummyJsonProductsResponse["products"],
): void {
  seedProductsCache = [...products];
  allProductsCache = null;
}

export function resetExternalProductsSeedCacheForTests(): void {
  seedProductsCache = null;
  allProductsCache = null;
}

export const externalProductsResource = resource<
  ExternalProductsPage,
  ExternalProductsContext
>(
  "external-products",
  ({ page, pageSize, sortCol, sortDir, filters }) => [
    "external-products",
    page,
    pageSize,
    sortCol,
    sortDir,
    ...EXTERNAL_PRODUCTS_SORT_COLUMNS.map((column) => filters[column] ?? ""),
  ],
  async ({ page, pageSize, sortCol, sortDir, filters }) => {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const allRows = await getAllExternalProductRows();
    const filteredRows = filterExternalProducts(allRows, filters);
    const direction = sortDir === "desc" ? -1 : 1;
    const sortedRows = [...filteredRows].sort(
      (left, right) =>
        compareExternalProducts(left, right, sortCol) * direction,
    );
    const total = sortedRows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const clampedPage = Math.min(safePage, totalPages);
    const startIndex = (clampedPage - 1) * pageSize;
    const rows = sortedRows.slice(startIndex, startIndex + pageSize);

    return {
      rows,
      page: clampedPage,
      pageSize,
      total,
      totalPages,
      sortCol,
      sortDir,
      filters: { ...filters },
    };
  },
  {
    where: "server",
    cache: "memory",
    staleMs: 30_000,
    revalidateMs: 60_000,
    dedupe: "inflight",
    tags: ["external-products"],
  },
);
