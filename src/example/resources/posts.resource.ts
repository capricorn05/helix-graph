import { resource } from "../../helix/index.js";

export const POSTS_PAGE_SIZE = 10;

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

export const postsResource = resource<PostsPage, PostsContext>(
  "posts",
  ({ page, pageSize }) => ["posts", page, pageSize],
  async ({ page, pageSize }) => {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts");
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.status}`);
    }

    const allPosts = (await response.json()) as PostRow[];
    const total = allPosts.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    const rows = allPosts.slice(start, start + pageSize);

    return { rows, page: safePage, pageSize, total, totalPages };
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
