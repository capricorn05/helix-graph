import type { BindingMap } from "../../../helix/types.js";
import {
  renderCompiledView,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

const compiledBindingMap: BindingMap = {
  events: {
    "create-post": {
      id: "create-post",
      event: "submit",
      actionId: "createPost",
      chunk: "/client/actions.js",
      handlerExport: "onCreatePost",
      preventDefault: true,
    }
  },
  lists: {},
};

export const postsCreateCompiledArtifact: CompiledViewArtifact<any> = {
  template: "<section><h2>Create Post</h2><p>Add a new post to the server-backed posts dataset.</p><form data-hx-id=\"create-post-form\" data-hx-bind=\"create-post\" novalidate><label>User ID\n          __HX_HTML_posts-create_1_hx-posts-create-slot-1__</label><p class=\"error\" data-hx-id=\"create-post-error-user-id\"></p><label>Title\n          __HX_HTML_posts-create_2_hx-posts-create-slot-2__</label><p class=\"error\" data-hx-id=\"create-post-error-title\"></p><label>Body\n          <textarea name=\"body\" rows=\"6\" data-hx-id=\"create-post-body-input\" placeholder=\"Write the post content\" required></textarea></label><p class=\"error\" data-hx-id=\"create-post-error-body\"></p>__HX_HTML_posts-create_3_hx-posts-create-slot-3__<p class=\"error\" data-hx-id=\"create-post-error-form\"></p><p data-hx-id=\"create-post-status\"></p></form></section>",
  patches: [
    {
      kind: "html",
      token: "__HX_HTML_posts-create_1_hx-posts-create-slot-1__",
      targetId: "hx-posts-create-slot-1",
      evaluate: (props: any) => (props.userIdInputHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_posts-create_2_hx-posts-create-slot-2__",
      targetId: "hx-posts-create-slot-2",
      evaluate: (props: any) => (props.titleInputHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_posts-create_3_hx-posts-create-slot-3__",
      targetId: "hx-posts-create-slot-3",
      evaluate: (props: any) => (props.submitButtonHtml),
    }
  ],
  bindingMap: compiledBindingMap,
};

export function renderPostsCreateCompiledView(props: any): string {
  return renderCompiledView(postsCreateCompiledArtifact, props);
}

export function buildPostsCreateCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const postsCreateCompiledPatchTable = postsCreateCompiledArtifact.patches;
