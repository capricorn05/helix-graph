import { resource } from "../../helix/index.js";
import { getUserById, listUsersPage, type User, type UsersPage } from "../domain.js";
import type { UsersResourceContext } from "../utils/query.js";

export const usersPageResource = resource<UsersPage, UsersResourceContext>(
  "users-page",
  ({ page, pageSize, sortCol, sortDir }) => ["users", page, pageSize, sortCol, sortDir],
  async ({ page, pageSize, sortCol, sortDir }) => {
    await new Promise((resolve) => setTimeout(resolve, 25));
    return listUsersPage(page, pageSize, sortCol, sortDir);
  },
  {
    where: "server",
    cache: "memory",
    staleMs: 2000,
    revalidateMs: 5000,
    dedupe: "inflight",
    tags: ["users"]
  }
);

export const userDetailResource = resource<User | null, { id: number }>(
  "user-detail",
  ({ id }) => ["user", id],
  async ({ id }) => getUserById(id) ?? null,
  {
    where: "server",
    cache: "memory",
    staleMs: 5000,
    tags: ["users"]
  }
);
