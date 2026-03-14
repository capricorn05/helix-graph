export interface HostListingsPageViewProps {
  totalListings: number;
  listingsGridHtml: string;
  pagerHtml: string;
}

export default function HostListingsPageView(props: HostListingsPageViewProps) {
  return (
    <div data-hx-id="host-listings-root" className="host-listings-root">
      <section className="host-listings-hero">
        <h2>Product Host Listings</h2>
        <p>Airbnb-style card layout for external products with fast server-side paging.</p>
        <p>
          Source: DummyJSON seed products, expanded to <strong>{props.totalListings.toLocaleString()}</strong> synthetic listings.
        </p>
      </section>

      <section>
        <div
          className="host-listings-grid"
          data-hx-id="host-listings-grid"
          data-hx-list="host-listings-grid"
        >
          <hx-slot value={props.listingsGridHtml} />
        </div>
        <hx-slot value={props.pagerHtml} />
      </section>
    </div>
  );
}
