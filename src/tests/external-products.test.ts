import assert from "node:assert/strict";
import test from "node:test";
import { invalidateResourcesByTags } from "../helix/resource.js";
import {
  EXTERNAL_PRODUCTS_PAGE_SIZE,
  externalProductsResource,
  resetExternalProductsSeedCacheForTests,
  setExternalProductSeedsForTests,
} from "../example/resources/external-products.resource.js";
import { createExternalProductsQuery } from "../example/utils/query.js";

test("external products resource sorts and filters across the full dataset", async () => {
  setExternalProductSeedsForTests([
    {
      id: 1,
      title: "Alpha",
      brand: "Acme",
      category: "hardware",
      price: 10,
      stock: 8,
      rating: 4.1,
      description: "Alpha seed",
      thumbnail: "",
    },
    {
      id: 2,
      title: "Beta",
      brand: "Bravo",
      category: "software",
      price: 20,
      stock: 3,
      rating: 3.8,
      description: "Beta seed",
      thumbnail: "",
    },
  ]);
  invalidateResourcesByTags(["external-products"]);

  try {
    const page = await externalProductsResource.read(
      createExternalProductsQuery(EXTERNAL_PRODUCTS_PAGE_SIZE, {
        sortCol: "id",
        sortDir: "desc",
        filters: {
          title: "Beta",
        },
      }),
    );

    assert.equal(page.total, 5_000);
    assert.equal(
      page.totalPages,
      Math.ceil(5_000 / EXTERNAL_PRODUCTS_PAGE_SIZE),
    );
    assert.equal(page.rows[0]?.id, 10_000);
    assert.equal(page.rows[0]?.title, "Beta v5000");
    assert.equal(page.sortCol, "id");
    assert.equal(page.sortDir, "desc");
    assert.equal(page.filters.title, "Beta");
    assert.ok(page.rows.every((row) => row.title.startsWith("Beta")));
  } finally {
    invalidateResourcesByTags(["external-products"]);
    resetExternalProductsSeedCacheForTests();
  }
});
