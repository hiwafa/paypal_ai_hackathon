"use client";

import {
  CellStyleModule,
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  ColumnApiModule,
  CsvExportModule,
  ExternalFilterModule,
  HighlightChangesModule,
  ModuleRegistry,
  PinnedRowModule,
  QuickFilterModule,
  RowApiModule,
  RowStyleModule,
  TooltipModule,
  ValidationModule,
  type ColDef,
  type GetRowIdParams,
  type GridApi,
  type GridSizeChangedEvent,
  type IRowNode,
  type ModelUpdatedEvent,
  type ProcessCellForExportParams,
  type RowClassRules,
  type RowDataUpdatedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { formatWhen } from "@/lib/client/time";
import { viewMatcher, type LedgerView } from "@/lib/domain/ledgerView";
import type { LedgerEntry } from "@/lib/domain/types";
import {
  DescriptionCell,
  FeeCell,
  KindCell,
  MoneyCell,
  RobotCell,
  StatusCell,
  isTotals,
  type LedgerRow,
  type LedgerTotals,
} from "./cells";
import { ledgerTheme } from "./theme";

// The ledger: every PayPal capture, refund and payout Penny has booked.
// AG Grid handles most of it: the crew's "views" run as an external
// filter, the owner's search is the quick filter, totals follow whatever is
// visible in a pinned row, and new entries flash as they arrive live.

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ClientSideRowModelApiModule,
  RowApiModule,
  QuickFilterModule,
  ExternalFilterModule,
  PinnedRowModule,
  HighlightChangesModule,
  TooltipModule,
  RowStyleModule,
  CellStyleModule,
  CsvExportModule,
  ColumnApiModule,
  ...(process.env.NODE_ENV === "production" ? [] : [ValidationModule]),
]);

const entryOf = (row: LedgerRow | undefined): LedgerEntry | undefined => (row && !isTotals(row) ? row : undefined);

const COLUMNS: ColDef<LedgerRow>[] = [
  {
    colId: "at",
    headerName: "When",
    width: 128,
    sort: "desc",
    valueGetter: (p) => entryOf(p.data)?.at,
    valueFormatter: (p) => (p.value ? formatWhen(p.value) : ""),
    tooltip: (p) => {
      const at = entryOf(p.data)?.at;
      return at ? new Date(at).toLocaleString() : undefined;
    },
    cellClass: "text-white/60 tabular-nums",
  },
  {
    colId: "kind",
    headerName: "Type",
    width: 100,
    valueGetter: (p) => entryOf(p.data)?.kind,
    cellRenderer: KindCell,
    cellClass: "cell-stack",
  },
  {
    colId: "description",
    headerName: "Description",
    flex: 1,
    minWidth: 200,
    // The totals row's value changes with its count and label, so the grid redraws that cell too.
    valueGetter: (p) => (p.data && isTotals(p.data) ? `${p.data.count} ${p.data.label}` : entryOf(p.data)?.description),
    cellRenderer: DescriptionCell,
    cellClass: "cell-stack",
    getQuickFilterText: (p) => {
      const entry = entryOf(p.data);
      return entry ? `${entry.description} ${entry.counterparty} ${entry.reference} ${entry.orderNumber ?? ""}` : "";
    },
    tooltip: (p) => entryOf(p.data)?.description,
  },
  {
    colId: "handledBy",
    headerName: "Booked by",
    width: 110,
    valueGetter: (p) => entryOf(p.data)?.handledBy,
    cellRenderer: RobotCell,
    cellClass: "cell-stack",
  },
  {
    colId: "amount",
    headerName: "Amount",
    width: 104,
    type: "rightAligned",
    valueGetter: (p) => p.data?.amountCents,
    cellRenderer: MoneyCell,
    enableCellChangeFlash: true,
  },
  {
    colId: "fee",
    headerName: "Fee",
    headerTooltip: "PayPal fee",
    width: 84,
    type: "rightAligned",
    valueGetter: (p) => p.data?.feeCents,
    cellRenderer: FeeCell,
  },
  {
    colId: "net",
    headerName: "Net",
    width: 104,
    type: "rightAligned",
    valueGetter: (p) =>
      p.data ? (isTotals(p.data) ? p.data.netCents : p.data.amountCents - p.data.feeCents) : undefined,
    cellRenderer: MoneyCell,
  },
  {
    colId: "status",
    headerName: "Status",
    width: 150,
    // Includes how it was confirmed, so a webhook arriving later flashes the cell.
    valueGetter: (p) => {
      const entry = entryOf(p.data);
      return entry ? `${entry.status} ${entry.confirmedBy} ${entry.rail}` : undefined;
    },
    cellRenderer: StatusCell,
    cellClass: "cell-stack",
    enableCellChangeFlash: true,
  },
];

const DEFAULT_COLUMN: ColDef<LedgerRow> = { sortable: true, resizable: true, suppressMovable: true };

const ROW_CLASSES: RowClassRules<LedgerRow> = {
  "row-failed": (p) => entryOf(p.data)?.status === "failed",
};

const OVERLAYS = {
  noRows: { overlayText: "No money has moved yet. The first PayPal sale will appear here." },
  noMatchingRows: { overlayText: "Nothing matches this view." },
};

