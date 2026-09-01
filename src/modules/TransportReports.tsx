import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Truck, Download, Search, Printer, TrendingUp, CheckCircle2,
  Clock, FileText, Fuel, Wrench, RefreshCw, IndianRupee,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Button, Badge, LoadingSpinner } from '@/components/ui';
import { ReportTable, type Column } from '@/components/ReportTable';
import { ReportFilters, ReportSummaryCard, getPresetRange, type FilterValues, type FilterConfig } from '@/components/ReportFilters';
import { formatCurrency, formatDate } from '@/lib/calc';
import { ExportModal } from '@/components/ExportModal';
import { CompanyBill, MarBill, Vehicle } from '@/types/database';
import { useReportSettings } from '@/lib/useReportSettings';

type TransportReportType =
  | 'daily' | 'dateWise' | 'monthly' | 'vehicle' | 'driver' | 'lrNumber'
  | 'material' | 'loading' | 'unloading' | 'customer' | 'companyIncome'
  | 'diesel' | 'maintenance' | 'advance' | 'paidBills' | 'pendingBills'
  | 'outstanding' | 'tripProfit' | 'vehicleProfit' | 'driverPayment'
  | 'gstInvoice' | 'invoiceRegister' | 'ledger' | 'collection' | 'vehicleUtil' | 'tripSummary';

const defaultFilters: FilterValues = {
  from: '', to: '', preset: 'thisMonth',
  customer: '', vehicle: '', driver: '', route: '', material: '',
  lrNumber: '', product: '', billStatus: 'all', paymentStatus: 'all',
};

interface CombinedRow {
  bill: CompanyBill;
  mar?: MarBill;
}

