import { useState, useMemo, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Columns3 } from 'lucide-react';
import { Card } from '@/components/ui';

export interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  hidden?: boolean;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  totalValue?: (rows: T[]) => ReactNode;
}

interface ReportTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  pageSize?: number;
  showTotals?: boolean;
  emptyMessage?: string;
  /** When provided, a S.No. column is prepended that resets to 1 per date. */
  getSerialDate?: (row: T) => string;
  /** When true, shows a continuous S.No. across all rows (no date reset). */
  showSerial?: boolean;
}

export function ReportTable<T>({
  columns,
  rows,
  rowKey,
  pageSize = 25,
  showTotals = true,
  emptyMessage = 'No records found',
  getSerialDate,
  showSerial = false,
}: ReportTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColPicker, setShowColPicker] = useState(false);

  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    const col = columns.find((c) => c.key === sortCol);
    if (!col?.sortValue) return rows;
    const sorted = [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [rows, sortCol, sortDir, columns]);

  const serialMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!getSerialDate && !showSerial) return map;
    let counter = 0;
    const dateCounters = new Map<string, number>();
    sortedRows.forEach((row) => {
      counter++;
      if (getSerialDate) {
        const date = getSerialDate(row);
        const next = (dateCounters.get(date) || 0) + 1;
        dateCounters.set(date, next);
        map.set(rowKey(row), next);
      } else {
        map.set(rowKey(row), counter);
      }
    });
    return map;
  }, [sortedRows, getSerialDate, showSerial, rowKey]);

  const visibleColumns = useMemo(() => {
    const base = columns.filter((c) => !hiddenCols.has(c.key) && !c.hidden);
    if (!getSerialDate && !showSerial) return base;
    const snoCol: Column<T> = {
      key: '__sno__',
      label: 'S.No.',
      align: 'center',
      sortable: false,
      render: (row) => serialMap.get(rowKey(row)) ?? '',
    };
    return [snoCol, ...base];
  }, [columns, hiddenCols, getSerialDate, showSerial, serialMap, rowKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const currentPage = safePage;
  const pagedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    if (sortCol === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col.key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const toggleColumn = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Card className="overflow-hidden">
      {/* Column picker dropdown */}
      <div className="relative flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {sortedRows.length} records
        </p>
        <div className="relative">
          <button
            onClick={() => setShowColPicker((s) => !s)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <Columns3 className="h-3.5 w-3.5" />
            Columns
          </button>
          {showColPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColPicker(false)} />
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                {columns.map((col) => (
                  <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={!hiddenCols.has(col.key) && !col.hidden}
                      onChange={() => toggleColumn(col.key)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="text-slate-700">{col.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto sticky-header">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 select-none ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.sortable ? 'cursor-pointer hover:text-slate-700' : ''}`}
                  onClick={() => handleSort(col)}
                >
                  <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                    {col.label}
                    {col.sortable && (
                      sortCol === col.key ? (
                        sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-sky-600" /> : <ChevronDown className="h-3.5 w-3.5 text-sky-600" />
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pagedRows.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-slate-50/50 transition-colors">
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'font-medium text-slate-800'}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {showTotals && sortedRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-800">
                {visibleColumns.map((col, i) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : i === 0 ? '' : ''}`}
                  >
                    {col.totalValue ? col.totalValue(sortedRows) : (i === 0 ? 'Grand Total' : '')}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {sortedRows.length > pageSize && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5">
          <p className="text-xs text-slate-500">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedRows.length)} of {sortedRows.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={currentPage === 1}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-medium text-slate-600">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
