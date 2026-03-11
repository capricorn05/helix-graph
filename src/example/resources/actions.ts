import { action } from "../../helix/index.js";
import { createUser, type CreateUserInput } from "../domain.js";

export const createUserAction = action<CreateUserInput, { ok: true; id: number }>(
  "create-user",
  async (input) => {
    const user = createUser(input);
    return { ok: true, id: user.id };
  },
  {
    where: "server",
    invalidates: ["users"],
    capabilities: ["users:write"],
    idempotency: "create-user"
  }
);