export function TransportReports({ tr }: { tr: (k: string) => string }) {
  const { profile } = useAuth();
  const { isReportActive } = useReportSettings();
  const [reportType, setReportType] = useState<TransportReportType>('daily');
  const [filters, setFilters] = useState<FilterValues>({
    ...defaultFilters,
    ...getPresetRange('thisMonth'),
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyBills, setCompanyBills] = useState<CompanyBill[]>([]);
  const [marBills, setMarBills] = useState<MarBill[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const [cbRes, marRes, vehRes] = await Promise.all([
      supabase.from('company_bills').select('*').gte('trip_date', filters.from).lte('trip_date', filters.to).order('trip_date', { ascending: false }),
      supabase.from('mar_bills').select('*').gte('trip_date', filters.from).lte('trip_date', filters.to).order('trip_date', { ascending: false }),
      supabase.from('vehicles').select('*').order('vehicle_number'),
    ]);
    setCompanyBills((cbRes.data || []) as CompanyBill[]);
    setMarBills((marRes.data || []) as MarBill[]);
    setVehicles((vehRes.data || []) as Vehicle[]);
    setLoading(false);
  }, [profile, filters.from, filters.to]);

  useEffect(() => { load(); }, [load]);

  // Combined rows: company bills with optional MAR bill link
  const combined = useMemo((): CombinedRow[] => {
    return companyBills.map((bill) => ({
      bill,
      mar: marBills.find((m) => m.company_bill_id === bill.id),
    }));
  }, [companyBills, marBills]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = combined;
    if (filters.vehicle) result = result.filter((r) => r.bill.vehicle_number === filters.vehicle);
    if (filters.driver) result = result.filter((r) => r.bill.driver_name === filters.driver);
    if (filters.material) result = result.filter((r) => (r.bill.material_name || '') === filters.material);
    if (filters.lrNumber) result = result.filter((r) => (r.bill.lr_no || '') === filters.lrNumber);
    if (filters.route) result = result.filter((r) => r.bill.unloading_location === filters.route);
    if (filters.customer) result = result.filter((r) => r.bill.unloading_location === filters.customer);
    if (filters.billStatus === 'paid') result = result.filter((r) => r.bill.bill_paid);
    if (filters.billStatus === 'pending') result = result.filter((r) => !r.bill.bill_paid);
    if (filters.paymentStatus === 'paid') result = result.filter((r) => r.bill.payment_status === 'paid');
    if (filters.paymentStatus === 'pending') result = result.filter((r) => r.bill.payment_status === 'pending');
    if (filters.paymentStatus === 'partial') result = result.filter((r) => r.bill.payment_status === 'partial');
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.bill.vehicle_number.toLowerCase().includes(q) ||
        r.bill.driver_name.toLowerCase().includes(q) ||
        r.bill.unloading_location.toLowerCase().includes(q) ||
        (r.bill.lr_no || '').toLowerCase().includes(q) ||
        (r.bill.material_name || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [combined, filters, search]);

  // Dashboard summary
  const summary = useMemo(() => {
    const totalTrips = filtered.length;
    const totalCompanyIncome = filtered.reduce((s, r) => s + r.bill.net_company_income, 0);
    const totalPaid = filtered.reduce((s, r) => s + r.bill.paid_amount, 0);
    const pendingAmount = filtered.reduce((s, r) => s + (r.bill.net_receivable - r.bill.paid_amount), 0);
    const outstandingReceivables = pendingAmount;
    const dieselExpenses = filtered.reduce((s, r) => s + (r.mar?.diesel_cost || 0), 0);
    const maintenanceExpenses = filtered.reduce((s, r) => s + (r.mar?.maintenance || 0), 0);
    const totalExpense = filtered.reduce((s, r) => s + (r.mar?.total_expense || 0), 0);
    const netProfit = filtered.reduce((s, r) => s + (r.mar?.trip_profit || 0), 0);
    const paidBills = filtered.filter((r) => r.bill.payment_status === 'paid').length;
    const pendingBills = filtered.filter((r) => r.bill.payment_status !== 'paid').length;
    return { totalTrips, totalCompanyIncome, totalPaid, pendingAmount, outstandingReceivables, dieselExpenses, maintenanceExpenses, netProfit, paidBills, pendingBills, totalExpense };
  }, [filtered]);

  // Report options
  const allReportOptions: { value: TransportReportType; label: string }[] = [
    { value: 'daily', label: tr('dailyTrip') },
    { value: 'dateWise', label: tr('dateWiseTrip') },
    { value: 'monthly', label: tr('monthlyTrip') },
    { value: 'vehicle', label: tr('vehicleWise') },
    { value: 'driver', label: tr('driverWiseReport') },
    { value: 'lrNumber', label: tr('lrNumberReport') },
    { value: 'material', label: tr('materialWiseReport') },
    { value: 'loading', label: tr('loadingLocationReport') },
    { value: 'unloading', label: tr('unloadingLocationReport') },
    { value: 'customer', label: tr('customerWiseReport') },
    { value: 'companyIncome', label: tr('companyIncomeReport') },
    { value: 'diesel', label: tr('dieselExpenseReport') },
    { value: 'maintenance', label: tr('maintenanceExpenseReport') },
    { value: 'advance', label: tr('advanceReport') },
    { value: 'paidBills', label: tr('paidBillsReport') },
    { value: 'pendingBills', label: tr('pendingBillsReport') },
    { value: 'outstanding', label: tr('outstandingReceivables') },
    { value: 'tripProfit', label: tr('tripProfitReport') },
    { value: 'vehicleProfit', label: tr('vehicleProfitability') },
    { value: 'driverPayment', label: tr('driverPaymentReport') },
    { value: 'gstInvoice', label: tr('gstInvoiceReport') },
    { value: 'invoiceRegister', label: tr('invoiceRegister') },
    { value: 'ledger', label: tr('transportLedger') },
    { value: 'collection', label: tr('transportCollection') },
    { value: 'vehicleUtil', label: tr('vehicleUtilization') },
    { value: 'tripSummary', label: tr('tripSummary') },
  ];

  const reportOptions = useMemo(
    () => allReportOptions.filter((opt) => isReportActive(`transport:${opt.value}`)),
    [isReportActive, allReportOptions]
  );

  useEffect(() => {
    if (reportOptions.length > 0 && !reportOptions.some((o) => o.value === reportType)) {
      setReportType(reportOptions[0].value);
    }
  }, [reportOptions, reportType]);

  const filterConfig: FilterConfig = {
    showVehicle: true,
    showDriver: true,
    showMaterial: true,
    showLrNumber: true,
    showBillStatus: true,
    showPaymentStatus: true,
  };

  const ownerNameForVehicle = (vehicleNumber: string) =>
    vehicles.find((v) => v.vehicle_number === vehicleNumber)?.owner_name || '';

  const vehicleNumbers = useMemo(() => Array.from(new Set(companyBills.map((b) => b.vehicle_number))).sort(), [companyBills]);
  const drivers = useMemo(() => Array.from(new Set(companyBills.map((b) => b.driver_name))).sort(), [companyBills]);
  const materials = useMemo(() => Array.from(new Set(companyBills.map((b) => b.material_name).filter(Boolean) as string[])).sort(), [companyBills]);
  const lrNumbers = useMemo(() => Array.from(new Set(companyBills.map((b) => b.lr_no).filter(Boolean) as string[])).sort(), [companyBills]);
  const locations = useMemo(() => Array.from(new Set(companyBills.map((b) => b.unloading_location))).sort(), [companyBills]);

  const [exportOpen, setExportOpen] = useState(false);

  const handlePrint = () => window.print();

  return (
    <div className="space-y-5">
      {/* Report selector + actions */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
              <Truck className="h-5 w-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{tr('transportReports')}</h2>
          </div>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as TransportReportType)}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          >
            {reportOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('search')}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none sm:w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}><Download className="h-4 w-4" />{tr('exportExcel')}</Button>
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <ReportFilters
        values={filters}
        onChange={setFilters}
        config={filterConfig}
        vehicles={vehicleNumbers}
        drivers={drivers}
        materials={materials}
        lrNumbers={lrNumbers}
        routes={locations}
        tr={tr}
      />

      {loading ? <LoadingSpinner /> : (
        <>
          {/* Dashboard cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <ReportSummaryCard label={tr('totalTrips')} value={String(summary.totalTrips)} color="amber" icon={<Truck className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('totalCompanyIncome')} value={formatCurrency(summary.totalCompanyIncome)} color="sky" icon={<IndianRupee className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('amountReceived')} value={formatCurrency(summary.totalPaid)} color="emerald" icon={<CheckCircle2 className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('pendingAmount')} value={formatCurrency(summary.pendingAmount)} color="amber" icon={<Clock className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('outstandingReceivables')} value={formatCurrency(summary.outstandingReceivables)} color="rose" icon={<FileText className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('dieselExpenses')} value={formatCurrency(summary.dieselExpenses)} color="violet" icon={<Fuel className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('maintenanceExpenses')} value={formatCurrency(summary.maintenanceExpenses)} color="slate" icon={<Wrench className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('netProfit')} value={formatCurrency(summary.netProfit)} color={summary.netProfit >= 0 ? 'emerald' : 'rose'} icon={<TrendingUp className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('paidBills')} value={String(summary.paidBills)} color="emerald" icon={<CheckCircle2 className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('pendingBills')} value={String(summary.pendingBills)} color="amber" icon={<Clock className="h-4 w-4" />} />
          </div>

          {/* Report table */}
          <TransportReportTable reportType={reportType} data={filtered} tr={tr} ownerNameForVehicle={ownerNameForVehicle} />
        </>
      )}
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        dateField="trip_date"
        records={filtered.map((r, idx) => ({
          sr_no: idx + 1, trip_date: r.bill.trip_date, vehicle_number: r.bill.vehicle_number, owner_name: ownerNameForVehicle(r.bill.vehicle_number), driver_name: r.bill.driver_name,
          lr_no: r.bill.lr_no || '', material_name: r.bill.material_name || '', loading_location: r.bill.loading_location, unloading_location: r.bill.unloading_location,
          tons: r.bill.tons, net_company_income: r.bill.net_company_income, net_receivable: r.bill.net_receivable, paid_amount: r.bill.paid_amount,
          pending: r.bill.net_receivable - r.bill.paid_amount, payment_status: r.bill.payment_status,
        }))}
        config={{
          reportTitle: 'IRON ORE TRANSPORT REPORT',
          filenamePrefix: 'Iron_Ore_Report',
          dateField: 'trip_date',
          columns: [
            { header: 'Sr No', key: 'sr_no', width: 8, align: 'center', type: 'integer' },
            { header: 'Trip Date', key: 'trip_date', width: 14, align: 'center', type: 'date' },
            { header: 'Vehicle Number', key: 'vehicle_number', width: 16, align: 'left' },
            { header: 'Owner Name', key: 'owner_name', width: 18, align: 'left' },
            { header: 'Driver Name', key: 'driver_name', width: 18, align: 'left' },
            { header: 'LR No', key: 'lr_no', width: 14, align: 'center' },
            { header: 'Material', key: 'material_name', width: 16, align: 'left' },
            { header: 'Loading', key: 'loading_location', width: 18, align: 'left' },
            { header: 'Unloading', key: 'unloading_location', width: 18, align: 'left' },
            { header: 'Tons', key: 'tons', width: 10, align: 'right', type: 'number' },
            { header: 'Income', key: 'net_company_income', width: 16, align: 'right', type: 'currency' },
            { header: 'Receivable', key: 'net_receivable', width: 16, align: 'right', type: 'currency' },
            { header: 'Received', key: 'paid_amount', width: 14, align: 'right', type: 'currency' },
            { header: 'Pending', key: 'pending', width: 14, align: 'right', type: 'currency' },
            { header: 'Status', key: 'payment_status', width: 12, align: 'center' },
          ],
          totals: [
            { label: 'Total Trips', columnKey: 'sr_no', value: filtered.length },
            { label: 'Total Tons', columnKey: 'tons', value: filtered.reduce((s, r) => s + r.bill.tons, 0) },
            { label: 'Total Income', columnKey: 'net_company_income', value: filtered.reduce((s, r) => s + r.bill.net_company_income, 0) },
            { label: 'Total Receivable', columnKey: 'net_receivable', value: filtered.reduce((s, r) => s + r.bill.net_receivable, 0) },
            { label: 'Total Received', columnKey: 'paid_amount', value: filtered.reduce((s, r) => s + r.bill.paid_amount, 0) },
          ],
        }}
      />
    </div>
  );
}