/** Below this width the fee and net columns step aside; amount and status stay. */
const COMPACT_WIDTH = 960;

function fitColumns(event: GridSizeChangedEvent<LedgerRow>) {
  event.api.setColumnsVisible(["fee", "net"], event.clientWidth >= COMPACT_WIDTH);
}

const getRowId = (p: GetRowIdParams<LedgerRow>) => (isTotals(p.data) ? "totals" : p.data.id);

/** Exports amounts as plain dollars and times as ISO, which spreadsheets read best. */
function exportCell(p: ProcessCellForExportParams<LedgerRow>): string {
  const entry = entryOf(p.node?.data);
  switch (p.column.getColId()) {
    case "at":
      return entry?.at ?? "";
    case "amount":
    case "fee":
    case "net":
      return typeof p.value === "number" ? (p.value / 100).toFixed(2) : "";
    case "description":
      return entry ? `${entry.description} (${entry.counterparty}, ${entry.reference})` : "";
    case "status":
      return entry ? `${entry.status} · confirmed by ${entry.confirmedBy} · ${entry.rail}` : "";
    default:
      return p.value == null ? "" : String(p.value);
  }
}

export interface LedgerGridHandle {
  exportCsv: () => void;
}

interface LedgerGridProps {
  entries: LedgerEntry[];
  view: LedgerView | null;
  search: string;
  timeZone: string;
  onReady: (handle: LedgerGridHandle) => void;
}

export default function LedgerGrid({ entries, view, search, timeZone, onReady }: LedgerGridProps) {
  const api = useRef<GridApi<LedgerRow> | null>(null);
  const known = useRef<Set<string> | null>(null);
  const [totals, setTotals] = useState<LedgerTotals[]>([]);

  // A new function reference makes AG Grid re-run the external filter.
  const matcher = useMemo(() => (view ? viewMatcher(view, new Date(), timeZone) : null), [view, timeZone]);
  const isExternalFilterPresent = useCallback(() => matcher !== null, [matcher]);
  const doesExternalFilterPass = useCallback(
    (node: IRowNode<LedgerRow>) => {
      const entry = entryOf(node.data);
      return !matcher || !entry || matcher(entry);
    },
    [matcher],
  );

  const label = view?.title ?? (search.trim() ? `matching “${search.trim()}”` : "everything");

  // Totals always describe exactly the rows on screen.
  const updateTotals = useCallback(
    (event: ModelUpdatedEvent<LedgerRow>) => {
      const next: LedgerTotals = { totals: true, count: 0, amountCents: 0, feeCents: 0, netCents: 0, label };
      event.api.forEachNodeAfterFilter((node) => {
        const entry = entryOf(node.data);
        if (!entry) return;
        next.count += 1;
        if (entry.status === "failed") return;
        next.amountCents += entry.amountCents;
        next.feeCents += entry.feeCents;
        next.netCents += entry.amountCents - entry.feeCents;
      });
      setTotals((current) => {
        const prev = current[0];
        const same =
          prev &&
          prev.count === next.count &&
          prev.amountCents === next.amountCents &&
          prev.feeCents === next.feeCents &&
          prev.label === next.label;
        return same ? current : [next];
      });
    },
    [label],
  );

  // New entries pulse gold as they arrive; the first load stays calm.
  const flashNewRows = useCallback((event: RowDataUpdatedEvent<LedgerRow>) => {
    const ids = new Set<string>();
    event.api.forEachNode((node) => {
      if (node.id) ids.add(node.id);
    });
    if (known.current) {
      const fresh = [...ids].filter((id) => !known.current!.has(id));
      const rowNodes = fresh.map((id) => event.api.getRowNode(id)).filter((node) => node !== undefined);
      if (rowNodes.length) event.api.flashCells({ rowNodes, flashDuration: 1800, fadeDuration: 1200 });
    }
    known.current = ids;
  }, []);

  return (
    <div className="ledger-grid size-full" role="region" aria-label="Ledger of PayPal transactions">
      <AgGridReact<LedgerRow>
        theme={ledgerTheme}
        rowData={entries}
        columnDefs={COLUMNS}
        defaultColDef={DEFAULT_COLUMN}
        getRowId={getRowId}
        animateRows
        quickFilterText={search}
        isExternalFilterPresent={isExternalFilterPresent}
        doesExternalFilterPass={doesExternalFilterPass}
        pinnedBottomRowData={totals}
        rowClassRules={ROW_CLASSES}
        overlayComponentParams={OVERLAYS}
        tooltipShowDelay={400}
        suppressCellFocus
        onModelUpdated={updateTotals}
        onGridSizeChanged={fitColumns}
        onRowDataUpdated={flashNewRows}
        onGridReady={(event) => {
          api.current = event.api;
          onReady({
            exportCsv: () =>
              api.current?.exportDataAsCsv({
                fileName: `mira-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
                skipPinnedBottom: true,
                // Columns hidden on narrow screens still belong in the file.
                allColumns: true,
                processCellCallback: exportCell,
                // The on-screen "Fee" header is short for space; the file says what it is.
                processHeaderCallback: (p) =>
                  p.column.getColId() === "fee" ? "PayPal fee" : (p.column.getColDef().headerName ?? ""),
              }),
          });
        }}
      />
    </div>
  );
}
