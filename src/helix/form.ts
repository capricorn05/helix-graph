import type { PatchOp } from "./types.js";

export interface FormField {
  name: string;
  value: string;
  errors?: string[];
}

export interface FormState {
  fields: Map<string, FormField>;
  isSubmitting: boolean;
  submitError?: string;
  transaction?: {
    originalValues: Record<string, string>;
    optimisticValues: Record<string, string>;
  };
}

export interface ValidationRule {
  validate: (value: string) => string | null;
  trigger?: "blur" | "change" | "submit";
}

export interface FormConfig {
  rules: Record<string, ValidationRule[]>;
}

export class HelixForm {
  private formElement: HTMLFormElement;
  private config: FormConfig;
  private state: FormState = {
    fields: new Map(),
    isSubmitting: false
  };

  constructor(formElement: HTMLFormElement, config: FormConfig) {
    this.formElement = formElement;
    this.config = config;
    this.initializeFields();
    this.attachValidators();
  }

  private initializeFields(): void {
    const inputs = this.formElement.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input[name], textarea[name], select[name]"
    );

    for (const input of inputs) {
      const name = input.name;
      this.state.fields.set(name, {
        name,
        value: input.value,
        errors: []
      });
    }
  }

  private attachValidators(): void {
    for (const [fieldName, rules] of Object.entries(this.config.rules)) {
      const input = this.formElement.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `input[name="${fieldName}"], textarea[name="${fieldName}"]`
      );

      if (!input) continue;

      for (const rule of rules) {
        const trigger = rule.trigger ?? "blur";

        input.addEventListener(trigger, () => {
          const errors = this.validateField(fieldName, input.value);
          this.updateFieldErrors(fieldName, errors);
        });
      }
    }
  }

  validateField(fieldName: string, value: string): string[] {
    const rules = this.config.rules[fieldName] ?? [];
    const errors: string[] = [];

    for (const rule of rules) {
      const error = rule.validate(value);
      if (error) {
        errors.push(error);
      }
    }

    return errors;
  }

  validateAll(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    for (const [fieldName, field] of this.state.fields) {
      const fieldErrors = this.validateField(fieldName, field.value);
      if (fieldErrors.length > 0) {
        errors[fieldName] = fieldErrors;
      }
    }

    return errors;
  }

  private updateFieldErrors(fieldName: string, errors: string[]): void {
    const field = this.state.fields.get(fieldName);
    if (field) {
      field.errors = errors;
      this.state.fields.set(fieldName, field);
    }
  }

  getField(fieldName: string): FormField | undefined {
    return this.state.fields.get(fieldName);
  }

  getFormData(): Record<string, string> {
    const data: Record<string, string> = {};
    for (const [name, field] of this.state.fields) {
      data[name] = field.value;
    }
    return data;
  }

  setFieldValue(fieldName: string, value: string): void {
    const field = this.state.fields.get(fieldName);
    if (field) {
      field.value = value;
    }
  }

  async submitWithOptimism(
    handler: (data: Record<string, string>) => Promise<any>,
    onError?: (error: any) => void
  ): Promise<void> {
    const validationErrors = this.validateAll();
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    this.state.isSubmitting = true;
    const data = this.getFormData();

    // Save original values for rollback
    this.state.transaction = {
      originalValues: { ...data },
      optimisticValues: { ...data }
    };

    try {
      await handler(data);
      this.state.transaction = undefined;
    } catch (error) {
      // Rollback
      if (this.state.transaction?.originalValues) {
        for (const [key, value] of Object.entries(this.state.transaction.originalValues)) {
          this.setFieldValue(key, value);
        }
      }
      if (onError) {
        onError(error);
      }
    } finally {
      this.state.isSubmitting = false;
    }
  }

  getPatches(targetIdPrefix: string): PatchOp[] {
    const patches: PatchOp[] = [];

    for (const [fieldName, field] of this.state.fields) {
      const errorId = `${targetIdPrefix}-${fieldName}`;
      const errorText = field.errors?.join("; ") ?? "";

      patches.push({
        op: "setText",
        targetId: errorId,
        value: errorText
      });

      patches.push({
        op: "setAttr",
        targetId: fieldName,
        name: "aria-invalid",
        value: field.errors && field.errors.length > 0 ? "true" : null
      });
    }

    return patches;
  }
}

export const commonValidators = {
  required: (fieldName: string): ValidationRule => ({
    validate: (value: string) => {
      return value.trim().length === 0 ? `${fieldName} is required.` : null;
    },
    trigger: "blur"
  }),

  minLength: (fieldName: string, length: number): ValidationRule => ({
    validate: (value: string) => {
      return value.length < length ? `${fieldName} must be at least ${length} characters.` : null;
    },
    trigger: "blur"
  }),

  email: (): ValidationRule => ({
    validate: (value: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return !emailRegex.test(value) ? "Enter a valid email address." : null;
    },
    trigger: "blur"
  }),

  pattern: (fieldName: string, pattern: RegExp, message: string): ValidationRule => ({
    validate: (value: string) => {
      return !pattern.test(value) ? message : null;
    },
    trigger: "blur"
  }),

  custom: (validator: (value: string) => string | null): ValidationRule => ({
    validate: validator,
    trigger: "blur"
  })
};
