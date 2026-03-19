export interface ExternalGridPageProps {
  gridTableHtml: string;
  rowCount: number;
  page: number;
  totalRows: number;
}

export default function ExternalGridPageView(props: ExternalGridPageProps) {
  return (
    <>
      <p>
        Spreadsheet-style external data grid: click a cell to edit, click a
        header to sort.
      </p>

      <section data-hx-id="external-grid-root">
        <h2>External Data Grid</h2>
        <p>
          Loaded <span data-hx-id="external-grid-row-count">{props.rowCount}</span>{" "}
          rows from page <span data-hx-id="external-grid-summary-page">{props.page}</span>{" "}
          of a <span data-hx-id="external-grid-summary-total">{props.totalRows}</span>
          -row dataset.
        </p>

        <hx-slot value={props.gridTableHtml} />

        <p data-hx-id="external-grid-status" aria-live="polite">
          Ready. Click a column header to sort or edit any cell directly.
        </p>
      </section>
    </>
  );
}
