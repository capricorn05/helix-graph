import type { UserStats } from "../domain.js";
import { uiCard } from "../../helix/ui.js";

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

  return `
  <p>System overview and key metrics.</p>

  <section class="stats-grid">
    ${renderMetricCard("Total Users", String(stats.total))}
    ${renderMetricCard("Active Users", String(stats.active))}
    ${renderMetricCard("Pending Users", String(stats.pending))}
    ${renderMetricCard("Activation Rate", activationRate)}
  </section>`;
}
