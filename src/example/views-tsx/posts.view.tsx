export interface PostsPageViewProps {
  tableHtml: string;
  prevButtonHtml: string;
  nextButtonHtml: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function PostsPageView(props: PostsPageViewProps) {
  return (
    <section>
      <h2>Posts</h2>
      <hx-slot value={props.tableHtml} />

      <div className="pager">
        <hx-slot value={props.prevButtonHtml} />
        <span data-hx-id="posts-page-label">
          Page {props.page} / {props.totalPages}
        </span>
        <hx-slot value={props.nextButtonHtml} />
        <span data-hx-id="posts-total-label">({props.total} total)</span>
        <span
          data-hx-id="posts-page-state"
          data-page={props.page}
          data-page-size={props.pageSize}
          data-total={props.total}
          data-total-pages={props.totalPages}
          hidden
        ></span>
      </div>
    </section>
  );
}
