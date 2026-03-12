export interface UsersPageContentViewProps {
  usersSectionHtml: string;
  nameInputHtml: string;
  emailInputHtml: string;
  submitButtonHtml: string;
  summaryPanelButtonHtml: string;
  reportsPanelButtonHtml: string;
  externalDataPanelButtonHtml: string;
  helpPanelButtonHtml: string;
}

export default function UsersPageContentView(props: UsersPageContentViewProps) {
  return (
    <>
      <p>Streaming SSR + resumable activation + patch-first updates.</p>

      <hx-slot value={props.usersSectionHtml} />

      <section>
        <h2>Add user</h2>
        <form data-hx-id="create-user-form" data-hx-bind="create-user" novalidate>
          <label>
            Name
            <hx-slot value={props.nameInputHtml} />
          </label>
          <p className="error" data-hx-id="error-name"></p>
          <label>
            Email
            <hx-slot value={props.emailInputHtml} />
          </label>
          <p className="error" data-hx-id="error-email"></p>
          <hx-slot value={props.submitButtonHtml} />
          <p className="error" data-hx-id="error-form"></p>
          <p data-hx-id="form-status"></p>
        </form>
      </section>

      <section>
        <h2>Live component load</h2>
        <p>Load server-rendered content into this section without a full page reload.</p>
        <div className="toolbar">
          <hx-slot value={props.summaryPanelButtonHtml} />
          <hx-slot value={props.reportsPanelButtonHtml} />
          <hx-slot value={props.externalDataPanelButtonHtml} />
          <hx-slot value={props.helpPanelButtonHtml} />
        </div>
        <div data-hx-id="users-live-panel" aria-live="polite">
          <p>Select a panel above to load this section in place.</p>
        </div>
      </section>
    </>
  );
}