// ---- Report table renderer ----
function TransportReportTable({ reportType, data, tr, ownerNameForVehicle }: { reportType: TransportReportType; data: CombinedRow[]; tr: (k: string) => string; ownerNameForVehicle: (vn: string) => string }) {
  // Base columns for daily/detail reports
  const baseCols: Column<CombinedRow>[] = [
    { key: 'date', label: tr('date'), sortable: true, sortValue: (r) => r.bill.trip_date, render: (r) => formatDate(r.bill.trip_date) },
    { key: 'vehicle', label: tr('vehicleNumber'), sortable: true, sortValue: (r) => r.bill.vehicle_number, render: (r) => r.bill.vehicle_number },
    { key: 'owner', label: 'Owner Name', sortable: true, sortValue: (r) => ownerNameForVehicle(r.bill.vehicle_number), render: (r) => ownerNameForVehicle(r.bill.vehicle_number) || '—' },
    { key: 'driver', label: tr('driverName'), sortable: true, sortValue: (r) => r.bill.driver_name, render: (r) => r.bill.driver_name },
    { key: 'lr', label: tr('lrNo'), sortable: true, sortValue: (r) => r.bill.lr_no || '', render: (r) => r.bill.lr_no || '—' },
    { key: 'material', label: tr('material'), sortable: true, sortValue: (r) => r.bill.material_name || '', render: (r) => r.bill.material_name || '—' },
    { key: 'from', label: 'From', sortable: true, sortValue: (r) => r.bill.loading_location, render: (r) => r.bill.loading_location },
    { key: 'to', label: 'To', sortable: true, sortValue: (r) => r.bill.unloading_location, render: (r) => r.bill.unloading_location },
    { key: 'tons', label: tr('tons'), align: 'right', sortable: true, sortValue: (r) => r.bill.tons, render: (r) => r.bill.tons, totalValue: (rows) => rows.reduce((s, r) => s + r.bill.tons, 0) },
    { key: 'income', label: tr('income'), align: 'right', sortable: true, sortValue: (r) => r.bill.net_company_income, render: (r) => <span className="text-emerald-600">{formatCurrency(r.bill.net_company_income)}</span>, totalValue: (rows) => <span className="text-emerald-600">{formatCurrency(rows.reduce((s, r) => s + r.bill.net_company_income, 0))}</span> },
    { key: 'receivable', label: tr('netReceivable'), align: 'right', sortable: true, sortValue: (r) => r.bill.net_receivable, render: (r) => formatCurrency(r.bill.net_receivable), totalValue: (rows) => formatCurrency(rows.reduce((s, r) => s + r.bill.net_receivable, 0)) },
    { key: 'received', label: tr('amountReceived'), align: 'right', sortable: true, sortValue: (r) => r.bill.paid_amount, render: (r) => formatCurrency(r.bill.paid_amount), totalValue: (rows) => formatCurrency(rows.reduce((s, r) => s + r.bill.paid_amount, 0)) },
    { key: 'pending', label: tr('pendingAmount'), align: 'right', sortable: true, sortValue: (r) => r.bill.net_receivable - r.bill.paid_amount, render: (r) => <span className={r.bill.net_receivable - r.bill.paid_amount > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>{formatCurrency(r.bill.net_receivable - r.bill.paid_amount)}</span>, totalValue: (rows) => <span className="text-amber-600">{formatCurrency(rows.reduce((s, r) => s + (r.bill.net_receivable - r.bill.paid_amount), 0))}</span> },
    { key: 'status', label: tr('status'), align: 'center', render: (r) => <Badge color={r.bill.payment_status === 'paid' ? 'green' : r.bill.payment_status === 'partial' ? 'amber' : 'red'}>{r.bill.payment_status}</Badge> },
  ];

  // Group helper
  type GroupRow = { key: string; trips: number; tons: number; income: number; receivable: number; received: number; pending: number; diesel: number; maintenance: number; advance: number; wage: number; expense: number; profit: number };

  const groupByField = (field: (r: CombinedRow) => string): GroupRow[] => {
    const map = new Map<string, GroupRow>();
    data.forEach((r) => {
      const k = field(r);
      const prev = map.get(k) || { key: k, trips: 0, tons: 0, income: 0, receivable: 0, received: 0, pending: 0, diesel: 0, maintenance: 0, advance: 0, wage: 0, expense: 0, profit: 0 };
      prev.trips++;
      prev.tons += r.bill.tons;
      prev.income += r.bill.net_company_income;
      prev.receivable += r.bill.net_receivable;
      prev.received += r.bill.paid_amount;
      prev.pending += r.bill.net_receivable - r.bill.paid_amount;
      prev.diesel += r.mar?.diesel_cost || 0;
      prev.maintenance += r.mar?.maintenance || 0;
      prev.advance += r.bill.advance;
      prev.wage += r.mar?.driver_wage || 0;
      prev.expense += r.mar?.total_expense || 0;
      prev.profit += r.mar?.trip_profit || 0;
      map.set(k, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.income - a.income);
  };

  // Vehicle-wise group columns
  const vehicleGroupCols: Column<GroupRow>[] = [
    { key: 'name', label: tr('vehicleNumber'), sortable: true, sortValue: (r) => r.key, render: (r) => r.key },
    { key: 'trips', label: tr('totalTrips'), align: 'right', sortable: true, sortValue: (r) => r.trips, render: (r) => r.trips, totalValue: (rows) => rows.reduce((s, r) => s + r.trips, 0) },
    { key: 'tons', label: tr('tons'), align: 'right', sortable: true, sortValue: (r) => r.tons, render: (r) => r.tons, totalValue: (rows) => rows.reduce((s, r) => s + r.tons, 0) },
    { key: 'income', label: tr('income'), align: 'right', sortable: true, sortValue: (r) => r.income, render: (r) => <span className="text-emerald-600">{formatCurrency(r.income)}</span>, totalValue: (rows) => <span className="text-emerald-600">{formatCurrency(rows.reduce((s, r) => s + r.income, 0))}</span> },
    { key: 'expense', label: tr('totalExpense'), align: 'right', sortable: true, sortValue: (r) => r.expense, render: (r) => <span className="text-rose-600">{formatCurrency(r.expense)}</span>, totalValue: (rows) => <span className="text-rose-600">{formatCurrency(rows.reduce((s, r) => s + r.expense, 0))}</span> },
    { key: 'profit', label: tr('tripProfit'), align: 'right', sortable: true, sortValue: (r) => r.profit, render: (r) => <span className={`font-bold ${r.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(r.profit)}</span>, totalValue: (rows) => <span className={rows.reduce((s, r) => s + r.profit, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(rows.reduce((s, r) => s + r.profit, 0))}</span> },
    { key: 'receivable', label: tr('netReceivable'), align: 'right', sortable: true, sortValue: (r) => r.receivable, render: (r) => formatCurrency(r.receivable), totalValue: (rows) => formatCurrency(rows.reduce((s, r) => s + r.receivable, 0)) },
    { key: 'received', label: tr('amountReceived'), align: 'right', sortable: true, sortValue: (r) => r.received, render: (r) => formatCurrency(r.received), totalValue: (rows) => formatCurrency(rows.reduce((s, r) => s + r.received, 0)) },
    { key: 'pending', label: tr('pendingAmount'), align: 'right', sortable: true, sortValue: (r) => r.pending, render: (r) => <span className={r.pending > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>{formatCurrency(r.pending)}</span>, totalValue: (rows) => <span className="text-amber-600">{formatCurrency(rows.reduce((s, r) => s + r.pending, 0))}</span> },
  ];

  // Driver-wise columns
  const driverGroupCols: Column<GroupRow>[] = [
    { key: 'name', label: tr('driverName'), sortable: true, sortValue: (r) => r.key, render: (r) => r.key },
    { key: 'trips', label: tr('totalTrips'), align: 'right', sortable: true, sortValue: (r) => r.trips, render: (r) => r.trips, totalValue: (rows) => rows.reduce((s, r) => s + r.trips, 0) },
    { key: 'wage', label: tr('driverWage'), align: 'right', sortable: true, sortValue: (r) => r.wage, render: (r) => formatCurrency(r.wage), totalValue: (rows) => formatCurrency(rows.reduce((s, r) => s + r.wage, 0)) },
    { key: 'income', label: tr('income'), align: 'right', sortable: true, sortValue: (r) => r.income, render: (r) => <span className="text-emerald-600">{formatCurrency(r.income)}</span>, totalValue: (rows) => <span className="text-emerald-600">{formatCurrency(rows.reduce((s, r) => s + r.income, 0))}</span> },
    { key: 'profit', label: tr('tripProfit'), align: 'right', sortable: true, sortValue: (r) => r.profit, render: (r) => <span className={`font-bold ${r.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(r.profit)}</span>, totalValue: (rows) => <span className={rows.reduce((s, r) => s + r.profit, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(rows.reduce((s, r) => s + r.profit, 0))}</span> },
  ];

  // Monthly/dateWise columns
  const dateGroupCols: Column<GroupRow>[] = [
    { key: 'date', label: tr('date'), sortable: true, sortValue: (r) => r.key, render: (r) => r.key.length === 7 ? new Date(r.key + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : formatDate(r.key) },
    { key: 'trips', label: tr('totalTrips'), align: 'right', sortable: true, sortValue: (r) => r.trips, render: (r) => r.trips, totalValue: (rows) => rows.reduce((s, r) => s + r.trips, 0) },
    { key: 'tons', label: tr('tons'), align: 'right', sortable: true, sortValue: (r) => r.tons, render: (r) => r.tons, totalValue: (rows) => rows.reduce((s, r) => s + r.tons, 0) },
    { key: 'income', label: tr('income'), align: 'right', sortable: true, sortValue: (r) => r.income, render: (r) => <span className="text-emerald-600">{formatCurrency(r.income)}</span>, totalValue: (rows) => <span className="text-emerald-600">{formatCurrency(rows.reduce((s, r) => s + r.income, 0))}</span> },
    { key: 'expense', label: tr('totalExpense'), align: 'right', sortable: true, sortValue: (r) => r.expense, render: (r) => <span className="text-rose-600">{formatCurrency(r.expense)}</span>, totalValue: (rows) => <span className="text-rose-600">{formatCurrency(rows.reduce((s, r) => s + r.expense, 0))}</span> },
    { key: 'profit', label: tr('tripProfit'), align: 'right', sortable: true, sortValue: (r) => r.profit, render: (r) => <span className={`font-bold ${r.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(r.profit)}</span>, totalValue: (rows) => <span className={rows.reduce((s, r) => s + r.profit, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(rows.reduce((s, r) => s + r.profit, 0))}</span> },
    { key: 'received', label: tr('amountReceived'), align: 'right', sortable: true, sortValue: (r) => r.received, render: (r) => formatCurrency(r.received), totalValue: (rows) => formatCurrency(rows.reduce((s, r) => s + r.received, 0)) },
    { key: 'pending', label: tr('pendingAmount'), align: 'right', sortable: true, sortValue: (r) => r.pending, render: (r) => <span className={r.pending > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>{formatCurrency(r.pending)}</span>, totalValue: (rows) => <span className="text-amber-600">{formatCurrency(rows.reduce((s, r) => s + r.pending, 0))}</span> },
  ];

  // Paid / Pending filtered
  const paidData = data.filter((r) => r.bill.payment_status === 'paid');
  const pendingData = data.filter((r) => r.bill.payment_status !== 'paid');

  switch (reportType) {
    case 'daily':
    case 'invoiceRegister':
      return <ReportTable columns={baseCols} rows={data} rowKey={(r) => r.bill.id} getSerialDate={(r) => r.bill.trip_date} />;
    case 'paidBills':
      return <ReportTable columns={baseCols} rows={paidData} rowKey={(r) => r.bill.id} getSerialDate={(r) => r.bill.trip_date} />;
    case 'pendingBills':
    case 'outstanding':
      return <ReportTable columns={baseCols} rows={pendingData} rowKey={(r) => r.bill.id} getSerialDate={(r) => r.bill.trip_date} />;
    case 'dateWise':
      return <ReportTable columns={dateGroupCols} rows={groupByField((r) => r.bill.trip_date)} rowKey={(r) => r.key} getSerialDate={(r) => r.key} />;
    case 'monthly':
      return <ReportTable columns={dateGroupCols} rows={groupByField((r) => r.bill.trip_date.slice(0, 7))} rowKey={(r) => r.key} getSerialDate={(r) => r.key} />;
    case 'vehicle':
    case 'vehicleProfit':
    case 'vehicleUtil':
    case 'ledger':
      return <ReportTable columns={vehicleGroupCols} rows={groupByField((r) => r.bill.vehicle_number)} rowKey={(r) => r.key} showSerial />;
    case 'driver':
    case 'driverPayment':
      return <ReportTable columns={driverGroupCols} rows={groupByField((r) => r.bill.driver_name)} rowKey={(r) => r.key} showSerial />;
    case 'lrNumber':
      return <ReportTable columns={baseCols.filter((c) => ['date', 'vehicle', 'driver', 'lr', 'material', 'from', 'to', 'tons', 'income', 'status'].includes(c.key))} rows={data} rowKey={(r) => r.bill.id} getSerialDate={(r) => r.bill.trip_date} />;
    case 'material':
      return <ReportTable columns={vehicleGroupCols.slice(0, 5)} rows={groupByField((r) => r.bill.material_name || 'Unknown')} rowKey={(r) => r.key} showSerial />;
    case 'loading':
      return <ReportTable columns={vehicleGroupCols.slice(0, 5)} rows={groupByField((r) => r.bill.loading_location)} rowKey={(r) => r.key} showSerial />;
    case 'unloading':
    case 'customer':
    case 'collection':
      return <ReportTable columns={vehicleGroupCols.slice(0, 5)} rows={groupByField((r) => r.bill.unloading_location)} rowKey={(r) => r.key} showSerial />;
    case 'companyIncome':
      return <ReportTable columns={[
        ...vehicleGroupCols.slice(0, 3),
        { key: 'income', label: tr('companyIncome'), align: 'right', sortable: true, sortValue: (r) => r.income, render: (r) => <span className="text-emerald-600">{formatCurrency(r.income)}</span>, totalValue: (rows) => <span className="text-emerald-600">{formatCurrency(rows.reduce((s, r) => s + r.income, 0))}</span> },
        { key: 'receivable', label: tr('netReceivable'), align: 'right', sortable: true, sortValue: (r) => r.receivable, render: (r) => formatCurrency(r.receivable), totalValue: (rows) => formatCurrency(rows.reduce((s, r) => s + r.receivable, 0)) },
        { key: 'received', label: tr('amountReceived'), align: 'right', sortable: true, sortValue: (r) => r.received, render: (r) => formatCurrency(r.received), totalValue: (rows) => formatCurrency(rows.reduce((s, r) => s + r.received, 0)) },
      ]} rows={groupByField((r) => r.bill.vehicle_number)} rowKey={(r) => r.key} showSerial />;
    case 'diesel':
      return <ReportTable columns={[
        vehicleGroupCols[0],
        { key: 'trips', label: tr('totalTrips'), align: 'right', sortable: true, sortValue: (r) => r.trips, render: (r) => r.trips, totalValue: (rows) => rows.reduce((s, r) => s + r.trips, 0) },
        { key: 'diesel', label: tr('dieselExpenses'), align: 'right', sortable: true, sortValue: (r) => r.diesel, render: (r) => <span className="text-violet-600">{formatCurrency(r.diesel)}</span>, totalValue: (rows) => <span className="text-violet-600">{formatCurrency(rows.reduce((s, r) => s + r.diesel, 0))}</span> },
      ]} rows={groupByField((r) => r.bill.vehicle_number)} rowKey={(r) => r.key} showSerial />;
    case 'maintenance':
      return <ReportTable columns={[
        vehicleGroupCols[0],
        { key: 'trips', label: tr('totalTrips'), align: 'right', sortable: true, sortValue: (r) => r.trips, render: (r) => r.trips, totalValue: (rows) => rows.reduce((s, r) => s + r.trips, 0) },
        { key: 'maint', label: tr('maintenanceExpenses'), align: 'right', sortable: true, sortValue: (r) => r.maintenance, render: (r) => <span className="text-slate-600">{formatCurrency(r.maintenance)}</span>, totalValue: (rows) => <span className="text-slate-600">{formatCurrency(rows.reduce((s, r) => s + r.maintenance, 0))}</span> },
      ]} rows={groupByField((r) => r.bill.vehicle_number)} rowKey={(r) => r.key} showSerial />;
    case 'advance':
      return <ReportTable columns={[
        { key: 'date', label: tr('date'), sortable: true, sortValue: (r) => r.bill.trip_date, render: (r) => formatDate(r.bill.trip_date) },
        { key: 'vehicle', label: tr('vehicleNumber'), sortable: true, sortValue: (r) => r.bill.vehicle_number, render: (r) => r.bill.vehicle_number },
        { key: 'driver', label: tr('driverName'), sortable: true, sortValue: (r) => r.bill.driver_name, render: (r) => r.bill.driver_name },
        { key: 'advance', label: tr('advance'), align: 'right', sortable: true, sortValue: (r) => r.bill.advance, render: (r) => <span className="text-amber-600">{formatCurrency(r.bill.advance)}</span>, totalValue: (rows) => <span className="text-amber-600">{formatCurrency(rows.reduce((s, r) => s + r.bill.advance, 0))}</span> },
      ]} rows={data} rowKey={(r) => r.bill.id} getSerialDate={(r) => r.bill.trip_date} />;
    case 'tripProfit':
      return <ReportTable columns={[
        { key: 'date', label: tr('date'), sortable: true, sortValue: (r) => r.bill.trip_date, render: (r) => formatDate(r.bill.trip_date) },
        { key: 'vehicle', label: tr('vehicleNumber'), sortable: true, sortValue: (r) => r.bill.vehicle_number, render: (r) => r.bill.vehicle_number },
        { key: 'income', label: tr('income'), align: 'right', sortable: true, sortValue: (r) => r.bill.net_company_income, render: (r) => <span className="text-emerald-600">{formatCurrency(r.bill.net_company_income)}</span>, totalValue: (rows) => <span className="text-emerald-600">{formatCurrency(rows.reduce((s, r) => s + r.bill.net_company_income, 0))}</span> },
        { key: 'expense', label: tr('totalExpense'), align: 'right', sortable: true, sortValue: (r) => r.mar?.total_expense || 0, render: (r) => <span className="text-rose-600">{formatCurrency(r.mar?.total_expense || 0)}</span>, totalValue: (rows) => <span className="text-rose-600">{formatCurrency(rows.reduce((s, r) => s + (r.mar?.total_expense || 0), 0))}</span> },
        { key: 'profit', label: tr('tripProfit'), align: 'right', sortable: true, sortValue: (r) => r.mar?.trip_profit || 0, render: (r) => <span className={`font-bold ${(r.mar?.trip_profit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(r.mar?.trip_profit || 0)}</span>, totalValue: (rows) => <span className={rows.reduce((s, r) => s + (r.mar?.trip_profit || 0), 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(rows.reduce((s, r) => s + (r.mar?.trip_profit || 0), 0))}</span> },
      ]} rows={data} rowKey={(r) => r.bill.id} getSerialDate={(r) => r.bill.trip_date} />;
    case 'gstInvoice':
      return <ReportTable columns={[
        { key: 'date', label: tr('date'), sortable: true, sortValue: (r) => r.bill.trip_date, render: (r) => formatDate(r.bill.trip_date) },
        { key: 'vehicle', label: tr('vehicleNumber'), sortable: true, sortValue: (r) => r.bill.vehicle_number, render: (r) => r.bill.vehicle_number },
        { key: 'base', label: 'Base Amount', align: 'right', sortable: true, sortValue: (r) => r.bill.amount_without_gst, render: (r) => formatCurrency(r.bill.amount_without_gst), totalValue: (rows) => formatCurrency(rows.reduce((s, r) => s + r.bill.amount_without_gst, 0)) },
        { key: 'gst', label: 'GST', align: 'right', sortable: true, sortValue: (r) => r.bill.gst_amount, render: (r) => <span className="text-amber-600">{formatCurrency(r.bill.gst_amount)}</span>, totalValue: (rows) => <span className="text-amber-600">{formatCurrency(rows.reduce((s, r) => s + r.bill.gst_amount, 0))}</span> },
        { key: 'total', label: 'Total with GST', align: 'right', sortable: true, sortValue: (r) => r.bill.amount_with_gst, render: (r) => <span className="font-semibold">{formatCurrency(r.bill.amount_with_gst)}</span>, totalValue: (rows) => <span className="font-semibold">{formatCurrency(rows.reduce((s, r) => s + r.bill.amount_with_gst, 0))}</span> },
      ]} rows={data} rowKey={(r) => r.bill.id} getSerialDate={(r) => r.bill.trip_date} />;
    case 'tripSummary':
      return <ReportTable columns={dateGroupCols} rows={groupByField((r) => r.bill.trip_date.slice(0, 7))} rowKey={(r) => r.key} getSerialDate={(r) => r.key} />;
    default:
      return <ReportTable columns={baseCols} rows={data} rowKey={(r) => r.bill.id} getSerialDate={(r) => r.bill.trip_date} />;
  }
}

