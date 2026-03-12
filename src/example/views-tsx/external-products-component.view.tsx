export interface ExternalProductsComponentViewProps {
  tableAndModal: string;
}

export default function ExternalProductsComponentView(
  props: ExternalProductsComponentViewProps,
) {
  return (
    <article>
      <h3>External Data View</h3>
      <p>
        Backend source: <strong>DummyJSON Products API</strong>. Showing a synthesized{" "}
        <strong>10,000-row</strong>{" "}
        dataset with 30 rows per page.
      </p>
      <hx-slot value={props.tableAndModal} />
    </article>
  );
}
