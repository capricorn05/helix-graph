export interface SettingsPageProps {
  autoActivateInputHtml: string;
  pageSizeSelectHtml: string;
}

export default function SettingsPageView(props: SettingsPageProps) {
  return (
    <>
      <p>Configure application settings and preferences.</p>

      <section>
        <h2>User Management Settings</h2>
        <form method="POST" action="/settings" novalidate>
          <label>
            <hx-slot value={props.autoActivateInputHtml} />
            Auto-activate new users (read-only)
          </label>
          <label>
            Max users per page
            <hx-slot value={props.pageSizeSelectHtml} />
          </label>
          <p style="opacity: 0.6; font-size: 0.9rem;">
            Note: These settings are read-only in demo mode.
          </p>
        </form>
      </section>

      <section>
        <h2>API Configuration</h2>
        <dl>
          <dt>Cache Duration</dt>
          <dd>2 seconds (users), 5 seconds (user detail)</dd>
          <dt>Revalidation</dt>
          <dd>5 seconds</dd>
          <dt>Deduplication</dt>
          <dd>Inflight requests</dd>
        </dl>
      </section>
    </>
  );
}
