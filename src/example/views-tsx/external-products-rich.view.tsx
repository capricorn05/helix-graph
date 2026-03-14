export interface ExternalProductsRichPageViewProps {
  tableAndModal: string;
}

export default function ExternalProductsRichPageView(
  props: ExternalProductsRichPageViewProps,
) {
  return (
    <>
      <p>
        Backend source: <strong>DummyJSON Products API</strong>. Same 10,000-row
        dataset as External Data, but with image cells and heavier conditional
        row styling to simulate more realistic rendering load.
      </p>

      <hx-slot value={props.tableAndModal} />
    </>
  );
}
