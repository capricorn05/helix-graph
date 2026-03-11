import type { FormActionError } from "../../helix/index.js";
import { sendJson, readJsonBody } from "../../helix/node-http.js";
import type { CreateUserInput } from "../domain.js";
export { sendJson, readJsonBody };

export function validateCreateUserInput(input: Partial<CreateUserInput>): FormActionError | null {
  const fieldErrors: Record<string, string> = {};
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  if (name.length < 2) fieldErrors.name = "Name must be at least 2 characters.";
  if (!email.includes("@") || email.length < 5) fieldErrors.email = "Enter a valid email address.";
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, formError: "Please fix the highlighted fields." };
  }
  return null;
}
