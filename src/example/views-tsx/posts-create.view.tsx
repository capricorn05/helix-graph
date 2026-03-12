export interface PostsCreatePageViewProps {
  userIdInputHtml: string;
  titleInputHtml: string;
  submitButtonHtml: string;
}

export default function PostsCreatePageView(props: PostsCreatePageViewProps) {
  return (
    <section>
      <h2>Create Post</h2>
      <p>Add a new post to the server-backed posts dataset.</p>

      <form data-hx-id="create-post-form" data-hx-bind="create-post" novalidate>
        <label>
          User ID
          <hx-slot value={props.userIdInputHtml} />
        </label>
        <p className="error" data-hx-id="create-post-error-user-id"></p>

        <label>
          Title
          <hx-slot value={props.titleInputHtml} />
        </label>
        <p className="error" data-hx-id="create-post-error-title"></p>

        <label>
          Body
          <textarea
            name="body"
            rows="6"
            data-hx-id="create-post-body-input"
            placeholder="Write the post content"
            required
          ></textarea>
        </label>
        <p className="error" data-hx-id="create-post-error-body"></p>

        <hx-slot value={props.submitButtonHtml} />
        <p className="error" data-hx-id="create-post-error-form"></p>
        <p data-hx-id="create-post-status"></p>
      </form>
    </section>
  );
}
