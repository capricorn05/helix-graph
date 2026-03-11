import { uiInput, uiSelect } from "../../helix/ui.js";

export function renderSettingsPage(): string {
  return `
  <p>Configure application settings and preferences.</p>

  <section>
    <h2>User Management Settings</h2>
    <form method="POST" action="/settings" novalidate>
      <label>
        ${uiInput({ name: "auto-activate", type: "checkbox", checked: true, disabled: true })}
        Auto-activate new users (read-only)
      </label>
      <label>
        Max users per page
        ${uiSelect({
          name: "page-size",
          disabled: true,
          options: [
            { value: "6", label: "6", selected: true },
            { value: "12", label: "12" },
            { value: "24", label: "24" },
          ],
        })}
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
  </section>`;
}
