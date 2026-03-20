import type { ServerResponse } from "node:http";
import type { RouteContext } from "../../helix/index.js";
import { usersPageResource } from "../resources/users.resource.js";
import { createPostAction, createUserAction } from "../resources/actions.js";
import {
  EXTERNAL_PRODUCTS_PAGE_SIZE,
  externalProductsResource,
  getExternalProductDetailById,
  resolveExternalProductDetails,
} from "../resources/external-products.resource.js";
import {
  MONGO_AIRBNB_PAGE_SIZE,
  mongoAirbnbResource,
} from "../resources/mongo-airbnb.resource.js";
import {
  POSTS_PAGE_SIZE,
  reorderPostsPageRows,
  postsResource,
  type CreatePostInput,
} from "../resources/posts.resource.js";
import {
  getUserById,
  deleteUser,
  activateUser,
  updateUser,
  getUserStats,
  suggestUsers,
  type CreateUserInput,
  type UpdateUserInput,
} from "../domain.js";
import {
  sendJson,
  readJsonBody,
  validateCreatePostInput,
  validateCreateUserInput,
} from "../utils/http.js";
import {
  parsePage,
  resolveMongoAirbnbQuery,
  resolveExternalProductsQuery,
  resolveUsersQuery,
} from "../utils/query.js";

const invalidationStreamClients = new Set<ServerResponse>();

function publishInvalidationTags(tags: string[]): void {
  if (tags.length === 0) {
    return;
  }

  const payload = `data: ${JSON.stringify({ tags })}\n\n`;
  for (const client of invalidationStreamClients) {
    try {
      client.write(payload);
    } catch {
      invalidationStreamClients.delete(client);
    }
  }
}

export async function handleInvalidationStream(ctx: RouteContext): Promise<void> {
  ctx.response.statusCode = 200;
  ctx.response.setHeader("content-type", "text/event-stream; charset=utf-8");
  ctx.response.setHeader("cache-control", "no-cache, no-transform");
  ctx.response.setHeader("connection", "keep-alive");

  invalidationStreamClients.add(ctx.response);
  ctx.response.write(": connected\n\n");

  const heartbeat = setInterval(() => {
    if (!invalidationStreamClients.has(ctx.response)) {
      clearInterval(heartbeat);
      return;
    }

    try {
      ctx.response.write(": ping\n\n");
    } catch {
      invalidationStreamClients.delete(ctx.response);
      clearInterval(heartbeat);
    }
  }, 25_000);

  const detachClient = () => {
    invalidationStreamClients.delete(ctx.response);
    clearInterval(heartbeat);
  };

  ctx.request.on("close", detachClient);
  ctx.request.on("aborted", detachClient);
}

export async function handleUsersApi(ctx: RouteContext): Promise<void> {
  const query = resolveUsersQuery(ctx.url);
  const page = await usersPageResource.read(query);
  sendJson(ctx, 200, page);
}

export async function handleUsersSuggestApi(ctx: RouteContext): Promise<void> {
  const query = ctx.url.searchParams.get("q")?.trim() ?? "";
  sendJson(ctx, 200, {
    suggestions: suggestUsers(query, 8),
  });
}

export async function handleUserDetailApi(
  ctx: RouteContext<{ id: string }>,
): Promise<void> {
  const id = Number(ctx.params.id);
  const user = getUserById(id);
  sendJson(ctx, user ? 200 : 404, user ?? { error: "User not found" });
}

export async function handleCreateUser(ctx: RouteContext): Promise<void> {
  const input = await readJsonBody<Partial<CreateUserInput>>(ctx);
  const validationError = validateCreateUserInput(input);
  if (validationError) {
    sendJson(ctx, 400, validationError);
    return;
  }
  const safeInput: CreateUserInput = {
    name: input.name!.trim(),
    email: input.email!.trim(),
  };
  const result = await createUserAction.run(safeInput, {
    capabilities: ["users:write"],
  });
  publishInvalidationTags(["users"]);
  sendJson(ctx, 200, result);
}

export async function handleCreatePost(ctx: RouteContext): Promise<void> {
  const input = await readJsonBody<Partial<CreatePostInput>>(ctx);
  const validationError = validateCreatePostInput(input);
  if (validationError) {
    sendJson(ctx, 400, validationError);
    return;
  }

  const safeInput: CreatePostInput = {
    userId: Number(input.userId),
    title: input.title!.trim(),
    body: input.body!.trim(),
  };

  const result = await createPostAction.run(safeInput, {
    capabilities: ["posts:write"],
  });
  publishInvalidationTags(["posts"]);
  sendJson(ctx, 200, result);
}

