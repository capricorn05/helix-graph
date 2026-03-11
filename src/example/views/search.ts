import { uiButton, uiInput } from "../../helix/ui.js";

export function renderSearchPage(): string {
  return `
  <p>Find users by name or email.</p>

  <section>
    <form method="GET" action="/search" novalidate>
      <label>
        Search
        ${uiInput({
          name: "q",
          placeholder: "Enter name or email...",
          attrs: { autofocus: true },
        })}
      </label>
      ${uiButton({ label: "Search", type: "submit" })}
    </form>
  </section>

  <section>
    <h2>Search Tips</h2>
    <ul>
      <li>Use your browser's developer tools to inspect the graph</li>
      <li>Open devtools with <code>Ctrl+M</code></li>
      <li>Search is currently a demo page; full-text search coming soon</li>
    </ul>
  </section>

  <section>
    <h2>Popular Searches</h2>
    <ul>
      <li><a href="/?sortCol=name&sortDir=asc">Users by name (A-Z)</a></li>
      <li><a href="/?sortCol=name&sortDir=desc">Users by name (Z-A)</a></li>
      <li><a href="/?sortCol=email&sortDir=asc">Users by email</a></li>
    </ul>
  </section>`;
}
