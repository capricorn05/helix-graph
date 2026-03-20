import { MongoClient, type Collection, type Document } from "mongodb";
import { resource } from "../../helix/index.js";
import type { SortDirection } from "../domain.js";
import type {
  MongoAirbnbFilters,
  MongoAirbnbQuery,
  MongoAirbnbSortColumn,
} from "../shared/mongo-airbnb-query.js";
import {
  MONGO_AIRBNB_MARKET_OPTIONS,
  MONGO_AIRBNB_ROOM_TYPE_OPTIONS,
} from "../shared/mongo-airbnb-query.js";

export const MONGO_AIRBNB_PAGE_SIZE = 12;
const MONGO_AIRBNB_OFFLINE_ROW_COUNT = 180;
const MONGO_QUERY_TIMEOUT_MS = 5_000;
const MONGO_CONNECT_RETRY_COOLDOWN_MS = 30_000;

export interface MongoAirbnbListingRow {
  id: string;
  name: string;
  summary: string;
  propertyType: string;
  roomType: string;
  market: string;
  country: string;
  hostName: string;
  imageUrl: string;
  price: number;
  reviewScore: number;
  reviewsCount: number;
  accommodates: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
}

export interface MongoAirbnbListingsPage {
  rows: MongoAirbnbListingRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortCol: MongoAirbnbSortColumn;
  sortDir: SortDirection;
  filters: MongoAirbnbFilters;
  source: "mongodb" | "offline-sample";
}

type MongoAirbnbContext = MongoAirbnbQuery;

let mongoClient: MongoClient | null = null;
let mongoConnectPromise: Promise<MongoClient | null> | null = null;
let nextMongoRetryAt = 0;
let warnedMissingMongoUri = false;
let offlineRowsCache: MongoAirbnbListingRow[] | null = null;

function getMongoUri(): string | null {
  const value = process.env.MONGODB_URI?.trim();
  return value && value.length > 0 ? value : null;
}

function getMongoDatabaseName(): string {
  return process.env.MONGODB_AIRBNB_DATABASE?.trim() || "sample_airbnb";
}

