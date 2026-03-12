import type { UserStats } from "../domain.js";
import { uiCard } from "../../helix/ui.js";
import { renderDashboardCompiledView } from "./compiled/dashboard.compiled.js";

function renderMetricCard(title: string, value: string): string {
  return uiCard({
    title,
    content: `<p class="stat-value">${value}</p>`,
    className: "stat-card",
  });
}

export function renderDashboardPage(stats: UserStats): string {
  const activationRate =
    stats.total > 0
      ? `${Math.round((stats.active / stats.total) * 100)}%`
      : "0%";

  return renderDashboardCompiledView({
    totalUsersCard: renderMetricCard("Total Users", String(stats.total)),
    activeUsersCard: renderMetricCard("Active Users", String(stats.active)),
    pendingUsersCard: renderMetricCard("Pending Users", String(stats.pending)),
    activationRateCard: renderMetricCard("Activation Rate", activationRate),
  });
}