export async function handleReorderPosts(ctx: RouteContext): Promise<void> {
  const input = await readJsonBody<{ page?: number; rowIds?: number[] }>(ctx);
  const page =
    typeof input.page === "number" && Number.isFinite(input.page)
      ? Math.floor(input.page)
      : 1;

  if (!Array.isArray(input.rowIds) || input.rowIds.length === 0) {
    sendJson(ctx, 400, { error: "rowIds is required" });
    return;
  }

  const rowIds = input.rowIds.map((id) => Number(id));
  if (
    rowIds.some((id) => !Number.isFinite(id) || id <= 0 || !Number.isInteger(id))
  ) {
    sendJson(ctx, 400, { error: "rowIds must contain positive integer ids" });
    return;
  }

  const reordered = await reorderPostsPageRows(page, POSTS_PAGE_SIZE, rowIds);
  if (!reordered) {
    sendJson(ctx, 400, {
      error: "Could not reorder rows for this page window",
    });
    return;
  }

  publishInvalidationTags(["posts"]);
  sendJson(ctx, 200, { ok: true });
}

export async function handleSubmitPrimitiveMessage(
  ctx: RouteContext,
): Promise<void> {
  const input = await readJsonBody<{ message?: string }>(ctx);
  const message = input.message?.trim() ?? "";

  if (!message) {
    sendJson(ctx, 400, { error: "Message is required" });
    return;
  }

  sendJson(ctx, 200, {
    thankYou: `Thank you for your input: ${message}`,
  });
}

export async function handleUserStats(ctx: RouteContext): Promise<void> {
  sendJson(ctx, 200, getUserStats());
}

export async function handleExternalDataApi(ctx: RouteContext): Promise<void> {
  const productsPage = await externalProductsResource.read(
    resolveExternalProductsQuery(ctx.url, EXTERNAL_PRODUCTS_PAGE_SIZE),
  );
  sendJson(ctx, 200, productsPage);
}

export async function handleExternalDataRichApi(
  ctx: RouteContext,
): Promise<void> {
  const productsPage = await externalProductsResource.read(
    resolveExternalProductsQuery(ctx.url, EXTERNAL_PRODUCTS_PAGE_SIZE),
  );
  const rows = await resolveExternalProductDetails(productsPage.rows);

  sendJson(ctx, 200, {
    ...productsPage,
    rows,
  });
}

export async function handleHostListingsApi(ctx: RouteContext): Promise<void> {
  const productsPage = await externalProductsResource.read(
    resolveExternalProductsQuery(ctx.url, EXTERNAL_PRODUCTS_PAGE_SIZE),
  );
  const rows = await resolveExternalProductDetails(productsPage.rows);

  sendJson(ctx, 200, {
    ...productsPage,
    rows,
  });
}

export async function handleMongoAirbnbApi(ctx: RouteContext): Promise<void> {
  const listingsPage = await mongoAirbnbResource.read(
    resolveMongoAirbnbQuery(ctx.url, MONGO_AIRBNB_PAGE_SIZE),
  );

  sendJson(ctx, 200, listingsPage);
}

export async function handlePostsApi(ctx: RouteContext): Promise<void> {
  const page = parsePage(ctx.url.searchParams.get("page"));
  const postsPage = await postsResource.read({
    page,
    pageSize: POSTS_PAGE_SIZE,
  });
  sendJson(ctx, 200, postsPage);
}

export async function handleExternalDataDetailApi(
  ctx: RouteContext<{ id: string }>,
): Promise<void> {
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

export async function handleDeleteUser(
  ctx: RouteContext<{ id: string }>,
): Promise<void> {
  const id = Number(ctx.params.id);
  const deleted = deleteUser(id);
  if (deleted) {
    publishInvalidationTags(["users"]);
    ctx.response.statusCode = 303;
    ctx.response.setHeader("location", "/");
    ctx.response.end();
  } else {
    sendJson(ctx, 404, { error: "User not found" });
  }
}

export async function handleActivateUser(
  ctx: RouteContext<{ id: string }>,
): Promise<void> {
  const id = Number(ctx.params.id);
  const user = activateUser(id);
  if (user) {
    publishInvalidationTags(["users"]);
    ctx.response.statusCode = 200;
    ctx.response.setHeader("location", `/users/${id}`);
    ctx.response.end();
  } else {
    sendJson(ctx, 404, { error: "User not found" });
  }
}

export async function handleUpdateUser(
  ctx: RouteContext<{ id: string }>,
): Promise<void> {
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    ctx.response.statusCode = 400;
    ctx.response.end("Invalid user ID");
    return;
  }

  let user = getUserById(id);
  if (!user) {
    ctx.response.statusCode = 404;
    ctx.response.end("User not found");
    return;
  }

  const input = await readJsonBody<Partial<UpdateUserInput>>(ctx);
  user =
    updateUser(id, {
      name: input.name?.trim(),
      email: input.email?.trim(),
      status: input.status,
    }) ?? user;
  publishInvalidationTags(["users"]);
  sendJson(ctx, 200, user);
}