function getMongoCollectionName(): string {
  return process.env.MONGODB_AIRBNB_COLLECTION?.trim() || "listingsAndReviews";
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    const parsed = Number(value.toString());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function sanitizeSummary(value: unknown): string {
  const normalized = toNonEmptyString(
    value,
    "A cozy stay with thoughtfully designed spaces.",
  );
  if (normalized.length <= 200) {
    return normalized;
  }

  return `${normalized.slice(0, 197)}...`;
}

function resolveSortField(sortCol: MongoAirbnbSortColumn): string {
  switch (sortCol) {
    case "price":
      return "normalizedPrice";
    case "reviews":
      return "normalizedReviewsCount";
    case "accommodates":
      return "normalizedAccommodates";
    case "name":
      return "name";
    case "reviewScore":
    default:
      return "normalizedReviewScore";
  }
}

function buildMongoBaseMatch(filters: MongoAirbnbFilters): Document {
  const match: Document = {
    name: {
      $exists: true,
      $type: "string",
      $ne: "",
    },
  };

  if (filters.market) {
    match["address.market"] = filters.market;
  }

  if (filters.roomType) {
    match.room_type = filters.roomType;
  }

  return match;
}

function buildMongoNormalizedFieldsStage(): Document {
  return {
    $addFields: {
      normalizedPrice: {
        $convert: {
          input: "$price",
          to: "double",
          onError: 0,
          onNull: 0,
        },
      },
      normalizedReviewScore: {
        $convert: {
          input: "$review_scores.review_scores_rating",
          to: "double",
          onError: 0,
          onNull: 0,
        },
      },
      normalizedReviewsCount: {
        $convert: {
          input: "$number_of_reviews",
          to: "int",
          onError: 0,
          onNull: 0,
        },
      },
      normalizedAccommodates: {
        $convert: {
          input: "$accommodates",
          to: "int",
          onError: 1,
          onNull: 1,
        },
      },
      normalizedBedrooms: {
        $convert: {
          input: "$bedrooms",
          to: "int",
          onError: 1,
          onNull: 1,
        },
      },
      normalizedBeds: {
        $convert: {
          input: "$beds",
          to: "int",
          onError: 1,
          onNull: 1,
        },
      },
      normalizedBathrooms: {
        $convert: {
          input: "$bathrooms",
          to: "double",
          onError: 1,
          onNull: 1,
        },
      },
      normalizedHostName: {
        $ifNull: ["$host.host_name", "Host"],
      },
      normalizedImageUrl: {
        $ifNull: ["$images.picture_url", ""],
      },
      normalizedSummary: {
        $ifNull: ["$summary", ""],
      },
      normalizedMarket: {
        $ifNull: ["$address.market", "Unknown market"],
      },
      normalizedCountry: {
        $ifNull: ["$address.country", "Unknown country"],
      },
    },
  };
}

function buildMongoNumericMatch(filters: MongoAirbnbFilters): Document {
  const match: Document = {};

  if (typeof filters.maxPrice === "number") {
    match.normalizedPrice = {
      ...(match.normalizedPrice as Document | undefined),
      $lte: filters.maxPrice,
    };
  }

  if (typeof filters.minGuests === "number") {
    match.normalizedAccommodates = {
      ...(match.normalizedAccommodates as Document | undefined),
      $gte: filters.minGuests,
    };
  }

  return match;
}

function mapMongoListingRow(document: Document): MongoAirbnbListingRow {
  return {
    id: String(document._id ?? ""),
    name: toNonEmptyString(document.name, "Untitled stay"),
    summary: sanitizeSummary(document.normalizedSummary),
    propertyType: toNonEmptyString(document.property_type, "Home"),
    roomType: toNonEmptyString(document.room_type, "Entire home/apt"),
    market: toNonEmptyString(document.normalizedMarket, "Unknown market"),
    country: toNonEmptyString(document.normalizedCountry, "Unknown country"),
    hostName: toNonEmptyString(document.normalizedHostName, "Host"),
    imageUrl: toNonEmptyString(document.normalizedImageUrl, ""),
    price: toFiniteNumber(document.normalizedPrice, 0),
    reviewScore: toFiniteNumber(document.normalizedReviewScore, 0),
    reviewsCount: Math.max(
      0,
      Math.floor(toFiniteNumber(document.normalizedReviewsCount, 0)),
    ),
    accommodates: Math.max(
      1,
      Math.floor(toFiniteNumber(document.normalizedAccommodates, 1)),
    ),
    bedrooms: Math.max(
      0,
      Math.floor(toFiniteNumber(document.normalizedBedrooms, 0)),
    ),
    beds: Math.max(1, Math.floor(toFiniteNumber(document.normalizedBeds, 1))),
    bathrooms: Math.max(
      0,
      Number(toFiniteNumber(document.normalizedBathrooms, 1).toFixed(1)),
    ),
  };
}

function compareMongoListings(
  left: MongoAirbnbListingRow,
  right: MongoAirbnbListingRow,
  sortCol: MongoAirbnbSortColumn,
): number {
  switch (sortCol) {
    case "price":
      return left.price - right.price;
    case "reviews":
      return left.reviewsCount - right.reviewsCount;
    case "accommodates":
      return left.accommodates - right.accommodates;
    case "name":
      return left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
        numeric: true,
      });
    case "reviewScore":
    default:
      return left.reviewScore - right.reviewScore;
  }
}

function applyOfflineFilters(
  rows: readonly MongoAirbnbListingRow[],
  filters: MongoAirbnbFilters,
): MongoAirbnbListingRow[] {
  return rows.filter((row) => {
    if (filters.market && row.market !== filters.market) {
      return false;
    }

    if (filters.roomType && row.roomType !== filters.roomType) {
      return false;
    }

    if (typeof filters.maxPrice === "number" && row.price > filters.maxPrice) {
      return false;
    }

    if (
      typeof filters.minGuests === "number" &&
      row.accommodates < filters.minGuests
    ) {
      return false;
    }

    return true;
  });
}

function buildListingsPageFromRows(
  rows: readonly MongoAirbnbListingRow[],
  context: MongoAirbnbContext,
  source: "mongodb" | "offline-sample",
): MongoAirbnbListingsPage {
  const safePage =
    Number.isFinite(context.page) && context.page > 0
      ? Math.floor(context.page)
      : 1;
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / context.pageSize));
  const page = Math.min(safePage, totalPages);
  const startIndex = (page - 1) * context.pageSize;

  return {
    rows: rows.slice(startIndex, startIndex + context.pageSize),
    page,
    pageSize: context.pageSize,
    total,
    totalPages,
    sortCol: context.sortCol,
    sortDir: context.sortDir,
    filters: { ...context.filters },
    source,
  };
}

