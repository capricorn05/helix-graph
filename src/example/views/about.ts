export function renderAboutPage(): string {
  return `
  <section>
    <h2>Helix Graph Framework</h2>
    <p>
      Helix is a reactive, graph-based framework for building full-stack web applications
      with TypeScript. It unifies server and client concerns through a shared reactive graph
      where views, resources, actions, and routes are first-class nodes.
    </p>
  </section>

  <section>
    <h2>Core Concepts</h2>
    <dl>
      <dt>Cells</dt>
      <dd>Reactive state that drives the graph</dd>
      <dt>Resources</dt>
      <dd>Server-side async data sources with caching and deduplication</dd>
      <dt>Actions</dt>
      <dd>Server-side mutations with invalidation and capability checks</dd>
      <dt>Views</dt>
      <dd>Declarative HTML rendering tied to reactive state</dd>
      <dt>Routes</dt>
      <dd>Graph nodes that dispatch HTTP requests to handlers</dd>
    </dl>
  </section>

  <section>
    <h2>Architecture</h2>
    <p>
      <strong>Server-Side:</strong> Graph router (<code>defineRoute</code>) compiles URL patterns,
      dispatches requests, coordinates resource reads and action invocations.
    </p>
    <p>
      <strong>Client-Side:</strong> SSR-embedded graph snapshot + binding map enable resumable
      activation. URL is a reactive cell; navigation updates it without full page reload.
    </p>
  </section>

  <section>
    <h2>Demo Features</h2>
    <ul>
      <li>Graph-native routing with pattern matching</li>
      <li>Streaming SSR with resumable hydration</li>
      <li>Real-time user management (create, read, update, delete)</li>
      <li>Client-side graph inspector (press Ctrl+M)</li>
      <li>Type-safe route parameters and responses</li>
    </ul>
  </section>`;
}
