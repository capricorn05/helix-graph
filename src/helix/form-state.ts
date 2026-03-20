/**
 * Reactive Form State (Tech Specs §14.4 Mode B)
 *
 * Manages per-field cells, derived error state, touched flags, global validity,
 * and submit lifecycle. Purely reactive — no DOM dependency. Wire field cells
 * to DOM with `bindTargetTextValue` / `bindTargetValue`.
 *
 * Example:
 * ```ts
 * const form = createFormState({
 *   fields: {
 *     name:  { initial: "", validate: (v) => v.trim() ? null : "Required" },
 *     email: { initial: "", validate: (v) => v.includes("@") ? null : "Invalid email" },
 *   },
 * });
 *
 * // Subscribe to field value
 * effect(() => {
 *   nameInput.value = form.fields.name.value.get();
 * });
 *
 * // On input
 * nameInput.addEventListener("input", (e) => {
 *   form.fields.name.value.set((e.target as HTMLInputElement).value);
 *   form.fields.name.touched.set(true);
 * });
 *
 * // Submit
 * form.submit(async (values) => {
 *   await saveUser(values);
 * });
 * ```
 */

import { cell, derived, batch } from "./reactive.js";
import type { Cell, Derived } from "./reactive.js";
import type { ReactiveOwner } from "./types.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type FormValidator<V> = (value: V) => string | null;

export interface FormFieldConfig<V> {
  /** Initial value for the field. */
  initial: V;
  /** Synchronous validator — return an error string or `null` for valid. */
  validate?: FormValidator<V>;
}

export type FormFieldsConfig<T extends Record<string, unknown>> = {
  [K in keyof T]: FormFieldConfig<T[K]>;
};

export interface ReactiveFieldState<V> {
  /** Writable cell holding the current field value. */
  value: Cell<V>;
  /** Derived error string. `null` when valid. Updated live as value changes. */
  error: Derived<string | null>;
  /** `true` once the user has interacted with this field. */
  touched: Cell<boolean>;
}

export interface FormStateController<T extends Record<string, unknown>> {
  /**
   * Per-field reactive state — one entry per key declared in the config.
   */
  readonly fields: { readonly [K in keyof T]: ReactiveFieldState<T[K]> };

  /** `true` when all fields with validators pass validation. */
  readonly isValid: Derived<boolean>;

  /**
   * `true` when any field value differs from its `initial` value.
   * Uses `Object.is` equality.
   */
  readonly isDirty: Derived<boolean>;

  /** `true` while the submit handler is in flight. */
  readonly isSubmitting: Cell<boolean>;

  /** Last submit error message (server-returned or thrown). `null` when clear. */
  readonly submitError: Cell<string | null>;

  /**
   * Mark all fields as touched (e.g., on first submit attempt to surface
   * all inline validation errors at once).
   */
  touchAll(): void;

  /**
   * Reset all fields to their initial values and clear touched/error state.
   */
  reset(): void;

  /**
   * Apply server-returned validation errors to field error state.
   * Typically called after a failed submit with `FormActionError.fieldErrors`.
   */
  applyServerErrors(errors: Partial<Record<keyof T, string>>): void;

  /**
   * Run the async submit handler with the current field values.
   * Sets `isSubmitting` for the duration, clears `submitError` on entry.
   * On catch, sets `submitError` to `error.message` and re-throws.
   * Returns the handler's result.
   */
  submit<R>(handler: (values: T) => Promise<R>): Promise<R>;

