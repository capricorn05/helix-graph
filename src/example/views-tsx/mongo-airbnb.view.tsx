export interface MongoAirbnbPageViewProps {
  totalListings: number;
  sourceLabel: string;
  controlsHtml: string;
  listingsGridHtml: string;
  pagerHtml: string;
}

export default function MongoAirbnbPageView(props: MongoAirbnbPageViewProps) {
  return (
    <div data-hx-id="airbnb-mongo-root" className="airbnb-mongo-root">
      <section className="airbnb-mongo-hero">
        <p className="airbnb-mongo-hero__eyebrow">MongoDB sample_airbnb</p>
        <h2>Stay Discovery, Reimagined</h2>
        <p>
          Airbnb-style discovery UI backed by a MongoDB dataset, optimized with
          server-first rendering and lightweight client paging updates.
        </p>
        <p>
          Showing <strong>{props.totalListings.toLocaleString()}</strong> matching
          stays. <strong>{props.sourceLabel}</strong>
        </p>
      </section>

      <section className="airbnb-mongo-panel">
        <hx-slot value={props.controlsHtml} />
      </section>

      <section className="airbnb-mongo-panel airbnb-mongo-panel--grid">
        <div
          className="airbnb-mongo-grid"
          data-hx-id="airbnb-mongo-grid"
          data-hx-list="airbnb-mongo-grid"
        >
          <hx-slot value={props.listingsGridHtml} />
        </div>
        <hx-slot value={props.pagerHtml} />
      </section>
    </div>
  );
}