function getOfflineRows(): MongoAirbnbListingRow[] {
  if (offlineRowsCache) {
    return offlineRowsCache;
  }

  const hostNames = [
    "Aria",
    "Noah",
    "Lina",
    "Mateo",
    "Sora",
    "Elias",
    "Nora",
    "Kai",
  ];
  const propertyTypes = [
    "Loft",
    "Apartment",
    "Guest suite",
    "Townhouse",
    "Condo",
    "Bungalow",
  ];
  const countriesByMarket: Record<string, string> = {
    Barcelona: "Spain",
    Istanbul: "Turkey",
    Montreal: "Canada",
    "New York": "United States",
    Portland: "United States",
    "Rio De Janeiro": "Brazil",
    Sydney: "Australia",
  };

  offlineRowsCache = Array.from(
    { length: MONGO_AIRBNB_OFFLINE_ROW_COUNT },
    (_, index) => {
      const id = index + 1;
      const market =
        MONGO_AIRBNB_MARKET_OPTIONS[index % MONGO_AIRBNB_MARKET_OPTIONS.length];
      const roomType =
        MONGO_AIRBNB_ROOM_TYPE_OPTIONS[
          index % MONGO_AIRBNB_ROOM_TYPE_OPTIONS.length
        ];
      const propertyType = propertyTypes[index % propertyTypes.length];
      const hostName = hostNames[index % hostNames.length];
      const accommodates = 2 + (index % 6);
      const bedrooms = Math.max(1, Math.floor(accommodates / 2));
      const price = Number(
        (95 + (index % 18) * 17 + (index % 5) * 9.5).toFixed(2),
      );
      const reviewScore = Number((82 + (index % 19)).toFixed(1));
      const reviewsCount = 18 + (index % 140);

      return {
        id: `offline-${id}`,
        name: `${propertyType} ${market} Retreat #${id}`,
        summary:
          "Curated fallback listing with bright interiors, strong Wi-Fi, and walkable access to local cafes.",
        propertyType,
        roomType,
        market,
        country: countriesByMarket[market] ?? "Unknown country",
        hostName,
        imageUrl: `https://picsum.photos/seed/helix-airbnb-${id}/640/420`,
        price,
        reviewScore,
        reviewsCount,
        accommodates,
        bedrooms,
        beds: Math.max(1, bedrooms + (index % 2)),
        bathrooms: Number((1 + (index % 3) * 0.5).toFixed(1)),
      };
    },
  );

  return offlineRowsCache;
}

function sortRows(
  rows: readonly MongoAirbnbListingRow[],
  sortCol: MongoAirbnbSortColumn,
  sortDir: SortDirection,
): MongoAirbnbListingRow[] {
  const direction = sortDir === "desc" ? -1 : 1;

  return [...rows].sort((left, right) => {
    const base = compareMongoListings(left, right, sortCol) * direction;
    if (base !== 0) {
      return base;
    }

    return left.id.localeCompare(right.id, undefined, {
      sensitivity: "base",
      numeric: true,
    });
  });
}

