import type { FormActionError } from "../../helix/index.js";
import { sendJson, readJsonBody } from "../../helix/node-http.js";
import type { CreateUserInput } from "../domain.js";
import type { CreatePostInput } from "../resources/posts.resource.js";
export { sendJson, readJsonBody };

export function validateCreateUserInput(
  input: Partial<CreateUserInput>,
): FormActionError | null {
  const fieldErrors: Record<string, string> = {};
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  if (name.length < 2) fieldErrors.name = "Name must be at least 2 characters.";
  if (!email.includes("@") || email.length < 5)
    fieldErrors.email = "Enter a valid email address.";
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, formError: "Please fix the highlighted fields." };
  }
  return null;
}

export function validateCreatePostInput(
  input: Partial<CreatePostInput>,
): FormActionError | null {
  const fieldErrors: Record<string, string> = {};
  const title = input.title?.trim() ?? "";
  const body = input.body?.trim() ?? "";
  const userId = Number(input.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    fieldErrors.userId = "User ID must be a positive integer.";
  }

  if (title.length < 3) {
    fieldErrors.title = "Title must be at least 3 characters.";
  }

  if (body.length < 10) {
    fieldErrors.body = "Body must be at least 10 characters.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      formError: "Please fix the highlighted post fields.",
    };
  }

  return null;
}
