import { useState, ReactNode } from 'react';
import { Loader2, Calendar, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import { exportProfessionalExcel, ExcelExportConfig } from '@/lib/excelExport';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  config: Omit<ExcelExportConfig, 'fromDate' | 'toDate' | 'rows'>;
  dateField: string;
  records: Record<string, string | number | null | undefined>[];
  title?: string;
  children?: ReactNode;
}

export function ExportModal({
  open,
  onClose,
  config,
  dateField,
  records,
  title = 'Export Excel Report',
  children,
}: ExportModalProps) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = records.filter((r) => {
    const d = String(r[dateField] ?? '');
    if (!d) return false;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  });

  const handleExport = async () => {
    if (filtered.length === 0) {
      setError('No records found in the selected date range.');
      return;
    }
    setError(null);
    setExporting(true);
    setDone(false);
    try {
      await new Promise((r) => setTimeout(r, 100));
      await exportProfessionalExcel({
        ...config,
        fromDate: fromDate || 'All',
        toDate: toDate || 'All',
        rows: filtered,
      });
      setDone(true);
      setTimeout(() => {
        setDone(false);
        onClose();
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleClose = () => {
    if (exporting) return;
    setDone(false);
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={title} size="md">
      {children && <div className="mb-4">{children}</div>}

      <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-sky-600" />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Select Date Range</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="From Date" type="date" value={fromDate} onChange={setFromDate} />
          <Input label="To Date" type="date" value={toDate} onChange={setToDate} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {filtered.length} record(s) match the selected date range.
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); }}
              className="ml-2 text-sky-600 hover:underline"
            >Clear dates</button>
          )}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {exporting && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating Professional Excel Report...
        </div>
      )}

      {done && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle className="h-4 w-4" />
          Excel Report Exported Successfully.
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={handleClose} disabled={exporting}>Cancel</Button>
        <Button onClick={handleExport} disabled={exporting || done}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          {exporting ? 'Generating...' : 'Export'}
        </Button>
      </div>
    </Modal>
  );
}
