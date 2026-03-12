export interface InteractionsPageProps {
  resetButtonHtml: string;
}

export default function InteractionsPageView(props: InteractionsPageProps) {
  return (
    <>
      <p>
        Trial interactive behavior with a drag-and-drop list while keeping the
        page server-rendered.
      </p>

      <section data-hx-id="trial-dnd-root">
        <h2>Drag and Drop Trial</h2>
        <p>
          Drag rows to reorder priorities. This interaction runs fully in the
          browser and updates state in-place.
        </p>

        <div class="toolbar">
          <hx-slot value={props.resetButtonHtml} />
        </div>

        <table>
          <thead>
            <tr>
              <th>Priority</th>
              <th>Experiment</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody data-hx-id="trial-dnd-list" data-hx-list="trial-dnd-list">
            <tr
              draggable="true"
              data-hx-key="signup-flow"
              data-dnd-id="signup-flow"
              data-dnd-label="Sign-up flow"
              data-dnd-initial-index="1"
            >
              <td data-dnd-role="position">1</td>
              <td>Sign-up flow</td>
              <td>Reduce first-time drop-off in onboarding.</td>
            </tr>
            <tr
              draggable="true"
              data-hx-key="profile-completion"
              data-dnd-id="profile-completion"
              data-dnd-label="Profile completion"
              data-dnd-initial-index="2"
            >
              <td data-dnd-role="position">2</td>
              <td>Profile completion</td>
              <td>Increase captured profile details after registration.</td>
            </tr>
            <tr
              draggable="true"
              data-hx-key="checkout-funnel"
              data-dnd-id="checkout-funnel"
              data-dnd-label="Checkout funnel"
              data-dnd-initial-index="3"
            >
              <td data-dnd-role="position">3</td>
              <td>Checkout funnel</td>
              <td>Improve purchase completion through fewer steps.</td>
            </tr>
            <tr
              draggable="true"
              data-hx-key="referral-prompt"
              data-dnd-id="referral-prompt"
              data-dnd-label="Referral prompt"
              data-dnd-initial-index="4"
            >
              <td data-dnd-role="position">4</td>
              <td>Referral prompt</td>
              <td>Test invite conversion for existing active users.</td>
            </tr>
          </tbody>
        </table>

        <p data-hx-id="trial-dnd-status" aria-live="polite">
          Drag any row to reprioritize the list.
        </p>
        <p data-hx-id="trial-dnd-order" aria-live="polite">
          Current order: Sign-up flow → Profile completion → Checkout funnel →
          Referral prompt
        </p>
      </section>
    </>
  );
}
