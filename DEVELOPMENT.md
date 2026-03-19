# Development & Performance Guide

## Hot-Reload Development

For faster iteration during client development, use the hot-reload dev server:

```bash
npm run dev:watch
```

This will:

- Watch `src/example/client/` and generated artifacts for changes
- Inject a live-reload script into HTML responses
- Signal the browser to reload when files change
- Available at `http://localhost:4173`

**How it works**: The dev server tracks file changes and exposes a `/dev/poll-changes` endpoint. A small client-side script polls this endpoint every 1000ms and triggers a full page reload when changes are detected.

**Future enhancement**: Selective hot module replacement (HMR) to reload only client chunks without full page refresh.

---

## Performance Benchmarking

### Run Full Benchmark Suite

```bash
npm run bench
```

This runs comprehensive benchmarks for:

- Router dispatch (10-1000 routes, first/middle/last dispatch)
- Reactive cell fanout (10-1000 subscribers, various update counts)
- Derived chain propagation (5-20 node chains)
- External product payload latency (plain vs. rich variants)
- **SSR Generation** (snapshot creation time)
- **Client Resume** (initialization and rehydration time)
- **Patch Application** (DOM update overhead)

### Run SSR Benchmarks Only

```bash
npm run bench:ssr
```

Output includes:

- Artifact definition and snapshot creation overhead
- JSDOM setup and global installation time
- Resume client initialization phases
- Patch application overhead for incremental updates

---

## Benchmark Metrics

### SSR Generation (50-item list)

Measures the time to:

1. Define and register a compiled view artifact
2. Create a JSON snapshot of reactive state
3. Total end-to-end SSR generation

**Typical results**:

- Artifact definition: < 1ms
- Snapshot creation: 1-5ms
- Total: 1-6ms

### Client Resume Initialization

Measures the time to:

1. Set up compiled views and bindings
2. Create JSDOM test environment
3. Install global DOM references
4. Initialize runtime graph
5. Execute full `resumeClientApp()` flow

**Typical results**:

- JSDOM creation: 5-10ms
- Global installation: < 1ms
- Graph reset: < 1ms
- Resume execution: 5-15ms
- Total: 15-30ms

### Patch Application

Measures the time to apply incremental updates (setText operations) to the DOM.

**Typical results for 3 updates**:

- Patch runtime setup: < 1ms
- Patch application: < 1ms
- Total: 1-2ms

---

## Interpreting Results

### Throughput

Expressed as operations per second (ops/sec):

- Higher is better
- Helps identify scaling bottlenecks with many routes/subscribers

### Latency Percentiles

- **Avg**: Mean latency
- **P95**: 95th percentile (most users experience this or better)
- **Max**: Worst-case latency

### Payload Sizes

Expressed in bytes. Large payloads indicate potential optimization opportunities.

---

## Performance Tips

### Client Development

1. **Use `npm run dev:watch`** for fast iteration
2. **Profile in DevTools** to identify bottlenecks
3. **Monitor bundle size** with `npm run bundle-analyze` (not yet implemented)

### SSR Scaling

1. **Batch resource reads** to reduce payload size
2. **Use resource tags** for efficient cache invalidation
3. **Consider fragment-swap** for high-frequency updates

### Runtime Performance

1. **Minimize reactive subscribers** (use derived cells instead of chained subs)
2. **Batch DOM updates** via scheduler
3. **Avoid tight loops** in handlers (let async/microtask scheduling handle batching)

---

## Future Enhancements

- [ ] Hot module replacement (HMR) for client chunks
- [ ] Bundle size analysis tooling
- [ ] Synthetic page load testing (SSR + simulated navigation)
- [ ] Memory profiling for long-lived sessions
- [ ] Comparative benchmark tracking (detect regressions)
