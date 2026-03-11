import type { RouteContext } from "../../helix/index.js";
import { usersPageResource } from "../resources/users.resource.js";
import { createUserAction } from "../resources/actions.js";
import {
  EXTERNAL_PRODUCTS_PAGE_SIZE,
  externalProductsResource,
  getExternalProductDetailById
} from "../resources/external-products.resource.js";
import { POSTS_PAGE_SIZE, postsResource } from "../resources/posts.resource.js";
import { getUserById, deleteUser, activateUser, updateUser, getUserStats, type CreateUserInput, type UpdateUserInput } from "../domain.js";
import { sendJson, readJsonBody, validateCreateUserInput } from "../utils/http.js";
import { parsePage, resolveUsersQuery } from "../utils/query.js";

export async function handleUsersApi(ctx: RouteContext): Promise<void> {
  const query = resolveUsersQuery(ctx.url);
  const page  = await usersPageResource.read(query);
  sendJson(ctx, 200, page);
}

export async function handleUserDetailApi(ctx: RouteContext<{ id: string }>): Promise<void> {
  const id   = Number(ctx.params.id);
  const user = getUserById(id);
  sendJson(ctx, user ? 200 : 404, user ?? { error: "User not found" });
}

export async function handleCreateUser(ctx: RouteContext): Promise<void> {
  const input = await readJsonBody<Partial<CreateUserInput>>(ctx);
  const validationError = validateCreateUserInput(input);
  if (validationError) { sendJson(ctx, 400, validationError); return; }
  const safeInput: CreateUserInput = { name: input.name!.trim(), email: input.email!.trim() };
  const result = await createUserAction.run(safeInput, { capabilities: ["users:write"] });
  sendJson(ctx, 200, result);
}

export async function handleUserStats(ctx: RouteContext): Promise<void> {
  sendJson(ctx, 200, getUserStats());
}

export async function handleExternalDataApi(ctx: RouteContext): Promise<void> {
  const page = parsePage(ctx.url.searchParams.get("page"));
  const productsPage = await externalProductsResource.read({
    page,
    pageSize: EXTERNAL_PRODUCTS_PAGE_SIZE
  });
  sendJson(ctx, 200, productsPage);
}

export async function handlePostsApi(ctx: RouteContext): Promise<void> {
  const page = parsePage(ctx.url.searchParams.get("page"));
  const postsPage = await postsResource.read({ page, pageSize: POSTS_PAGE_SIZE });
  sendJson(ctx, 200, postsPage);
}

export async function handleExternalDataDetailApi(ctx: RouteContext<{ id: string }>): Promise<void> {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    sendJson(ctx, 400, { error: "Invalid row id" });
    return;
  }

  const detail = await getExternalProductDetailById(id);
  if (!detail) {
    sendJson(ctx, 404, { error: "Row not found" });
    return;
  }

  sendJson(ctx, 200, detail);
}

export async function handleDeleteUser(ctx: RouteContext<{ id: string }>): Promise<void> {
  const id      = Number(ctx.params.id);
  const deleted = deleteUser(id);
  if (deleted) {
    ctx.response.statusCode = 303;
    ctx.response.setHeader("location", "/");
    ctx.response.end();
  } else {
    sendJson(ctx, 404, { error: "User not found" });
  }
}

export async function handleActivateUser(ctx: RouteContext<{ id: string }>): Promise<void> {
  const id   = Number(ctx.params.id);
  const user = activateUser(id);
  if (user) {
    ctx.response.statusCode = 200;
    ctx.response.setHeader("location", `/users/${id}`);
    ctx.response.end();
  } else {
    sendJson(ctx, 404, { error: "User not found" });
  }
}

export async function handleUpdateUser(ctx: RouteContext<{ id: string }>): Promise<void> {
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) { ctx.response.statusCode = 400; ctx.response.end("Invalid user ID"); return; }

  let user = getUserById(id);
  if (!user) { ctx.response.statusCode = 404; ctx.response.end("User not found"); return; }

  const input = await readJsonBody<Partial<UpdateUserInput>>(ctx);
  user = updateUser(id, { name: input.name?.trim(), email: input.email?.trim(), status: input.status }) ?? user;
  sendJson(ctx, 200, user);
}
