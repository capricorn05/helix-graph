export interface ReportsSummaryProps {
  activeUsersOnPage: number;
  pendingUsersOnPage: number;
  totalPages: number;
  page: number;
}

export default function ReportsSummaryView(props: ReportsSummaryProps) {
  return (
    <>
      <section>
        <h2>User Distribution</h2>
        <dl>
          <dt>Active Users</dt>
          <dd>
            {props.activeUsersOnPage}
            {" "}
            on current page
          </dd>
          <dt>Pending Users</dt>
          <dd>
            {props.pendingUsersOnPage}
            {" "}
            on current page
          </dd>
          <dt>Total Pages</dt>
          <dd>{props.totalPages}</dd>
        </dl>
      </section>

      <section>
        <h2>Sample Users on Page {props.page}</h2>
      </section>
    </>
  );
}
