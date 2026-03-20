import assert from "node:assert/strict";
import test from "node:test";
import { cell } from "../helix/reactive.js";
import { createDragReorder, reorderArray } from "../helix/drag-reorder.js";

test("createDragReorder: move reorders items optimistically", () => {
  const items = cell(["a", "b", "c", "d"]);
  const dnd = createDragReorder({
    items,
    onReorder: async () => {},
  });

  dnd.move(0, 2);
  assert.deepEqual(items.get(), ["b", "c", "a", "d"]);
});

test("createDragReorder: move is a no-op for out-of-range indices", () => {
  const items = cell(["a", "b", "c"]);
  const dnd = createDragReorder({ items, onReorder: async () => {} });

  dnd.move(-1, 1);
  dnd.move(0, 10);
  dnd.move(2, 2);
  assert.deepEqual(items.get(), ["a", "b", "c"], "list should be unchanged");
});

test("createDragReorder: rollback reverts to pre-move state", () => {
  const items = cell(["a", "b", "c"]);
  const dnd = createDragReorder({ items, onReorder: async () => {} });

  dnd.move(0, 2);
  assert.deepEqual(items.get(), ["b", "c", "a"]);

  dnd.rollback();
  assert.deepEqual(items.get(), ["a", "b", "c"]);
});

test("createDragReorder: commit calls onReorder with new order", async () => {
  const items = cell(["a", "b", "c"]);
  let received: string[] = [];
  const dnd = createDragReorder({
    items,
    onReorder: async (next) => {
      received = [...next];
    },
  });

  dnd.move(2, 0);
  const ok = await dnd.commit();

  assert.equal(ok, true);
  assert.deepEqual(received, ["c", "a", "b"]);
  assert.deepEqual(items.get(), ["c", "a", "b"]);
});

test("createDragReorder: commit rolls back items on onReorder failure", async () => {
  const items = cell(["a", "b", "c"]);
  const dnd = createDragReorder({
    items,
    onReorder: async () => {
      throw new Error("server error");
    },
  });

  dnd.move(0, 2);
  assert.deepEqual(items.get(), ["b", "c", "a"]);

  const ok = await dnd.commit();

  assert.equal(ok, false);
  assert.deepEqual(items.get(), ["a", "b", "c"], "should have reverted");
});

test("createDragReorder: commit is a no-op when order unchanged", async () => {
  const items = cell(["a", "b"]);
  let callCount = 0;
  const dnd = createDragReorder({
    items,
    onReorder: async () => {
      callCount++;
    },
  });

  const ok = await dnd.commit();
  assert.equal(ok, true);
  assert.equal(callCount, 0, "onReorder should not be called if order is same");
});

test("createDragReorder: multiple moves before commit use last pre-move snapshot", async () => {
  const items = cell(["a", "b", "c"]);
  const dnd = createDragReorder({
    items,
    onReorder: async () => {
      throw new Error("fail");
    },
  });

  dnd.move(0, 1); // ["b", "a", "c"]
  dnd.move(1, 2); // ["b", "c", "a"]

  const ok = await dnd.commit();
  assert.equal(ok, false);
  // Should revert to state before the SECOND move's snapshot (captured at move time)
  assert.deepEqual(items.get(), ["b", "a", "c"]);
});

test("reorderArray: non-mutating reorder utility", () => {
  const original = ["x", "y", "z"];
  const reordered = reorderArray(original, 0, 2);

  assert.deepEqual(reordered, ["y", "z", "x"]);
  assert.deepEqual(original, ["x", "y", "z"], "original should be unchanged");
});

test("reorderArray: returns copy when indices are invalid or equal", () => {
  const arr = ["a", "b", "c"];
  assert.deepEqual(reorderArray(arr, 1, 1), ["a", "b", "c"]);
  assert.deepEqual(reorderArray(arr, -1, 2), ["a", "b", "c"]);
  assert.deepEqual(reorderArray(arr, 0, 99), ["a", "b", "c"]);
});
