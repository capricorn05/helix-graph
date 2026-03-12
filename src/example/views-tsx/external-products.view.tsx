export interface ExternalProductsPageViewProps {
  tableAndModal: string;
}

export default function ExternalProductsPageView(
  props: ExternalProductsPageViewProps,
) {
  return (
    <>
      <p>
        Backend source: <strong>DummyJSON Products API</strong>. Showing a synthesized{" "}
        <strong>10,000-row</strong>{" "}
        dataset with 30 rows per page.
      </p>

      <hx-slot value={props.tableAndModal} />
    </>
  );
}
