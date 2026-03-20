import assert from "node:assert/strict";
import test from "node:test";
import { createFormState } from "../helix/form-state.js";

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

test("createFormState: derives validity from field validators", async () => {
  const form = createFormState({
    fields: {
      name: {
        initial: "",
        validate: (v) => v.trim() ? null : "Required",
      },
      age: {
        initial: 0,
        validate: (v) => v > 0 ? null : "Must be positive",
      },
    },
  });

  assert.equal(form.isValid.get(), false);
  assert.equal(form.fields.name.error.get(), "Required");
  assert.equal(form.fields.age.error.get(), "Must be positive");

  form.fields.name.value.set("Walter");
  form.fields.age.value.set(42);
  await flushMicrotasks();

  assert.equal(form.fields.name.error.get(), null);
  assert.equal(form.fields.age.error.get(), null);
  assert.equal(form.isValid.get(), true);
});

test("createFormState: tracks dirtiness against initial values", async () => {
  const form = createFormState({
    fields: {
      email: { initial: "a@example.com" },
    },
  });

  assert.equal(form.isDirty.get(), false);
  form.fields.email.value.set("b@example.com");
  await flushMicrotasks();
  assert.equal(form.isDirty.get(), true);
  form.fields.email.value.set("a@example.com");
  await flushMicrotasks();
  assert.equal(form.isDirty.get(), false);
});

test("createFormState: touchAll marks every field touched", () => {
  const form = createFormState({
    fields: {
      a: { initial: "" },
      b: { initial: "" },
    },
  });

  form.touchAll();
  assert.equal(form.fields.a.touched.get(), true);
  assert.equal(form.fields.b.touched.get(), true);
});

test("createFormState: reset restores initial values and clears touched/server errors", async () => {
  const form = createFormState({
    fields: {
      name: {
        initial: "Alice",
        validate: (v) => v.length >= 2 ? null : "Too short",
      },
    },
  });

  form.fields.name.value.set("B");
  form.fields.name.touched.set(true);
  form.applyServerErrors({ name: "Server says no" });
  assert.equal(form.fields.name.error.get(), "Server says no");

  form.reset();
  await flushMicrotasks();

  assert.equal(form.fields.name.value.get(), "Alice");
  assert.equal(form.fields.name.touched.get(), false);
  assert.equal(form.fields.name.error.get(), null);
  assert.equal(form.submitError.get(), null);
  assert.equal(form.isDirty.get(), false);
});

test("createFormState: applyServerErrors overrides validator output", async () => {
  const form = createFormState({
    fields: {
      name: {
        initial: "",
        validate: (v) => v.trim() ? null : "Required",
      },
    },
  });

  assert.equal(form.fields.name.error.get(), "Required");
  form.fields.name.value.set("Alice");
  await flushMicrotasks();
  assert.equal(form.fields.name.error.get(), null);

  form.applyServerErrors({ name: "Already taken" });
  await flushMicrotasks();
  assert.equal(form.fields.name.error.get(), "Already taken");

  form.applyServerErrors({});
  await flushMicrotasks();
  assert.equal(form.fields.name.error.get(), null);
});

test("createFormState: getValues returns current plain object values", () => {
  const form = createFormState({
    fields: {
      name: { initial: "Alice" },
      age: { initial: 20 },
    },
  });

  form.fields.age.value.set(21);
  assert.deepEqual(form.getValues(), { name: "Alice", age: 21 });
});

test("createFormState: submit sets isSubmitting and returns handler result", async () => {
  const form = createFormState({
    fields: {
      name: { initial: "Alice" },
    },
  });

  const promise = form.submit(async (values) => {
    assert.equal(form.isSubmitting.get(), true);
    return values.name.toUpperCase();
  });

  const result = await promise;
  assert.equal(result, "ALICE");
  assert.equal(form.isSubmitting.get(), false);
  assert.equal(form.submitError.get(), null);
});

test("createFormState: submit stores error message and rethrows", async () => {
  const form = createFormState({
    fields: {
      name: { initial: "Alice" },
    },
  });

  let thrown: unknown = null;
  try {
    await form.submit(async () => {
      throw new Error("save failed");
    });
  } catch (err) {
    thrown = err;
  }

  assert.ok(thrown instanceof Error);
  assert.equal((thrown as Error).message, "save failed");
  assert.equal(form.submitError.get(), "save failed");
  assert.equal(form.isSubmitting.get(), false);
});
