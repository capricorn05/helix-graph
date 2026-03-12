export interface DashboardPageProps {
  totalUsersCard: string;
  activeUsersCard: string;
  pendingUsersCard: string;
  activationRateCard: string;
}

export default function DashboardPageView(props: DashboardPageProps) {
  return (
    <>
      <p>System overview and key metrics.</p>

      <section className="stats-grid">
        <hx-slot value={props.totalUsersCard} />
        <hx-slot value={props.activeUsersCard} />
        <hx-slot value={props.pendingUsersCard} />
        <hx-slot value={props.activationRateCard} />
      </section>
    </>
  );
}
