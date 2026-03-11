import { resource } from "../../helix/index.js";

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
}

interface ExternalProductsContext {
  page: number;
  pageSize: number;
}

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

async function getSeedProducts(): Promise<DummyJsonProductsResponse["products"]> {
  if (seedProductsCache) {
    return seedProductsCache;
  }

  const response = await fetch(
    "https://dummyjson.com/products?limit=100&skip=0&select=id,title,brand,category,price,stock,rating,description,thumbnail"
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch external dataset seeds: ${response.status}`);
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

function synthesizeProductById(
  syntheticId: number,
  seeds: DummyJsonProductsResponse["products"]
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
    sourceId: seed.id
  };
}

export async function getExternalProductDetailById(id: number): Promise<ExternalProductDetail | null> {
  if (!Number.isInteger(id) || id < 1 || id > EXTERNAL_PRODUCTS_TOTAL_ROWS) {
    return null;
  }

  const seeds = await getSeedProducts();
  return synthesizeProductById(id, seeds);
}

export const externalProductsResource = resource<ExternalProductsPage, ExternalProductsContext>(
  "external-products",
  ({ page, pageSize }) => ["external-products", page, pageSize],
  async ({ page, pageSize }) => {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const totalPages = Math.max(1, Math.ceil(EXTERNAL_PRODUCTS_TOTAL_ROWS / pageSize));
    const clampedPage = Math.min(safePage, totalPages);
    const startId = (clampedPage - 1) * pageSize + 1;
    const endId = Math.min(startId + pageSize - 1, EXTERNAL_PRODUCTS_TOTAL_ROWS);

    const seeds = await getSeedProducts();
    const rows: ExternalProductRow[] = [];
    for (let id = startId; id <= endId; id += 1) {
      const product = synthesizeProductById(id, seeds);
      rows.push({
        id: product.id,
        title: product.title,
        brand: product.brand,
        category: product.category,
        price: product.price,
        stock: product.stock,
        rating: product.rating
      });
    }

    return {
      rows,
      page: clampedPage,
      pageSize,
      total: EXTERNAL_PRODUCTS_TOTAL_ROWS,
      totalPages
    };
  },
  {
    where: "server",
    cache: "memory",
    staleMs: 30_000,
    revalidateMs: 60_000,
    dedupe: "inflight",
    tags: ["external-products"]
  }
);