  /**
   * Collect current field values as a plain record.
   */
  getValues(): T;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

// Overrides injected by applyServerErrors, keyed by field name.
type ServerErrorMap<T> = Partial<Record<keyof T, string>>;

export function createFormState<T extends Record<string, unknown>>(config: {
  fields: FormFieldsConfig<T>;
  owner?: ReactiveOwner;
}): FormStateController<T> {
  type K = keyof T;
  const fieldKeys = Object.keys(config.fields) as K[];

  // Server-side error overrides (a plain mutable record; reactivity flows through Cell)
  const serverErrors: ServerErrorMap<T> = {};
  // A cell toggled on applyServerErrors so derived errors re-evaluate
  const serverErrorVersion = cell<number>(0);

  // Build per-field state
  function createFieldState<K2 extends K>(key: K2): ReactiveFieldState<T[K2]> {
    const fieldConfig = config.fields[key];

    const valueCell = cell<T[K2]>(fieldConfig.initial, {
      name: `form:${String(key)}:value`,
      owner: config.owner,
    });

    const touchedCell = cell<boolean>(false, {
      name: `form:${String(key)}:touched`,
      owner: config.owner,
    });

    const errorDerived: Derived<string | null> = derived(
      () => {
        // depend on serverErrorVersion so server errors trigger re-evaluation
        void serverErrorVersion.get();
        const serverErr = serverErrors[key] ?? null;
        if (serverErr !== null) {
          return serverErr;
        }
        return fieldConfig.validate?.(valueCell.get()) ?? null;
      },
      {
        name: `form:${String(key)}:error`,
        owner: config.owner,
      },
    );

    return {
      value: valueCell,
      error: errorDerived,
      touched: touchedCell,
    };
  }

  const fields = Object.fromEntries(
    fieldKeys.map((key) => [key, createFieldState(key)]),
  ) as unknown as { [K2 in K]: ReactiveFieldState<T[K2]> };

  const isValid: Derived<boolean> = derived(
    () => {
      for (const key of fieldKeys) {
        if (fields[key].error.get() !== null) return false;
      }
      return true;
    },
    { name: "form:isValid", owner: config.owner },
  );

  const isDirty: Derived<boolean> = derived(
    () => {
      for (const key of fieldKeys) {
        const fieldConfig = config.fields[key] as FormFieldConfig<T[K]>;
        if (!Object.is(fields[key].value.get(), fieldConfig.initial))
          return true;
      }
      return false;
    },
    { name: "form:isDirty", owner: config.owner },
  );

  const isSubmitting = cell<boolean>(false, {
    name: "form:isSubmitting",
    owner: config.owner,
  });

  const submitError = cell<string | null>(null, {
    name: "form:submitError",
    owner: config.owner,
  });

  function getValues(): T {
    const values = {} as T;
    for (const key of fieldKeys) {
      (values as Record<K, unknown>)[key] = fields[key].value.get();
    }
    return values;
  }

  function touchAll(): void {
    batch(() => {
      for (const key of fieldKeys) {
        fields[key].touched.set(true);
      }
    });
  }

  function reset(): void {
    batch(() => {
      for (const key of fieldKeys) {
        const fieldConfig = config.fields[key] as FormFieldConfig<T[K]>;
        fields[key].value.set(fieldConfig.initial);
        fields[key].touched.set(false);
      }
      // Clear server errors
      for (const key of fieldKeys) {
        delete serverErrors[key];
      }
      serverErrorVersion.set(serverErrorVersion.get() + 1);
      submitError.set(null);
      isSubmitting.set(false);
    });
  }

  function applyServerErrors(errors: Partial<Record<keyof T, string>>): void {
    batch(() => {
      for (const key of fieldKeys) {
        const err = errors[key];
        if (err !== undefined) {
          serverErrors[key] = err;
        } else {
          delete serverErrors[key];
        }
      }
      serverErrorVersion.set(serverErrorVersion.get() + 1);
    });
  }

  async function submit<R>(handler: (values: T) => Promise<R>): Promise<R> {
    submitError.set(null);
    isSubmitting.set(true);
    try {
      const result = await handler(getValues());
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      submitError.set(message);
      throw err;
    } finally {
      isSubmitting.set(false);
    }
  }

  return {
    fields,
    isValid,
    isDirty,
    isSubmitting,
    submitError,
    touchAll,
    reset,
    applyServerErrors,
    submit,
    getValues,
  };
}
