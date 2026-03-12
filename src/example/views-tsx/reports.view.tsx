export interface ReportsPageViewProps {
  summarySection: string;
  usersTable: string;
}

export default function ReportsPageView(props: ReportsPageViewProps) {
  return (
    <>
      <p>User activity and system reports.</p>

      <hx-slot value={props.summarySection} />

      <section>
        <hx-slot value={props.usersTable} />
      </section>

      <section>
        <h2>Export Options</h2>
        <p>Reports are currently view-only. Export to CSV or JSON coming soon.</p>
      </section>
    </>
  );
}
