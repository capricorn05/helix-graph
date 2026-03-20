import assert from "node:assert/strict";
import test from "node:test";
import { invalidateResourcesByTags } from "../helix/resource.js";
import {
  MONGO_AIRBNB_PAGE_SIZE,
  mongoAirbnbResource,
  resetMongoAirbnbCachesForTests,
} from "../example/resources/mongo-airbnb.resource.js";
import { buildMongoAirbnbPageHref } from "../example/shared/mongo-airbnb.js";
import {
  createMongoAirbnbQuery,
  resolveMongoAirbnbQuery,
} from "../example/utils/query.js";

test("resolveMongoAirbnbQuery applies defaults and clamps unsupported filters", () => {
  const query = resolveMongoAirbnbQuery(
    new URL(
      "http://localhost/airbnb-mongo?page=3&sortCol=price&sortDir=asc&market=Nowhere&roomType=Tent&maxPrice=-10&minGuests=40",
    ),
    MONGO_AIRBNB_PAGE_SIZE,
  );

  assert.equal(query.page, 3);
  assert.equal(query.pageSize, MONGO_AIRBNB_PAGE_SIZE);
  assert.equal(query.sortCol, "price");
  assert.equal(query.sortDir, "asc");
  assert.equal(query.filters.market, undefined);
  assert.equal(query.filters.roomType, undefined);
  assert.equal(query.filters.maxPrice, undefined);
  assert.equal(query.filters.minGuests, 16);
});

test("buildMongoAirbnbPageHref preserves and overrides state values", () => {
  const href = buildMongoAirbnbPageHref(
    {
      page: 2,
      pageSize: MONGO_AIRBNB_PAGE_SIZE,
      total: 450,
      totalPages: 38,
      sortCol: "reviewScore",
      sortDir: "desc",
      filters: {
        market: "Barcelona",
        roomType: "Entire home/apt",
        maxPrice: 280,
      },
      source: "mongodb",
    },
    {
      page: 1,
      sortCol: "price",
      sortDir: "asc",
      filters: {
        minGuests: 4,
      },
    },
  );

  const parsed = new URL(`http://localhost${href}`);

  assert.equal(parsed.pathname, "/airbnb-mongo");
  assert.equal(parsed.searchParams.get("page"), "1");
  assert.equal(parsed.searchParams.get("sortCol"), "price");
  assert.equal(parsed.searchParams.get("sortDir"), "asc");
  assert.equal(parsed.searchParams.get("market"), "Barcelona");
  assert.equal(parsed.searchParams.get("roomType"), "Entire home/apt");
  assert.equal(parsed.searchParams.get("maxPrice"), "280");
  assert.equal(parsed.searchParams.get("minGuests"), "4");
});

test("mongoAirbnbResource serves filtered offline fallback rows when MongoDB URI is absent", async () => {
  const previousMongoUri = process.env.MONGODB_URI;
  const previousMongoDatabase = process.env.MONGODB_AIRBNB_DATABASE;
  const previousMongoCollection = process.env.MONGODB_AIRBNB_COLLECTION;

  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_AIRBNB_DATABASE;
  delete process.env.MONGODB_AIRBNB_COLLECTION;

  await resetMongoAirbnbCachesForTests();
  invalidateResourcesByTags(["mongo-airbnb"]);

  try {
    const page = await mongoAirbnbResource.read(
      createMongoAirbnbQuery(MONGO_AIRBNB_PAGE_SIZE, {
        sortCol: "price",
        sortDir: "asc",
        filters: {
          market: "Barcelona",
          maxPrice: 260,
          minGuests: 3,
        },
      }),
    );

    assert.equal(page.source, "offline-sample");
    assert.equal(page.sortCol, "price");
    assert.equal(page.sortDir, "asc");
    assert.equal(page.filters.market, "Barcelona");
    assert.equal(page.filters.maxPrice, 260);
    assert.equal(page.filters.minGuests, 3);
    assert.ok(page.rows.length > 0);
    assert.ok(page.rows.every((row) => row.market === "Barcelona"));
    assert.ok(page.rows.every((row) => row.price <= 260));
    assert.ok(page.rows.every((row) => row.accommodates >= 3));

    const prices = page.rows.map((row) => row.price);
    for (let index = 1; index < prices.length; index += 1) {
      assert.ok(prices[index - 1] <= prices[index]);
    }
  } finally {
    await resetMongoAirbnbCachesForTests();
    invalidateResourcesByTags(["mongo-airbnb"]);

    if (previousMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = previousMongoUri;
    }

    if (previousMongoDatabase === undefined) {
      delete process.env.MONGODB_AIRBNB_DATABASE;
    } else {
      process.env.MONGODB_AIRBNB_DATABASE = previousMongoDatabase;
    }

    if (previousMongoCollection === undefined) {
      delete process.env.MONGODB_AIRBNB_COLLECTION;
    } else {
      process.env.MONGODB_AIRBNB_COLLECTION = previousMongoCollection;
    }
  }
});
