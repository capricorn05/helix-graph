type DndRowElement = HTMLTableRowElement & {
  dataset: DOMStringMap & {
    dndId?: string;
    dndLabel?: string;
    dndInitialIndex?: string;
  };
};

const TRIAL_ROOT_SELECTOR = '[data-hx-id="trial-dnd-root"]';
const TRIAL_LIST_SELECTOR = '[data-hx-id="trial-dnd-list"]';
const TRIAL_RESET_SELECTOR = '[data-hx-id="trial-dnd-reset"]';
const TRIAL_STATUS_SELECTOR = '[data-hx-id="trial-dnd-status"]';
const TRIAL_ORDER_SELECTOR = '[data-hx-id="trial-dnd-order"]';

let activeDragId: string | null = null;

function getTrialList(): HTMLTableSectionElement | null {
  const list = document.querySelector(TRIAL_LIST_SELECTOR);
  return list instanceof HTMLTableSectionElement ? list : null;
}

function getTrialRows(list: HTMLTableSectionElement): DndRowElement[] {
  return Array.from(list.querySelectorAll<DndRowElement>("tr[data-dnd-id]"));
}

function getTrialStatusElement(): HTMLElement | null {
  const element = document.querySelector(TRIAL_STATUS_SELECTOR);
  return element instanceof HTMLElement ? element : null;
}

function getTrialOrderElement(): HTMLElement | null {
  const element = document.querySelector(TRIAL_ORDER_SELECTOR);
  return element instanceof HTMLElement ? element : null;
}

function updateStatus(message: string): void {
  const statusElement = getTrialStatusElement();
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
}

function updateDisplayedOrder(list: HTMLTableSectionElement): void {
  const rows = getTrialRows(list);
  const labels = rows
    .map((row) => row.dataset.dndLabel)
    .filter((label): label is string => typeof label === "string");

  for (const [index, row] of rows.entries()) {
    const positionCell = row.querySelector('[data-dnd-role="position"]');
    if (positionCell instanceof HTMLElement) {
      positionCell.textContent = String(index + 1);
    }
  }

  const orderElement = getTrialOrderElement();
  if (!orderElement) {
    return;
  }

  orderElement.textContent = `Current order: ${labels.join(" → ")}`;
}

function closestTrialRow(target: EventTarget | null): DndRowElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const row = target.closest("tr[data-dnd-id]");
  return row instanceof HTMLTableRowElement ? (row as DndRowElement) : null;
}

function isWithinTrialRoot(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return target.closest(TRIAL_ROOT_SELECTOR) instanceof Element;
}

function resetTrialOrder(): void {
  const list = getTrialList();
  if (!list) {
    return;
  }

  const sortedRows = getTrialRows(list).sort((left, right) => {
    const leftIndex = Number(left.dataset.dndInitialIndex ?? "0");
    const rightIndex = Number(right.dataset.dndInitialIndex ?? "0");
    return leftIndex - rightIndex;
  });

  for (const row of sortedRows) {
    list.appendChild(row);
  }

  updateDisplayedOrder(list);
  updateStatus("Order reset to default.");
}

document.addEventListener("dragstart", (event) => {
  if (!isWithinTrialRoot(event.target)) {
    return;
  }

  const row = closestTrialRow(event.target);
  if (!row) {
    return;
  }

  activeDragId = row.dataset.dndId ?? null;
  if (!activeDragId) {
    return;
  }

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", activeDragId);
  }

  updateStatus(`Dragging: ${row.dataset.dndLabel ?? activeDragId}`);
});

document.addEventListener("dragover", (event) => {
  if (!isWithinTrialRoot(event.target) || !activeDragId) {
    return;
  }

  const row = closestTrialRow(event.target);
  if (!row) {
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
});

document.addEventListener("drop", (event) => {
  if (!isWithinTrialRoot(event.target) || !activeDragId) {
    return;
  }

  const list = getTrialList();
  const targetRow = closestTrialRow(event.target);
  if (!list || !targetRow) {
    return;
  }

  const sourceRow = list.querySelector<DndRowElement>(
    `tr[data-dnd-id="${activeDragId}"]`,
  );
  if (!sourceRow || sourceRow === targetRow) {
    return;
  }

  event.preventDefault();

  const targetRect = targetRow.getBoundingClientRect();
  const dropBefore = event.clientY < targetRect.top + targetRect.height / 2;
  if (dropBefore) {
    list.insertBefore(sourceRow, targetRow);
  } else {
    list.insertBefore(sourceRow, targetRow.nextSibling);
  }

  updateDisplayedOrder(list);
  updateStatus(`Moved: ${sourceRow.dataset.dndLabel ?? activeDragId}`);
});

document.addEventListener("dragend", (event) => {
  if (!isWithinTrialRoot(event.target)) {
    return;
  }

  activeDragId = null;
});

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const resetButton = event.target.closest(TRIAL_RESET_SELECTOR);
  if (!(resetButton instanceof HTMLButtonElement)) {
    return;
  }

  if (!isWithinTrialRoot(resetButton)) {
    return;
  }

  resetTrialOrder();
});

window.addEventListener("DOMContentLoaded", () => {
  const list = getTrialList();
  if (!list) {
    return;
  }

  updateDisplayedOrder(list);
});
