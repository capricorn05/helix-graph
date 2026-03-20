/**
 * End-to-end regression: external-data detail modal lifecycle after navigation.
 *
 * Regression scenario
 * -------------------
 * Helix uses fragment-swap navigation: clicking a nav link fetches only the
 * `[data-hx-id="app-core"]` HTML fragment and replaces its innerHTML, leaving
 * the outer shell (header, nav, sidebar) intact.
 *
 * Before the fix, dialog controllers were module-level singletons that held
 * references to the original DOM nodes. After a fragment swap those nodes were
 * gone, but the cached controllers still pointed at them — so clicking "Details"
 * a second time silently opened a detached, invisible overlay.
 *
 * The fix (see actions-external.ts + actions-navigation.ts):
 *   1. `resetExternalDialogControllers()` is called before every fragment swap.
 *   2. Each "ensure" helper validates that cached overlay/button nodes are still
 *      live in the document; if not, it destroys the stale mount and recreates
 *      it against the freshly rendered DOM.
 *
 * These tests confirm the fix end-to-end using a real browser via Playwright.
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the Helix fragment swap to settle.
 *
 * After clicking an in-app nav link, Helix fetches the new fragment and swaps
 * `app-core` innerHTML. We wait for the network to be idle and then a brief
 * tick to let any post-swap microtasks finish.
 */
async function waitForFragmentSwap(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.waitForLoadState("networkidle");
}

// ---------------------------------------------------------------------------
// /external-data-rich
// ---------------------------------------------------------------------------

test.describe("/external-data-rich — detail modal navigation lifecycle", () => {
  test("modal opens after initial load (baseline)", async ({ page }) => {
    await page.goto("/external-data-rich");

    const firstDetailsBtn = page
      .locator('[data-hx-bind="external-media-detail-open"]')
      .first();
    await firstDetailsBtn.waitFor({ state: "visible" });
    await firstDetailsBtn.click();

    await expect(
      page.locator('[data-hx-id="external-media-modal-overlay"]'),
    ).toBeVisible();

    // clean up
    await page.locator('[data-hx-id="external-media-modal-close-btn"]').click();
    await expect(
      page.locator('[data-hx-id="external-media-modal-overlay"]'),
    ).toBeHidden();
  });

  test("modal opens after navigate-away then navigate-back (regression)", async ({
    page,
  }) => {
    await page.goto("/external-data-rich");

    // ── 1. Open and close the modal once so the controller cache is warm ──
    const detailsBtnBefore = page
      .locator('[data-hx-bind="external-media-detail-open"]')
      .first();
    await detailsBtnBefore.waitFor({ state: "visible" });
    await detailsBtnBefore.click();

    const overlayBefore = page.locator(
      '[data-hx-id="external-media-modal-overlay"]',
    );
    await expect(overlayBefore).toBeVisible();
    await page.locator('[data-hx-id="external-media-modal-close-btn"]').click();
    await expect(overlayBefore).toBeHidden();

    // ── 2. Navigate away via the in-app nav link (fragment swap, no full load) ──
    await page.click('a[data-hx-bind="app-nav"][href="/"]');
    await waitForFragmentSwap(page);

    // Confirm we are on the users page (app-core content replaced)
    await expect(
      page.locator('[data-hx-id="external-media-products-body"]'),
    ).toHaveCount(0);

    // ── 3. Navigate back to /external-data-rich via the in-app nav ──
    await page.click('a[data-hx-bind="app-nav"][href="/external-data-rich"]');
    await waitForFragmentSwap(page);

    // Wait for the table to be present in the new fragment
    const detailsBtnAfter = page
      .locator('[data-hx-bind="external-media-detail-open"]')
      .first();
    await detailsBtnAfter.waitFor({ state: "visible" });

    // ── 4. Open the modal again — this was the failing step before the fix ──
    await detailsBtnAfter.click();

    await expect(
      page.locator('[data-hx-id="external-media-modal-overlay"]'),
    ).toBeVisible({ timeout: 5000 });
  });

  test("modal still opens after rapid away-back-away-back cycle", async ({
    page,
  }) => {
    await page.goto("/external-data-rich");

    // Warm the cache
    const firstBtn = page
      .locator('[data-hx-bind="external-media-detail-open"]')
      .first();
    await firstBtn.waitFor({ state: "visible" });

    // Cycle twice
    for (let cycle = 0; cycle < 2; cycle++) {
      await page.click('a[data-hx-bind="app-nav"][href="/"]');
      await waitForFragmentSwap(page);
      await page.click('a[data-hx-bind="app-nav"][href="/external-data-rich"]');
      await waitForFragmentSwap(page);
    }

    const detailsBtn = page
      .locator('[data-hx-bind="external-media-detail-open"]')
      .first();
    await detailsBtn.waitFor({ state: "visible" });
    await detailsBtn.click();

    await expect(
      page.locator('[data-hx-id="external-media-modal-overlay"]'),
    ).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// /external-data (non-rich)
// ---------------------------------------------------------------------------

test.describe("/external-data — detail modal navigation lifecycle", () => {
  test("modal opens after initial load (baseline)", async ({ page }) => {
    await page.goto("/external-data");

    const firstDetailsBtn = page
      .locator('[data-hx-bind="external-detail-open"]')
      .first();
    await firstDetailsBtn.waitFor({ state: "visible" });
    await firstDetailsBtn.click();

    await expect(
      page.locator('[data-hx-id="external-modal-overlay"]'),
    ).toBeVisible();

    await page.locator('[data-hx-id="external-modal-close-btn"]').click();
    await expect(
      page.locator('[data-hx-id="external-modal-overlay"]'),
    ).toBeHidden();
  });

  test("modal opens after navigate-away then navigate-back (regression)", async ({
    page,
  }) => {
    await page.goto("/external-data");

    // Warm the cache
    const detailsBtnBefore = page
      .locator('[data-hx-bind="external-detail-open"]')
      .first();
    await detailsBtnBefore.waitFor({ state: "visible" });
    await detailsBtnBefore.click();

    const overlayBefore = page.locator('[data-hx-id="external-modal-overlay"]');
    await expect(overlayBefore).toBeVisible();
    await page.locator('[data-hx-id="external-modal-close-btn"]').click();
    await expect(overlayBefore).toBeHidden();

    // Navigate away
    await page.click('a[data-hx-bind="app-nav"][href="/"]');
    await waitForFragmentSwap(page);

    await expect(
      page.locator('[data-hx-id="external-products-body"]'),
    ).toHaveCount(0);

    // Navigate back
    await page.click('a[data-hx-bind="app-nav"][href="/external-data"]');
    await waitForFragmentSwap(page);

    const detailsBtnAfter = page
      .locator('[data-hx-bind="external-detail-open"]')
      .first();
    await detailsBtnAfter.waitFor({ state: "visible" });
    await detailsBtnAfter.click();

    await expect(
      page.locator('[data-hx-id="external-modal-overlay"]'),
    ).toBeVisible({ timeout: 5000 });
  });
});
