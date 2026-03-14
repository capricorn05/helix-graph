import assert from "node:assert/strict";
import test from "node:test";
import {
  uiDataTable,
  uiEditableGrid,
  type UIDataTableColumnDef,
  type UIEditableGridColumnDef,
} from "../helix/components/table.js";

interface TestRow {
  id: number;
  title: string;
  category: string;
}

test("uiDataTable renders a dedicated column filter row", () => {
  const columns: UIDataTableColumnDef<TestRow>[] = [
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      filter: true,
    },
    {
      id: "category",
      header: "Category",
      accessorKey: "category",
      filter: {
        type: "select",
        placeholder: "All categories",
        value: "hardware",
        options: [{ value: "hardware", label: "Hardware" }],
      },
    },
  ];

  const html = uiDataTable({
    data: [{ id: 1, title: "Flux Capacitor", category: "hardware" }],
    columns,
  });

  assert.match(html, /class="hx-table__filter-row"/);
  assert.match(html, /data-hx-column-filter="title"/);
  assert.match(html, /data-hx-column-filter-type="search"/);
  assert.match(html, /data-hx-column-filter="category"/);
  assert.match(html, /data-hx-column-filter-type="select"/);
  assert.match(html, /<option value=""[^>]*>All categories<\/option>/);
  assert.match(html, /<option value="hardware" selected>Hardware<\/option>/);
});

test("uiEditableGrid infers filter input types from column definitions", () => {
  const columns: UIEditableGridColumnDef<TestRow>[] = [
    {
      id: "id",
      header: "ID",
      accessorKey: "id",
      valueType: "number",
      filter: true,
      editable: false,
    },
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      valueType: "string",
      filter: true,
    },
  ];

  const html = uiEditableGrid({
    data: [{ id: 1, title: "Flux Capacitor", category: "hardware" }],
    columns,
    tableId: "test-grid",
    bodyId: "test-grid-body",
    listId: "test-grid-body",
  });

  assert.match(html, /data-hx-column-filter="id"/);
  assert.match(html, /data-hx-column-filter-type="number"/);
  assert.match(html, /type="number"/);
  assert.match(html, /data-hx-column-filter="title"/);
  assert.match(html, /data-hx-column-filter-type="search"/);
  assert.match(html, /type="search"/);
});
