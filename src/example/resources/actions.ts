import { action } from "../../helix/index.js";
import { createUser, type CreateUserInput } from "../domain.js";
import { createPost, type CreatePostInput } from "./posts.resource.js";

export const createUserAction = action<
  CreateUserInput,
  { ok: true; id: number }
>(
  "create-user",
  async (input) => {
    const user = createUser(input);
    return { ok: true, id: user.id };
  },
  {
    where: "server",
    invalidates: ["users"],
    capabilities: ["users:write"],
    idempotency: "create-user",
  },
);

export const createPostAction = action<
  CreatePostInput,
  { ok: true; id: number }
>(
  "create-post",
  async (input) => {
    const post = await createPost(input);
    return { ok: true, id: post.id };
  },
  {
    where: "server",
    invalidates: ["posts"],
    capabilities: ["posts:write"],
    idempotency: "create-post",
  },
);