async function ensureMongoCollection(): Promise<Collection<Document> | null> {
  const uri = getMongoUri();
  if (!uri) {
    if (!warnedMissingMongoUri) {
      warnedMissingMongoUri = true;
      console.warn(
        "[mongo-airbnb.resource] MONGODB_URI is not configured. Using offline Airbnb fallback dataset.",
      );
    }
    return null;
  }

  if (mongoClient) {
    return mongoClient
      .db(getMongoDatabaseName())
      .collection(getMongoCollectionName());
  }

  if (Date.now() < nextMongoRetryAt) {
    return null;
  }

  if (!mongoConnectPromise) {
    mongoConnectPromise = MongoClient.connect(uri, {
      appName: "helix-graph3-airbnb-page",
      maxPoolSize: 8,
      minPoolSize: 0,
      maxIdleTimeMS: 30_000,
      serverSelectionTimeoutMS: 3_500,
    })
      .then((connected) => {
        mongoClient = connected;
        return connected;
      })
      .catch((error: unknown) => {
        nextMongoRetryAt = Date.now() + MONGO_CONNECT_RETRY_COOLDOWN_MS;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[mongo-airbnb.resource] Failed to connect to MongoDB; using offline dataset: ${message}`,
        );
        return null;
      })
      .finally(() => {
        mongoConnectPromise = null;
      });
  }

  const client = await mongoConnectPromise;
  if (!client) {
    return null;
  }

  return client.db(getMongoDatabaseName()).collection(getMongoCollectionName());
}

async function countMongoListings(
  collection: Collection<Document>,
  filters: MongoAirbnbFilters,
): Promise<number> {
  const pipeline: Document[] = [
    { $match: buildMongoBaseMatch(filters) },
    buildMongoNormalizedFieldsStage(),
  ];

  const numericMatch = buildMongoNumericMatch(filters);
  if (Object.keys(numericMatch).length > 0) {
    pipeline.push({ $match: numericMatch });
  }

  pipeline.push({ $count: "total" });

  const [result] = await collection
    .aggregate<{ total: number }>(pipeline, {
      maxTimeMS: MONGO_QUERY_TIMEOUT_MS,
    })
    .toArray();

  return Math.max(0, Math.floor(result?.total ?? 0));
}

async function fetchMongoRows(
  collection: Collection<Document>,
  context: MongoAirbnbContext,
  page: number,
): Promise<MongoAirbnbListingRow[]> {
  const direction: 1 | -1 = context.sortDir === "desc" ? -1 : 1;
  const sortField = resolveSortField(context.sortCol);
  const pipeline: Document[] = [
    { $match: buildMongoBaseMatch(context.filters) },
    buildMongoNormalizedFieldsStage(),
  ];

  const numericMatch = buildMongoNumericMatch(context.filters);
  if (Object.keys(numericMatch).length > 0) {
    pipeline.push({ $match: numericMatch });
  }

  pipeline.push(
    {
      $sort: {
        [sortField]: direction,
        _id: 1,
      },
    },
    {
      $skip: (page - 1) * context.pageSize,
    },
    {
      $limit: context.pageSize,
    },
    {
      $project: {
        _id: 1,
        name: 1,
        property_type: 1,
        room_type: 1,
        normalizedPrice: 1,
        normalizedReviewScore: 1,
        normalizedReviewsCount: 1,
        normalizedAccommodates: 1,
        normalizedBedrooms: 1,
        normalizedBeds: 1,
        normalizedBathrooms: 1,
        normalizedHostName: 1,
        normalizedImageUrl: 1,
        normalizedSummary: 1,
        normalizedMarket: 1,
        normalizedCountry: 1,
      },
    },
  );

  const documents = await collection
    .aggregate<Document>(pipeline, {
      maxTimeMS: MONGO_QUERY_TIMEOUT_MS,
    })
    .toArray();

  return documents.map((document) => mapMongoListingRow(document));
}

async function loadMongoPage(
  context: MongoAirbnbContext,
): Promise<MongoAirbnbListingsPage | null> {
  const collection = await ensureMongoCollection();
  if (!collection) {
    return null;
  }

  try {
    const total = await countMongoListings(collection, context.filters);
    const totalPages = Math.max(1, Math.ceil(total / context.pageSize));
    const safePage =
      Number.isFinite(context.page) && context.page > 0
        ? Math.floor(context.page)
        : 1;
    const page = Math.min(safePage, totalPages);
    const rows = await fetchMongoRows(collection, context, page);

    return {
      rows,
      page,
      pageSize: context.pageSize,
      total,
      totalPages,
      sortCol: context.sortCol,
      sortDir: context.sortDir,
      filters: { ...context.filters },
      source: "mongodb",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[mongo-airbnb.resource] Query failed; using offline dataset: ${message}`,
    );
    nextMongoRetryAt = Date.now() + MONGO_CONNECT_RETRY_COOLDOWN_MS;
    return null;
  }
}

function loadOfflinePage(context: MongoAirbnbContext): MongoAirbnbListingsPage {
  const filteredRows = applyOfflineFilters(getOfflineRows(), context.filters);
  const sortedRows = sortRows(filteredRows, context.sortCol, context.sortDir);
  return buildListingsPageFromRows(sortedRows, context, "offline-sample");
}

export async function resetMongoAirbnbCachesForTests(): Promise<void> {
  offlineRowsCache = null;
  nextMongoRetryAt = 0;
  warnedMissingMongoUri = false;

  const client = mongoClient;
  mongoClient = null;
  mongoConnectPromise = null;

  if (client) {
    try {
      await client.close();
    } catch {
      // Ignore close errors in tests.
    }
  }
}

export const mongoAirbnbResource = resource<
  MongoAirbnbListingsPage,
  MongoAirbnbContext
>(
  "mongo-airbnb",
  ({ page, pageSize, sortCol, sortDir, filters }) => [
    "mongo-airbnb",
    page,
    pageSize,
    sortCol,
    sortDir,
    filters.market ?? "",
    filters.roomType ?? "",
    filters.maxPrice ?? "",
    filters.minGuests ?? "",
  ],
  async (context) => {
    const mongoPage = await loadMongoPage(context);
    if (mongoPage) {
      return mongoPage;
    }

    return loadOfflinePage(context);
  },
  {
    where: "server",
    cache: "memory",
    staleMs: 30_000,
    revalidateMs: 60_000,
    dedupe: "inflight",
    tags: ["mongo-airbnb"],
  },
);
