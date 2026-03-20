import { invalidateResourcesByTags, resource } from "../../helix/index.js";

export const POSTS_PAGE_SIZE = 10;

const POSTS_SEED_URL = "https://jsonplaceholder.typicode.com/posts";
const POSTS_FETCH_TIMEOUT_MS = 5_000;
const OFFLINE_POST_COUNT = 100;

export interface PostRow {
  id: number;
  userId: number;
  title: string;
  body: string;
}

export interface PostsPage {
  rows: PostRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface PostsContext {
  page: number;
  pageSize: number;
}

export interface CreatePostInput {
  userId: number;
  title: string;
  body: string;
}

let postsStore: PostRow[] | null = null;
let postsLoadPromise: Promise<PostRow[]> | null = null;

function createOfflineSeedPosts(count = OFFLINE_POST_COUNT): PostRow[] {
  const topics = [
    "Helix graph routing",
    "Server resource caching",
    "Optimistic mutations",
    "Progressive hydration",
    "Route graph snapshots",
    "Streaming HTML",
    "Compiled bindings",
    "Scheduler priorities",
    "Reactive dependencies",
    "Offline fallback flows",
  ];
  const focuses = [
    "keeps the demo usable without a network connection.",
    "highlights server-first rendering with cached data.",
    "documents how the example app recovers from fetch failures.",
    "shows how local state can seed subsequent mutations.",
    "captures a small note for the resource showcase.",
  ];

  return Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    const topic = topics[index % topics.length];
    const focus = focuses[Math.floor(index / topics.length) % focuses.length];

    return {
      id,
      userId: (index % 10) + 1,
      title: `Offline demo post ${id}: ${topic}`,
      body: `${topic} seed ${id} ${focus}`,
    };
  });
}

function isPostRow(value: unknown): value is PostRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PostRow>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.userId === "number" &&
    typeof candidate.title === "string" &&
    typeof candidate.body === "string"
  );
}

function extractSeedPosts(payload: unknown): PostRow[] | null {
  if (!Array.isArray(payload)) {
    return null;
  }

  const rows = payload.filter(isPostRow);
  return rows.length > 0 ? rows : null;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatFetchError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildPostsPage(
  allPosts: readonly PostRow[],
  page: number,
  pageSize: number,
): PostsPage {
  const total = allPosts.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const rows = allPosts.slice(start, start + pageSize);

  return { rows, page: safePage, pageSize, total, totalPages };
}

async function fetchSeedPosts(): Promise<PostRow[]> {
  try {
    const response = await fetchWithTimeout(
      POSTS_SEED_URL,
      POSTS_FETCH_TIMEOUT_MS,
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.status}`);
    }

    const payload = await response.json();
    const seedPosts = extractSeedPosts(payload);
    if (!seedPosts) {
      throw new Error("Posts seed response did not contain any valid rows");
    }

    return seedPosts;
  } catch (error) {
    console.warn(
      `[posts.resource] Falling back to offline seed posts: ${formatFetchError(error)}`,
    );
    return createOfflineSeedPosts();
  }
}

async function ensurePostsStore(): Promise<PostRow[]> {
  if (postsStore) {
    return postsStore;
  }

  if (!postsLoadPromise) {
    postsLoadPromise = fetchSeedPosts()
      .then((seedPosts) => {
        postsStore = [...seedPosts];
        postsLoadPromise = null;
        return postsStore;
      })
      .catch((error) => {
        postsLoadPromise = null;
        throw error;
      });
  }

  return postsLoadPromise;
}

export function setPostsStoreForTests(rows: PostRow[]): void {
  postsStore = [...rows];
  postsLoadPromise = null;
}

export function resetPostsStoreForTests(): void {
  postsStore = null;
  postsLoadPromise = null;
  invalidateResourcesByTags(["posts"]);
}

function resolveNextPostId(rows: readonly PostRow[]): number {
  const maxId = rows.reduce((highest, row) => Math.max(highest, row.id), 0);
  return maxId + 1;
}

export async function createPost(input: CreatePostInput): Promise<PostRow> {
  const rows = await ensurePostsStore();

  const created: PostRow = {
    id: resolveNextPostId(rows),
    userId: input.userId,
    title: input.title,
    body: input.body,
  };

  rows.unshift(created);
  return created;
}

function hasUniqueNumericIds(ids: readonly number[]): boolean {
  const seen = new Set<number>();
  for (const id of ids) {
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
      return false;
    }
    seen.add(id);
  }

  return true;
}

/**
 * Reorders the rows inside a single page window while preserving all rows
 * outside that page. Returns false when payload validation fails.
 */
export async function reorderPostsPageRows(
  page: number,
  pageSize: number,
  rowIds: number[],
): Promise<boolean> {
  const rows = await ensurePostsStore();
  if (!hasUniqueNumericIds(rowIds)) {
    return false;
  }

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize =
    Number.isFinite(pageSize) && pageSize > 0
      ? Math.floor(pageSize)
      : POSTS_PAGE_SIZE;

  const totalPages = Math.max(1, Math.ceil(rows.length / safePageSize));
  const clampedPage = Math.min(safePage, totalPages);
  const startIndex = (clampedPage - 1) * safePageSize;
  const currentSlice = rows.slice(startIndex, startIndex + safePageSize);

  if (currentSlice.length === 0 || rowIds.length !== currentSlice.length) {
    return false;
  }

  const currentIds = currentSlice.map((row) => row.id);
  const expectedIds = new Set(currentIds);
  for (const rowId of rowIds) {
    if (!expectedIds.has(rowId)) {
      return false;
    }
  }

  const rowById = new Map(currentSlice.map((row) => [row.id, row]));
  const reorderedSlice = rowIds
    .map((id) => rowById.get(id))
    .filter(Boolean) as PostRow[];
  if (reorderedSlice.length !== currentSlice.length) {
    return false;
  }

  rows.splice(startIndex, currentSlice.length, ...reorderedSlice);
  return true;
}

export const postsResource = resource<PostsPage, PostsContext>(
  "posts",
  ({ page, pageSize }) => ["posts", page, pageSize],
  async ({ page, pageSize }) => {
    const allPosts = await ensurePostsStore();
    return buildPostsPage(allPosts, page, pageSize);
  },
  {
    where: "server",
    cache: "memory",
    staleMs: 60_000,
    revalidateMs: 120_000,
    dedupe: "inflight",
    tags: ["posts"],
  },
);
