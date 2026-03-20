import type { PostRow, PostsPage } from "../resources/posts.resource.js";
import { uiButton } from "../../helix/ui.js";
import { uiDataTable } from "../../helix/components/table.js";
import type { UIDataTableColumnDef } from "../../helix/components/table.js";
import { renderPostsCompiledView } from "./compiled/posts.compiled.js";

const postsColumns: UIDataTableColumnDef<PostRow>[] = [
  {
    id: "id",
    header: "ID",
    accessorKey: "id",
    cellAttrs: ({ row }) => ({ "data-hx-id": `post-row-${row.id}-id` }),
  },
  {
    id: "userId",
    header: "User",
    accessorKey: "userId",
    cellAttrs: ({ row }) => ({ "data-hx-id": `post-row-${row.id}-userId` }),
  },
  {
    id: "title",
    header: "Title",
    accessorKey: "title",
    cellAttrs: ({ row }) => ({ "data-hx-id": `post-row-${row.id}-title` }),
  },
  {
    id: "body",
    header: "Body",
    cell: ({ row }) =>
      row.body.slice(0, 80) + (row.body.length > 80 ? "…" : ""),
    cellAttrs: ({ row }) => ({ "data-hx-id": `post-row-${row.id}-body` }),
  },
  {
    id: "reorder",
    header: "",
    cell: ({ row }) =>
      `<button class="reorder-btn" data-reorder-dir="up" data-post-id="${row.id}" aria-label="Move post ${row.id} up" title="Move up">▲</button>` +
      `<button class="reorder-btn" data-reorder-dir="down" data-post-id="${row.id}" aria-label="Move post ${row.id} down" title="Move down">▼</button>`,
    wrap: false,
    cellAttrs: { class: "reorder-cell" },
  },
];

export function renderPostsPage(page: PostsPage): string {
  const tableHtml = uiDataTable({
    data: page.rows,
    columns: postsColumns,
    rowAttrs: (row) => ({
      "data-hx-key": row.id,
      "data-post-id": row.id,
      draggable: "true",
      class: "posts-row",
    }),
    bodyAttrs: {
      "data-hx-id": "posts-body",
      "data-hx-list": "posts-body",
    },
  });

  return renderPostsCompiledView({
    tableHtml,
    prevButtonHtml: uiButton({
      label: "← Prev",
      bind: "posts-page-prev",
      variant: "secondary",
      disabled: page.page <= 1,
      attrs: { "data-hx-id": "posts-prev-btn" },
    }),
    nextButtonHtml: uiButton({
      label: "Next →",
      bind: "posts-page-next",
      variant: "secondary",
      disabled: page.page >= page.totalPages,
      attrs: { "data-hx-id": "posts-next-btn" },
    }),
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    totalPages: page.totalPages,
  });
}
