import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Milk, Download, Search, Printer, TrendingUp, CheckCircle2,
  Clock, FileText, RefreshCw, IndianRupee,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Button, Badge, LoadingSpinner } from '@/components/ui';
import { ReportTable, type Column } from '@/components/ReportTable';
import { ReportFilters, ReportSummaryCard, getPresetRange, type FilterValues, type FilterConfig } from '@/components/ReportFilters';
import { formatCurrency, formatDate, formatNumber } from '@/lib/calc';
import { ExportModal } from '@/components/ExportModal';
import { MilkEntry, Product } from '@/types/database';
import { useReportSettings } from '@/lib/useReportSettings';

type MilkReportType =
  | 'daily' | 'dateWise' | 'monthly' | 'customer' | 'route' | 'vehicle'
  | 'product' | 'quantity' | 'salesAmount' | 'paidBills' | 'pendingBills'
  | 'outstanding' | 'collection' | 'paymentHistory' | 'ledger' | 'statement'
  | 'profit' | 'gst' | 'invoiceRegister' | 'topCustomers';

const defaultFilters: FilterValues = {
  from: '', to: '', preset: 'thisMonth',
  customer: '', vehicle: '', driver: '', route: '', material: '',
  lrNumber: '', product: '', billStatus: 'all', paymentStatus: 'all',
};

