import type { BindingMap } from "../../../helix/types.js";
import {
  renderCompiledView,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {},
};

export const postsCompiledArtifact: CompiledViewArtifact<any> = {
  template: "<section><h2>Posts</h2>__HX_HTML_posts_1_hx-posts-slot-1__<div class=\"pager\">__HX_HTML_posts_2_hx-posts-slot-2__<span data-hx-id=\"posts-page-label\">Page <span data-hx-id=\"hx-posts-slot-3\">__HX_TEXT_posts_3_hx-posts-slot-3__</span>/ <span data-hx-id=\"hx-posts-slot-4\">__HX_TEXT_posts_4_hx-posts-slot-4__</span></span>__HX_HTML_posts_5_hx-posts-slot-5__<span data-hx-id=\"posts-total-label\">(<span data-hx-id=\"hx-posts-slot-6\">__HX_TEXT_posts_6_hx-posts-slot-6__</span>total)</span><span data-hx-id=\"posts-page-state\" data-page=\"__HX_ATTR_posts_data-page_7_posts-page-state__\" data-page-size=\"__HX_ATTR_posts_data-page-size_8_posts-page-state__\" data-total=\"__HX_ATTR_posts_data-total_9_posts-page-state__\" data-total-pages=\"__HX_ATTR_posts_data-total-pages_10_posts-page-state__\" hidden></span></div></section>",
  patches: [
    {
      kind: "html",
      token: "__HX_HTML_posts_1_hx-posts-slot-1__",
      targetId: "hx-posts-slot-1",
      evaluate: (props: any) => (props.tableHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_posts_2_hx-posts-slot-2__",
      targetId: "hx-posts-slot-2",
      evaluate: (props: any) => (props.prevButtonHtml),
    },
    {
      kind: "text",
      token: "__HX_TEXT_posts_3_hx-posts-slot-3__",
      targetId: "hx-posts-slot-3",
      evaluate: (props: any) => (props.page),
    },
    {
      kind: "text",
      token: "__HX_TEXT_posts_4_hx-posts-slot-4__",
      targetId: "hx-posts-slot-4",
      evaluate: (props: any) => (props.totalPages),
    },
    {
      kind: "html",
      token: "__HX_HTML_posts_5_hx-posts-slot-5__",
      targetId: "hx-posts-slot-5",
      evaluate: (props: any) => (props.nextButtonHtml),
    },
    {
      kind: "text",
      token: "__HX_TEXT_posts_6_hx-posts-slot-6__",
      targetId: "hx-posts-slot-6",
      evaluate: (props: any) => (props.total),
    },
    {
      kind: "attr",
      token: "__HX_ATTR_posts_data-page_7_posts-page-state__",
      targetId: "posts-page-state",
      attrName: "data-page",
      evaluate: (props: any) => (props.page),
    },
    {
      kind: "attr",
      token: "__HX_ATTR_posts_data-page-size_8_posts-page-state__",
      targetId: "posts-page-state",
      attrName: "data-page-size",
      evaluate: (props: any) => (props.pageSize),
    },
    {
      kind: "attr",
      token: "__HX_ATTR_posts_data-total_9_posts-page-state__",
      targetId: "posts-page-state",
      attrName: "data-total",
      evaluate: (props: any) => (props.total),
    },
    {
      kind: "attr",
      token: "__HX_ATTR_posts_data-total-pages_10_posts-page-state__",
      targetId: "posts-page-state",
      attrName: "data-total-pages",
      evaluate: (props: any) => (props.totalPages),
    }
  ],
  bindingMap: compiledBindingMap,
};

export function renderPostsCompiledView(props: any): string {
  return renderCompiledView(postsCompiledArtifact, props);
}

export function buildPostsCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const postsCompiledPatchTable = postsCompiledArtifact.patches;
