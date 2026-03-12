import { uiButton, uiInput } from "../../helix/ui.js";
import { renderPostsCreateCompiledView } from "./compiled/posts-create.compiled.js";

export function renderPostsCreatePage(): string {
  return renderPostsCreateCompiledView({
    userIdInputHtml: uiInput({
      name: "userId",
      type: "number",
      required: true,
      attrs: {
        min: 1,
        step: 1,
        "data-hx-id": "create-post-user-id-input",
      },
    }),
    titleInputHtml: uiInput({
      name: "title",
      required: true,
      attrs: {
        maxlength: 120,
        "data-hx-id": "create-post-title-input",
        placeholder: "Post title",
      },
    }),
    submitButtonHtml: uiButton({
      label: "Create Post",
      type: "submit",
      attrs: { "data-hx-id": "submit-create-post" },
    }),
  });
}