export function MilkReports({ tr }: { tr: (k: string) => string }) {
  const { profile } = useAuth();
  const { isReportActive } = useReportSettings();
  const [reportType, setReportType] = useState<MilkReportType>('daily');
  const [filters, setFilters] = useState<FilterValues>({
    ...defaultFilters,
    ...getPresetRange('thisMonth'),
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<MilkEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const [milkRes, prodRes] = await Promise.all([
      supabase
        .from('milk_entries')
        .select('*')
        .gte('entry_date', filters.from)
        .lte('entry_date', filters.to)
        .order('entry_date', { ascending: false }),
      supabase.from('products').select('*').order('sort_order', { ascending: true }),
    ]);
    setEntries((milkRes.data || []) as MilkEntry[]);
    setProducts((prodRes.data || []) as Product[]);
    setLoading(false);
  }, [profile, filters.from, filters.to]);

  useEffect(() => { load(); }, [load]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = entries;
    if (filters.customer) result = result.filter((e) => e.district_name === filters.customer);
    if (filters.vehicle) result = result.filter((e) => e.district_name === filters.vehicle);
    if (filters.route) result = result.filter((e) => e.district_name === filters.route);
    if (filters.product) result = result.filter((e) => (e.product_name || 'Milk') === filters.product);
    if (filters.billStatus === 'paid') result = result.filter((e) => e.bill_paid);
    if (filters.billStatus === 'pending') result = result.filter((e) => !e.bill_paid);
    if (filters.paymentStatus === 'paid') result = result.filter((e) => (e.selling_amount || e.selling_rate * e.quantity) - e.company_paid <= 0);
    if (filters.paymentStatus === 'pending') result = result.filter((e) => (e.selling_amount || e.selling_rate * e.quantity) - e.company_paid > 0);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.district_name.toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q) ||
        String(e.entry_date).includes(q)
      );
    }
    return result;
  }, [entries, filters, search]);

  // Dashboard summary
  const summary = useMemo(() => {
    const totalSales = filtered.reduce((s, e) => s + (e.selling_amount || e.selling_rate * e.quantity), 0);
    const totalQty = filtered.reduce((s, e) => s + e.quantity, 0);
    const totalReceived = filtered.reduce((s, e) => s + e.company_paid, 0);
    const pendingAmount = totalSales - totalReceived;
    const paidBills = filtered.filter((e) => (e.selling_amount || e.selling_rate * e.quantity) - e.company_paid <= 0).length;
    const pendingBills = filtered.filter((e) => (e.selling_amount || e.selling_rate * e.quantity) - e.company_paid > 0).length;
    const outstandingBills = pendingBills;
    const totalPurchase = filtered.reduce((s, e) => s + (e.purchase_amount || e.purchase_rate * e.quantity), 0);
    const netProfit = totalSales - totalPurchase;
    return { totalSales, totalQty, totalReceived, pendingAmount, paidBills, pendingBills, outstandingBills, netProfit };
  }, [filtered]);

  // Report type options
  const allReportOptions: { value: MilkReportType; label: string }[] = [
    { value: 'daily', label: tr('dailySales') },
    { value: 'dateWise', label: tr('dateWiseSales') },
    { value: 'monthly', label: tr('monthlySales') },
    { value: 'customer', label: tr('customerWiseSales') },
    { value: 'route', label: tr('routeWiseSales') },
    { value: 'vehicle', label: tr('vehicleWiseDelivery') },
    { value: 'product', label: tr('productWiseSales') },
    { value: 'quantity', label: tr('quantityReport') },
    { value: 'salesAmount', label: tr('salesAmountReport') },
    { value: 'paidBills', label: tr('paidBillsReport') },
    { value: 'pendingBills', label: tr('pendingBillsReport') },
    { value: 'outstanding', label: tr('outstandingReport') },
    { value: 'collection', label: tr('collectionReport') },
    { value: 'paymentHistory', label: tr('paymentHistoryReport') },
    { value: 'ledger', label: tr('customerLedger') },
    { value: 'statement', label: tr('customerStatement') },
    { value: 'profit', label: tr('profitReport') },
    { value: 'gst', label: tr('gstSales') },
    { value: 'invoiceRegister', label: tr('invoiceRegister') },
    { value: 'topCustomers', label: tr('topCustomers') },
  ];

  const reportOptions = useMemo(
    () => allReportOptions.filter((opt) => isReportActive(`milk:${opt.value}`)),
    [isReportActive, allReportOptions]
  );

  useEffect(() => {
    if (reportOptions.length > 0 && !reportOptions.some((o) => o.value === reportType)) {
      setReportType(reportOptions[0].value);
    }
  }, [reportOptions, reportType]);

  const filterConfig: FilterConfig = {
    showCustomer: true,
    showRoute: true,
    showProduct: true,
    showBillStatus: true,
    showPaymentStatus: true,
  };

  const customers = useMemo(() => Array.from(new Set(entries.map((e) => e.district_name))).sort(), [entries]);
  const routes = customers;
  const productList = useMemo(() => products.filter((p) => p.is_active).map((p) => p.name), [products]);

  const [exportOpen, setExportOpen] = useState(false);

  const handlePrint = () => window.print();

  return (
    <div className="space-y-5">
      {/* Report selector + actions */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100">
              <Milk className="h-5 w-5 text-sky-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{tr('milkReports')}</h2>
          </div>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as MilkReportType)}
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

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        dateField="entry_date"
        records={filtered.map((e, idx) => {
          const sales = e.selling_amount || e.selling_rate * e.quantity;
          const purchase = e.purchase_amount || e.purchase_rate * e.quantity;
          return {
            sr_no: idx + 1, entry_date: e.entry_date, product_name: e.product_name || 'Milk', unit: e.unit || 'L', district_name: e.district_name, quantity: e.quantity,
            purchase_rate: e.purchase_rate, purchase_amount: purchase, selling_rate: e.selling_rate, selling_amount: sales,
            margin: e.margin, commission_amount: e.commission_amount || 0, company_paid: e.company_paid,
            pending: sales - e.company_paid, bill_paid: e.bill_paid ? 'Paid' : 'Pending', notes: e.notes,
          };
        })}
        config={{
          reportTitle: 'MILK DISTRIBUTION REPORT',
          filenamePrefix: 'Milk_Report',
          dateField: 'entry_date',
          columns: [
            { header: 'Sr No', key: 'sr_no', width: 8, align: 'center', type: 'integer' },
            { header: 'Date', key: 'entry_date', width: 14, align: 'center', type: 'date' },
            { header: 'Product', key: 'product_name', width: 14, align: 'left' },
            { header: 'Unit', key: 'unit', width: 8, align: 'center' },
            { header: 'District', key: 'district_name', width: 20, align: 'left' },
            { header: 'Qty', key: 'quantity', width: 10, align: 'right', type: 'integer' },
            { header: 'Purchase Rate', key: 'purchase_rate', width: 14, align: 'right', type: 'currency' },
            { header: 'Purchase Amt', key: 'purchase_amount', width: 16, align: 'right', type: 'currency' },
            { header: 'Selling Rate', key: 'selling_rate', width: 14, align: 'right', type: 'currency' },
            { header: 'Selling Amt', key: 'selling_amount', width: 16, align: 'right', type: 'currency' },
            { header: 'Margin', key: 'margin', width: 14, align: 'right', type: 'currency' },
            { header: 'Commission', key: 'commission_amount', width: 14, align: 'right', type: 'currency' },
            { header: 'Company Paid', key: 'company_paid', width: 14, align: 'right', type: 'currency' },
            { header: 'Pending', key: 'pending', width: 14, align: 'right', type: 'currency' },
            { header: 'Bill Status', key: 'bill_paid', width: 12, align: 'center' },
            { header: 'Notes', key: 'notes', width: 24, align: 'left' },
          ],
          totals: [
            { label: 'Total Entries', columnKey: 'sr_no', value: filtered.length },
            { label: 'Total Quantity', columnKey: 'quantity', value: filtered.reduce((s, e) => s + e.quantity, 0) },
            { label: 'Total Purchase', columnKey: 'purchase_amount', value: filtered.reduce((s, e) => s + (e.purchase_amount || e.purchase_rate * e.quantity), 0) },
            { label: 'Total Sales', columnKey: 'selling_amount', value: filtered.reduce((s, e) => s + (e.selling_amount || e.selling_rate * e.quantity), 0) },
            { label: 'Total Margin', columnKey: 'margin', value: filtered.reduce((s, e) => s + e.margin, 0) },
          ],
        }}
      />

      {/* Filters */}
      <ReportFilters
        values={filters}
        onChange={setFilters}
        config={filterConfig}
        customers={customers}
        routes={routes}
        products={productList}
        tr={tr}
      />

      {loading ? <LoadingSpinner /> : (
        <>
          {/* Dashboard cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <ReportSummaryCard label={tr('totalSales')} value={formatCurrency(summary.totalSales)} color="sky" icon={<IndianRupee className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('totalQuantity')} value={(() => { const byUnit = new Map<string, number>(); filtered.forEach((e) => byUnit.set(e.unit || 'L', (byUnit.get(e.unit || 'L') || 0) + e.quantity)); return Array.from(byUnit.entries()).map(([u, q]) => `${formatNumber(q, 0)} ${u}`).join('  '); })()} color="violet" icon={<Milk className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('amountReceived')} value={formatCurrency(summary.totalReceived)} color="emerald" icon={<CheckCircle2 className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('pendingAmount')} value={formatCurrency(summary.pendingAmount)} color="amber" icon={<Clock className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('outstandingBills')} value={String(summary.outstandingBills)} color="rose" icon={<FileText className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('paidBills')} value={String(summary.paidBills)} color="emerald" icon={<CheckCircle2 className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('pendingBills')} value={String(summary.pendingBills)} color="amber" icon={<Clock className="h-4 w-4" />} />
            <ReportSummaryCard label={tr('netProfit')} value={formatCurrency(summary.netProfit)} color={summary.netProfit >= 0 ? 'sky' : 'rose'} icon={<TrendingUp className="h-4 w-4" />} />
          </div>

          {/* Product-wise summary */}
          {(() => {
            const prodMap = new Map<string, { name: string; unit: string; qty: number; purchase: number; sales: number; margin: number; entries: number }>();
            filtered.forEach((e) => {
              const name = e.product_name || 'Milk';
              const unit = e.unit || 'L';
              const prev = prodMap.get(name) || { name, unit, qty: 0, purchase: 0, sales: 0, margin: 0, entries: 0 };
              prev.qty += e.quantity;
              prev.purchase += e.purchase_amount || e.purchase_rate * e.quantity;
              prev.sales += e.selling_amount || e.selling_rate * e.quantity;
              prev.margin += e.margin;
              prev.entries += 1;
              prodMap.set(name, prev);
            });
            const rows = Array.from(prodMap.values()).sort((a, b) => a.name.localeCompare(b.name));
            if (rows.length === 0) return null;
            return (
              <Card className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <p className="font-semibold text-slate-800">{tr('productWiseSummary')}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-2 font-bold text-slate-700">{tr('product')}</th>
                        <th className="px-3 py-2 text-right font-bold text-slate-700">{tr('totalQuantity')}</th>
                        <th className="px-3 py-2 text-right font-bold text-slate-700">{tr('totalPurchase')}</th>
                        <th className="px-3 py-2 text-right font-bold text-slate-700">{tr('totalSales')}</th>
                        <th className="px-3 py-2 text-right font-bold text-slate-700">{tr('margin')}</th>
                        <th className="px-3 py-2 text-right font-bold text-slate-700">{tr('numberOfEntries')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r) => (
                        <tr key={r.name} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 font-medium text-slate-800">{r.name}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{r.qty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {r.unit}</td>
                          <td className="px-3 py-2 text-right text-rose-600">{formatCurrency(r.purchase)}</td>
                          <td className="px-3 py-2 text-right text-emerald-600">{formatCurrency(r.sales)}</td>
                          <td className="px-3 py-2 text-right font-bold text-sky-600">{formatCurrency(r.margin)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{r.entries}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })()}

          {/* Report table */}
          <MilkReportTable reportType={reportType} data={filtered} tr={tr} />
        </>
      )}
    </div>
  );
}

// ---- Report table renderer ----
function MilkReportTable({ reportType, data, tr }: { reportType: MilkReportType; data: MilkEntry[]; tr: (k: string) => string }) {
  const salesOf = (e: MilkEntry) => e.selling_amount || e.selling_rate * e.quantity;
  const purchaseOf = (e: MilkEntry) => e.purchase_amount || e.purchase_rate * e.quantity;

  // Daily Sales Report
  const dailyCols: Column<MilkEntry>[] = [
    { key: 'date', label: tr('date'), sortable: true, sortValue: (e) => e.entry_date, render: (e) => formatDate(e.entry_date) },
    { key: 'product', label: tr('product'), sortable: true, sortValue: (e) => e.product_name || 'Milk', render: (e) => <span className="rounded bg-sky-50 px-1.5 py-0.5 text-xs font-semibold text-sky-700">{e.product_name || 'Milk'}</span> },
    { key: 'district', label: tr('district'), sortable: true, sortValue: (e) => e.district_name, render: (e) => e.district_name },
    { key: 'qty', label: tr('quantity'), align: 'right', sortable: true, sortValue: (e) => e.quantity, render: (e) => `${formatNumber(e.quantity, 0)} ${e.unit || 'L'}` },
    { key: 'purchase', label: tr('purchase'), align: 'right', sortable: true, sortValue: (e) => purchaseOf(e), render: (e) => <span className="text-rose-600">{formatCurrency(purchaseOf(e))}</span>, totalValue: (rows) => <span className="text-rose-600">{formatCurrency(rows.reduce((s, e) => s + purchaseOf(e), 0))}</span> },
    { key: 'sales', label: tr('totalSales'), align: 'right', sortable: true, sortValue: (e) => salesOf(e), render: (e) => <span className="text-emerald-600">{formatCurrency(salesOf(e))}</span>, totalValue: (rows) => <span className="text-emerald-600">{formatCurrency(rows.reduce((s, e) => s + salesOf(e), 0))}</span> },
    { key: 'margin', label: tr('margin'), align: 'right', sortable: true, sortValue: (e) => e.margin, render: (e) => <span className="font-bold text-sky-600">{formatCurrency(e.margin)}</span>, totalValue: (rows) => <span className="text-sky-600">{formatCurrency(rows.reduce((s, e) => s + e.margin, 0))}</span> },
    { key: 'paid', label: tr('companyPaid'), align: 'right', sortable: true, sortValue: (e) => e.company_paid, render: (e) => formatCurrency(e.company_paid), totalValue: (rows) => formatCurrency(rows.reduce((s, e) => s + e.company_paid, 0)) },
    { key: 'pending', label: tr('pendingAmount'), align: 'right', sortable: true, sortValue: (e) => salesOf(e) - e.company_paid, render: (e) => <span className={salesOf(e) - e.company_paid > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>{formatCurrency(salesOf(e) - e.company_paid)}</span>, totalValue: (rows) => <span className="text-amber-600">{formatCurrency(rows.reduce((s, e) => s + salesOf(e) - e.company_paid, 0))}</span> },
    { key: 'status', label: tr('billStatus'), align: 'center', sortable: false, render: (e) => <Badge color={e.bill_paid ? 'green' : 'amber'}>{e.bill_paid ? tr('paid') : tr('pending')}</Badge> },
  ];

  // For grouped reports (customer, route, product, monthly, dateWise)
  type GroupRow = { key: string; entries: number; qty: number; purchase: number; sales: number; margin: number; commission: number; paid: number; pending: number; unit: string };

  const groupBy = (field: 'district_name' | 'entry_date' | 'month' | 'product_name'): GroupRow[] => {
    const map = new Map<string, GroupRow>();
    data.forEach((e) => {
      const k = field === 'month' ? e.entry_date.slice(0, 7) : field === 'product_name' ? (e.product_name || 'Milk') : (e as Record<string, unknown>)[field] as string;
      const unit = e.unit || 'L';
      const prev = map.get(k) || { key: k, entries: 0, qty: 0, purchase: 0, sales: 0, margin: 0, commission: 0, paid: 0, pending: 0, unit };
      prev.entries++;
      prev.qty += e.quantity;
      prev.purchase += purchaseOf(e);
      prev.sales += salesOf(e);
      prev.margin += e.margin;
      prev.commission += e.commission_amount || 0;
      prev.paid += e.company_paid;
      prev.pending += salesOf(e) - e.company_paid;
      map.set(k, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  };

  const groupCols: Column<GroupRow>[] = [
    { key: 'name', label: tr('district'), sortable: true, sortValue: (r) => r.key, render: (r) => r.key },
    { key: 'entries', label: tr('entries'), align: 'right', sortable: true, sortValue: (r) => r.entries, render: (r) => r.entries, totalValue: (rows) => rows.reduce((s, r) => s + r.entries, 0) },
    { key: 'qty', label: tr('quantity'), align: 'right', sortable: true, sortValue: (r) => r.qty, render: (r) => `${formatNumber(r.qty, 0)} ${r.unit}`, totalValue: (rows) => { const byUnit = new Map<string, number>(); rows.forEach((r) => byUnit.set(r.unit, (byUnit.get(r.unit) || 0) + r.qty)); return Array.from(byUnit.entries()).map(([u, q]) => `${formatNumber(q, 0)} ${u}`).join('  '); } },
    { key: 'purchase', label: tr('purchase'), align: 'right', sortable: true, sortValue: (r) => r.purchase, render: (r) => <span className="text-rose-600">{formatCurrency(r.purchase)}</span>, totalValue: (rows) => <span className="text-rose-600">{formatCurrency(rows.reduce((s, r) => s + r.purchase, 0))}</span> },
    { key: 'sales', label: tr('totalSales'), align: 'right', sortable: true, sortValue: (r) => r.sales, render: (r) => <span className="text-emerald-600">{formatCurrency(r.sales)}</span>, totalValue: (rows) => <span className="text-emerald-600">{formatCurrency(rows.reduce((s, r) => s + r.sales, 0))}</span> },
    { key: 'margin', label: tr('margin'), align: 'right', sortable: true, sortValue: (r) => r.margin, render: (r) => <span className="font-bold text-sky-600">{formatCurrency(r.margin)}</span>, totalValue: (rows) => <span className="text-sky-600">{formatCurrency(rows.reduce((s, r) => s + r.margin, 0))}</span> },
    { key: 'commission', label: 'Commission', align: 'right', sortable: true, sortValue: (r) => r.commission, render: (r) => r.commission > 0 ? <span className="text-amber-600">{formatCurrency(r.commission)}</span> : <span className="text-slate-300">—</span>, totalValue: (rows) => <span className="text-amber-600">{formatCurrency(rows.reduce((s, r) => s + r.commission, 0))}</span> },
    { key: 'paid', label: tr('companyPaid'), align: 'right', sortable: true, sortValue: (r) => r.paid, render: (r) => formatCurrency(r.paid), totalValue: (rows) => formatCurrency(rows.reduce((s, r) => s + r.paid, 0)) },
    { key: 'pending', label: tr('pendingAmount'), align: 'right', sortable: true, sortValue: (r) => r.pending, render: (r) => <span className={r.pending > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>{formatCurrency(r.pending)}</span>, totalValue: (rows) => <span className="text-amber-600">{formatCurrency(rows.reduce((s, r) => s + r.pending, 0))}</span> },
  ];

  // Monthly report columns
  const monthlyCols: Column<GroupRow>[] = [
    { key: 'month', label: 'Month', sortable: true, sortValue: (r) => r.key, render: (r) => new Date(r.key + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) },
    ...groupCols.slice(1),
  ];

  // Date-wise columns
  const dateWiseCols: Column<GroupRow>[] = [
    { key: 'date', label: tr('date'), sortable: true, sortValue: (r) => r.key, render: (r) => formatDate(r.key) },
    ...groupCols.slice(1),
  ];

  // Top customers
  const topCustomerCols: Column<GroupRow>[] = [
    { key: 'rank', label: '#', align: 'center', render: () => '', sortable: false },
    { key: 'name', label: tr('customer'), sortable: true, sortValue: (r) => r.key, render: (r) => r.key },
    { key: 'sales', label: tr('totalSales'), align: 'right', sortable: true, sortValue: (r) => r.sales, render: (r) => <span className="text-emerald-600">{formatCurrency(r.sales)}</span>, totalValue: (rows) => <span className="text-emerald-600">{formatCurrency(rows.reduce((s, r) => s + r.sales, 0))}</span> },
    { key: 'qty', label: tr('quantity'), align: 'right', sortable: true, sortValue: (r) => r.qty, render: (r) => `${formatNumber(r.qty, 0)} ${r.unit}`, totalValue: (rows) => { const byUnit = new Map<string, number>(); rows.forEach((r) => byUnit.set(r.unit, (byUnit.get(r.unit) || 0) + r.qty)); return Array.from(byUnit.entries()).map(([u, q]) => `${formatNumber(q, 0)} ${u}`).join('  '); } },
    { key: 'margin', label: tr('margin'), align: 'right', sortable: true, sortValue: (r) => r.margin, render: (r) => <span className="font-bold text-sky-600">{formatCurrency(r.margin)}</span>, totalValue: (rows) => <span className="text-sky-600">{formatCurrency(rows.reduce((s, r) => s + r.margin, 0))}</span> },
    { key: 'pending', label: tr('pendingAmount'), align: 'right', sortable: true, sortValue: (r) => r.pending, render: (r) => <span className={r.pending > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>{formatCurrency(r.pending)}</span>, totalValue: (rows) => <span className="text-amber-600">{formatCurrency(rows.reduce((s, r) => s + r.pending, 0))}</span> },
  ];

  // Paid/Pending/Outstanding/Collection filtered views
  const paidData = data.filter((e) => salesOf(e) - e.company_paid <= 0);
  const pendingData = data.filter((e) => salesOf(e) - e.company_paid > 0);

  // Render based on report type
  switch (reportType) {
    case 'daily':
    case 'paidBills':
      return <ReportTable columns={dailyCols} rows={reportType === 'paidBills' ? paidData : data} rowKey={(e) => e.id} getSerialDate={(e) => e.entry_date} />;
    case 'pendingBills':
    case 'outstanding':
      return <ReportTable columns={dailyCols} rows={pendingData} rowKey={(e) => e.id} getSerialDate={(e) => e.entry_date} />;
    case 'dateWise':
      return <ReportTable columns={dateWiseCols} rows={groupBy('entry_date')} rowKey={(r) => r.key} getSerialDate={(r) => r.key} />;
    case 'monthly':
      return <ReportTable columns={monthlyCols} rows={groupBy('month')} rowKey={(r) => r.key} getSerialDate={(r) => r.key} />;
    case 'customer':
    case 'route':
    case 'ledger':
    case 'statement':
    case 'collection':
    case 'paymentHistory':
      return <ReportTable columns={groupCols} rows={groupBy('district_name')} rowKey={(r) => r.key} showSerial />;
    case 'product':
      return <ReportTable columns={[
        { key: 'name', label: tr('product'), sortable: true, sortValue: (r) => r.key, render: (r) => <span className="font-semibold text-sky-700">{r.key}</span> },
        ...groupCols.slice(1),
      ]} rows={groupBy('product_name')} rowKey={(r) => r.key} showSerial />;
    case 'vehicle':
      return <ReportTable columns={groupCols} rows={groupBy('district_name')} rowKey={(r) => r.key} showSerial />;
    case 'quantity':
      return <ReportTable columns={[
        ...groupCols.slice(0, 3),
        { key: 'avgRate', label: 'Avg Rate/L', align: 'right', sortable: true, sortValue: (r) => r.qty > 0 ? r.sales / r.qty : 0, render: (r) => formatCurrency(r.qty > 0 ? r.sales / r.qty : 0), totalValue: (rows) => { const tq = rows.reduce((s, r) => s + r.qty, 0); const ts = rows.reduce((s, r) => s + r.sales, 0); return tq > 0 ? formatCurrency(ts / tq) : '—'; } },
      ]} rows={groupBy('district_name')} rowKey={(r) => r.key} showSerial />;
    case 'salesAmount':
      return <ReportTable columns={[
        groupCols[0],
        groupCols[1],
        groupCols[3],
        groupCols[4],
        groupCols[7],
        groupCols[8],
      ]} rows={groupBy('district_name')} rowKey={(r) => r.key} showSerial />;
    case 'profit':
      return <ReportTable columns={[
        groupCols[0],
        { key: 'sales', label: tr('totalSales'), align: 'right', sortable: true, sortValue: (r) => r.sales, render: (r) => <span className="text-emerald-600">{formatCurrency(r.sales)}</span>, totalValue: (rows) => <span className="text-emerald-600">{formatCurrency(rows.reduce((s, r) => s + r.sales, 0))}</span> },
        { key: 'purchase', label: tr('totalPurchase'), align: 'right', sortable: true, sortValue: (r) => r.purchase, render: (r) => <span className="text-rose-600">{formatCurrency(r.purchase)}</span>, totalValue: (rows) => <span className="text-rose-600">{formatCurrency(rows.reduce((s, r) => s + r.purchase, 0))}</span> },
        { key: 'commission', label: 'Commission', align: 'right', sortable: true, sortValue: (r) => r.commission, render: (r) => r.commission > 0 ? <span className="text-amber-600">{formatCurrency(r.commission)}</span> : <span className="text-slate-300">—</span>, totalValue: (rows) => <span className="text-amber-600">{formatCurrency(rows.reduce((s, r) => s + r.commission, 0))}</span> },
        { key: 'margin', label: tr('netProfit'), align: 'right', sortable: true, sortValue: (r) => r.margin, render: (r) => <span className={`font-bold ${r.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(r.margin)}</span>, totalValue: (rows) => <span className={rows.reduce((s, r) => s + r.margin, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(rows.reduce((s, r) => s + r.margin, 0))}</span> },
      ]} rows={groupBy('district_name')} rowKey={(r) => r.key} showSerial />;
    case 'gst':
      return <ReportTable columns={[
        groupCols[0],
        { key: 'sales', label: tr('totalSales'), align: 'right', sortable: true, sortValue: (r) => r.sales, render: (r) => formatCurrency(r.sales), totalValue: (rows) => formatCurrency(rows.reduce((s, r) => s + r.sales, 0)) },
        { key: 'gst', label: 'GST Amount', align: 'right', sortable: true, sortValue: (r) => r.sales * 0.05, render: (r) => <span className="text-amber-600">{formatCurrency(r.sales * 0.05)}</span>, totalValue: (rows) => <span className="text-amber-600">{formatCurrency(rows.reduce((s, r) => s + r.sales * 0.05, 0))}</span> },
        { key: 'total', label: 'Total with GST', align: 'right', sortable: true, sortValue: (r) => r.sales * 1.05, render: (r) => <span className="font-semibold">{formatCurrency(r.sales * 1.05)}</span>, totalValue: (rows) => <span className="font-semibold">{formatCurrency(rows.reduce((s, r) => s + r.sales * 1.05, 0))}</span> },
      ]} rows={groupBy('district_name')} rowKey={(r) => r.key} showSerial />;
    case 'invoiceRegister':
      return <ReportTable columns={[
        { key: 'date', label: tr('date'), sortable: true, sortValue: (e) => e.entry_date, render: (e) => formatDate(e.entry_date) },
        { key: 'product', label: tr('product'), sortable: true, sortValue: (e) => e.product_name || 'Milk', render: (e) => <span className="rounded bg-sky-50 px-1.5 py-0.5 text-xs font-semibold text-sky-700">{e.product_name || 'Milk'}</span> },
        { key: 'district', label: tr('district'), sortable: true, sortValue: (e) => e.district_name, render: (e) => e.district_name },
        { key: 'qty', label: tr('quantity'), align: 'right', sortable: true, sortValue: (e) => e.quantity, render: (e) => `${formatNumber(e.quantity, 0)} ${e.unit || 'L'}` },
        { key: 'amount', label: tr('totalSales'), align: 'right', sortable: true, sortValue: (e) => salesOf(e), render: (e) => formatCurrency(salesOf(e)), totalValue: (rows) => formatCurrency(rows.reduce((s, e) => s + salesOf(e), 0)) },
        { key: 'paid', label: tr('companyPaid'), align: 'right', sortable: true, sortValue: (e) => e.company_paid, render: (e) => formatCurrency(e.company_paid), totalValue: (rows) => formatCurrency(rows.reduce((s, e) => s + e.company_paid, 0)) },
        { key: 'status', label: tr('status'), align: 'center', render: (e) => <Badge color={e.bill_paid ? 'green' : 'amber'}>{e.bill_paid ? tr('paid') : tr('pending')}</Badge> },
      ]} rows={data} rowKey={(e) => e.id} getSerialDate={(e) => e.entry_date} />;
    case 'topCustomers':
      return <ReportTable columns={topCustomerCols} rows={groupBy('district_name').sort((a, b) => b.sales - a.sales)} rowKey={(r) => r.key} showSerial />;
    default:
      return <ReportTable columns={dailyCols} rows={data} rowKey={(e) => e.id} getSerialDate={(e) => e.entry_date} />;
  }
}

