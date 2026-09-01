import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Plus, Pencil, Trash2, Milk, Download, TrendingUp, TrendingDown, DollarSign, ChevronDown, Search, CheckCircle, Circle, FileSpreadsheet, Boxes } from 'lucide-react';
import { MilkInvoice } from '@/components/MilkInvoice';
import { ExportModal } from '@/components/ExportModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Card,
  PageHeader,
  Button,
  Input,
  TextArea,
  Modal,
  LoadingSpinner,
  EmptyState,
  KpiCard,
} from '@/components/ui';
import { formatCurrency, formatDate, todayISO, calcMilkMargin } from '@/lib/calc';
import { MilkEntry, District, Product } from '@/types/database';
import { useToast } from '@/components/Toast';

// Searchable district picker used in the Add/Edit modal
function DistrictPicker({
  label,
  value,
  onChange,
  districts,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  districts: District[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = districts.find((d) => d.id === value);

  const filtered = query
    ? districts.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
    : districts;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = (d: District) => {
    onChange(d.id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm hover:border-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search district..."
              className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-400">No results</li>
            )}
            {filtered.map((d) => (
              <li
                key={d.id}
                onClick={() => pick(d)}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-sky-50 hover:text-sky-700 ${d.id === value ? 'font-semibold text-sky-600 bg-sky-50/50' : 'text-slate-700'}`}
              >
                {d.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function MilkModule() {
  const { tr, profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [entries, setEntries] = useState<MilkEntry[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MilkEntry | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [productFilter, setProductFilter] = useState<string>('all');

  const [form, setForm] = useState({
    entry_date: todayISO(),
    product_id: '',
    product_name: '',
    unit: 'L',
    unit_display: 'Litres',
    district_id: '',
    district_name: '',
    purchase_rate: '',
    selling_rate: '',
    quantity: '',
    company_paid: '',
    notes: '',
  });
  const [applyCommission, setApplyCommission] = useState(false);
  const [commissionRate, setCommissionRate] = useState('');
  const [billPaidFilter, setBillPaidFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceSettingsOpen, setInvoiceSettingsOpen] = useState(false);
  const [invoiceFromDate, setInvoiceFromDate] = useState('');
  const [invoiceToDate, setInvoiceToDate] = useState('');
  const [invoiceSettings, setInvoiceSettings] = useState({
    customerName: '',
    customerAddress: '',
    customerGstin: '',
    invoiceDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '.'),
    invoiceNumber: '1',
  });
  const [exportOpen, setExportOpen] = useState(false);

  const hasSelection = selected.size > 0;

  const invoiceEntries = useMemo(() => {
    let base = entries;
    if (invoiceFromDate) base = base.filter((e) => e.entry_date >= invoiceFromDate);
    if (invoiceToDate) base = base.filter((e) => e.entry_date <= invoiceToDate);
    if (hasSelection) base = base.filter((e) => selected.has(e.id));
    return base;
  }, [entries, invoiceFromDate, invoiceToDate, hasSelection, selected]);

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (filteredEntries.length > 0 && filteredEntries.every((e) => selected.has(e.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredEntries.map((e) => e.id)));
    }
  };

  const load = useCallback(async () => {
    if (!profile) return;
    const [milkRes, distRes, prodRes] = await Promise.all([
      supabase.from('milk_entries').select('*').order('entry_date', { ascending: false }),
      supabase.from('districts').select('*').order('name'),
      supabase.from('products').select('*').order('sort_order', { ascending: true }),
    ]);
    setEntries((milkRes.data || []) as MilkEntry[]);
    setDistricts((distRes.data || []) as District[]);
    setProducts((prodRes.data || []) as Product[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const activeProducts = useMemo(() => products.filter((p) => p.is_active), [products]);

  const purchaseRate = parseFloat(form.purchase_rate) || 0;
  const sellingRate = parseFloat(form.selling_rate) || 0;
  const quantity = parseFloat(form.quantity) || 0;
  const purchaseAmount = purchaseRate * quantity;
  const sellingAmount = sellingRate * quantity;
  const rawMargin = calcMilkMargin(purchaseRate, sellingRate, quantity);
  const commissionAmt = applyCommission ? (parseFloat(commissionRate) || 0) * quantity : 0;
  const margin = rawMargin - commissionAmt;

  const onProductChange = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (p) {
      setForm((f) => ({
        ...f,
        product_id: p.id,
        product_name: p.name,
        unit: p.unit,
        unit_display: p.unit_display,
        purchase_rate: f.purchase_rate || String(p.default_purchase_rate),
        selling_rate: f.selling_rate || String(p.default_selling_rate),
      }));
    }
  };

  const openAdd = () => {
    setEditing(null);
    const firstProduct = activeProducts[0];
    setForm({
      entry_date: todayISO(),
      product_id: firstProduct?.id || '',
      product_name: firstProduct?.name || 'Milk',
      unit: firstProduct?.unit || 'L',
      unit_display: firstProduct?.unit_display || 'Litres',
      district_id: '',
      district_name: '',
      purchase_rate: firstProduct ? String(firstProduct.default_purchase_rate) : '',
      selling_rate: firstProduct ? String(firstProduct.default_selling_rate) : '',
      quantity: '',
      company_paid: '',
      notes: '',
    });
    setApplyCommission(false);
    setCommissionRate('');
    setModalOpen(true);
  };

  const openEdit = (e: MilkEntry) => {
    setEditing(e);
    setForm({
      entry_date: e.entry_date,
      product_id: e.product_id || '',
      product_name: e.product_name || 'Milk',
      unit: e.unit || 'L',
      unit_display: e.unit_display || 'Litres',
      district_id: e.district_id || '',
      district_name: e.district_name,
      purchase_rate: String(e.purchase_rate),
      selling_rate: String(e.selling_rate),
      quantity: String(e.quantity),
      company_paid: String(e.company_paid),
      notes: e.notes,
    });
    const hasCommission = (e.commission_rate ?? 0) > 0;
    setApplyCommission(hasCommission);
    setCommissionRate(hasCommission ? String(e.commission_rate) : '');
    setModalOpen(true);
  };

  const onDistrictChange = (id: string) => {
    const d = districts.find((x) => x.id === id);
    setForm((f) => ({ ...f, district_id: id, district_name: d?.name || '' }));
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.product_id) {
      showError('Please select a product');
      return;
    }
    if (!form.district_id) {
      showError('Please select a district');
      return;
    }
    if (quantity <= 0) {
      showError('Quantity must be a positive number');
      return;
    }
    if (purchaseRate <= 0) {
      showError('Purchase rate must be a positive number');
      return;
    }
    if (sellingRate <= 0) {
      showError('Selling rate must be a positive number');
      return;
    }
    setSaving(true);
    try {
      const companyPaid = parseFloat(form.company_paid) || 0;
      const payload = {
        entry_date: form.entry_date,
        product_id: form.product_id || null,
        product_name: form.product_name,
        unit: form.unit,
        unit_display: form.unit_display,
        district_id: form.district_id || null,
        district_name: form.district_name,
        purchase_rate: purchaseRate,
        selling_rate: sellingRate,
        quantity,
        purchase_amount: purchaseAmount,
        selling_amount: sellingAmount,
        margin,
        daily_emi: 0,
        company_paid: companyPaid,
        commission_rate: applyCommission ? (parseFloat(commissionRate) || 0) : 0,
        commission_amount: commissionAmt,
        notes: form.notes,
      };
      let writeError;
      if (editing) {
        ({ error: writeError } = await supabase.from('milk_entries').update(payload).eq('id', editing.id));
      } else {
        ({ error: writeError } = await supabase.from('milk_entries').insert(payload));
      }
      if (writeError) {
        showError('Could not save entry. Please try again.');
        return;
      }
      showSuccess(editing ? 'Entry updated' : 'Entry added');
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr('confirmDelete'))) return;
    const { error } = await supabase.from('milk_entries').delete().eq('id', id);
    if (error) {
      showError('Could not delete entry. Please try again.');
      return;
    }
    showSuccess('Entry deleted');
    load();
  };

  const toggleBillPaid = async (e: MilkEntry) => {
    const newBillPaid = !e.bill_paid;
    const sellingAmount = e.selling_amount || e.selling_rate * e.quantity;
    const newPaidAmount = newBillPaid ? sellingAmount : 0;
    const { error } = await supabase.from('milk_entries').update({
      bill_paid: newBillPaid,
      company_paid: newPaidAmount,
      paid_date: newBillPaid ? new Date().toISOString() : null,
    }).eq('id', e.id);
    if (error) {
      showError('Could not update bill status. Please try again.');
      return;
    }
    load();
  };

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (productFilter !== 'all') {
      result = result.filter((e) => (e.product_id || '') === productFilter);
    }
    if (billPaidFilter === 'paid') result = result.filter((e) => e.bill_paid);
    if (billPaidFilter === 'pending') result = result.filter((e) => !e.bill_paid);
    return result;
  }, [entries, productFilter, billPaidFilter]);

  // KPI source: selected rows when any are checked, otherwise all filtered entries
  const kpiSource = selected.size > 0 ? filteredEntries.filter((e) => selected.has(e.id)) : filteredEntries;

  const totalPurchase = kpiSource.reduce((s, e) => s + (e.purchase_amount || e.purchase_rate * e.quantity), 0);
  const totalSales = kpiSource.reduce((s, e) => s + (e.selling_amount || e.selling_rate * e.quantity), 0);
  const totalMargin = kpiSource.reduce((s, e) => s + e.margin, 0);
  const totalPaid = kpiSource.reduce((s, e) => s + e.company_paid, 0);
  const totalPending = totalSales - totalPaid;
  const totalCommission = kpiSource.reduce((s, e) => s + (e.commission_amount || 0), 0);

  const paidCount = filteredEntries.filter((e) => e.bill_paid).length;
  const pendingCount = filteredEntries.length - paidCount;

  // Product-wise summary (respects product filter + selection)
  const productSummary = useMemo(() => {
    const map = new Map<string, { name: string; unit: string; unit_display: string; qty: number; purchase: number; sales: number; margin: number; entries: number }>();
    kpiSource.forEach((e) => {
      const key = e.product_id || e.product_name || 'milk';
      const name = e.product_name || 'Milk';
      const unit = e.unit || 'L';
      const unit_display = e.unit_display || 'Litres';
      const prev = map.get(key) || { name, unit, unit_display, qty: 0, purchase: 0, sales: 0, margin: 0, entries: 0 };
      prev.qty += e.quantity;
      prev.purchase += e.purchase_amount || e.purchase_rate * e.quantity;
      prev.sales += e.selling_amount || e.selling_rate * e.quantity;
      prev.margin += e.margin;
      prev.entries += 1;
      map.set(key, prev);
    });
    return Array.from(map.values());
  }, [kpiSource]);

  if (loading) return <div><PageHeader title={tr('milkDistribution')} /><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr('milkDistribution')}
        subtitle={tr('milkEntries')}
        action={
          <div className="flex flex-wrap gap-2">
            {(['all', 'paid', 'pending'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setBillPaidFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${billPaidFilter === f ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {f === 'all' ? tr('totalBills') : f === 'paid' ? tr('paidBills') : tr('pendingBills')}
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">
                  {f === 'all' ? filteredEntries.length : f === 'paid' ? paidCount : pendingCount}
                </span>
              </button>
            ))}
            <Button variant="outline" onClick={() => setExportOpen(true)}><Download className="h-4 w-4" />{tr('exportExcel')}</Button>
            <Button variant="outline" onClick={() => setInvoiceSettingsOpen(true)}><FileSpreadsheet className="h-4 w-4" />Generate Invoice</Button>
            <Button onClick={openAdd}><Plus className="h-4 w-4" />{tr('addEntry')}</Button>
          </div>
        }
      />

      {/* Product Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-600">{tr('product')}:</span>
        <button
          onClick={() => setProductFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${productFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          {tr('allProducts')}
        </button>
        {activeProducts.map((p) => (
          <button
            key={p.id}
            onClick={() => setProductFilter(p.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${productFilter === p.id ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* KPI Cards — update live based on selection */}
      <div className="space-y-1.5">
        {hasSelection && (
          <p className="text-xs font-medium text-sky-600">
            Showing totals for {selected.size} selected {selected.size === 1 ? 'row' : 'rows'}
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label={tr('totalPurchase')} value={formatCurrency(totalPurchase)} icon={<TrendingDown className="h-5 w-5" />} color="rose" />
          <KpiCard label={tr('totalSales')} value={formatCurrency(totalSales)} icon={<TrendingUp className="h-5 w-5" />} color="emerald" />
          <KpiCard label={tr('margin')} value={formatCurrency(totalMargin)} icon={<DollarSign className="h-5 w-5" />} color="sky" />
          {totalCommission > 0 && (
            <KpiCard label="Commission" value={formatCurrency(totalCommission)} icon={<DollarSign className="h-5 w-5" />} color="amber" />
          )}
          <KpiCard label={tr('companyPaid')} value={formatCurrency(totalPaid)} icon={<Milk className="h-5 w-5" />} color="emerald" />
          <KpiCard label={tr('pendingAmount')} value={formatCurrency(totalPending)} icon={<Milk className="h-5 w-5" />} color={totalPending > 0 ? 'rose' : 'emerald'} />
        </div>
      </div>

      {/* Product-wise Summary */}
      {productSummary.length > 0 && (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-sky-500" />
            <p className="font-semibold text-slate-800">{tr('productWiseSummary')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2.5 font-bold text-slate-700">{tr('product')}</th>
                  <th className="px-3 py-2.5 text-right font-bold text-slate-700">{tr('totalQuantity')}</th>
                  <th className="px-3 py-2.5 text-right font-bold text-slate-700">{tr('totalPurchase')}</th>
                  <th className="px-3 py-2.5 text-right font-bold text-slate-700">{tr('totalSales')}</th>
                  <th className="px-3 py-2.5 text-right font-bold text-slate-700">{tr('margin')}</th>
                  <th className="px-3 py-2.5 text-right font-bold text-slate-700">{tr('numberOfEntries')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productSummary.map((p) => (
                  <tr key={p.name} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 font-medium text-slate-800">{p.name}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{p.qty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {p.unit}</td>
                    <td className="px-3 py-2.5 text-right text-rose-600">{formatCurrency(p.purchase)}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-600">{formatCurrency(p.sales)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-sky-600">{formatCurrency(p.margin)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{p.entries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Table */}
      {filteredEntries.length === 0 ? (
        <EmptyState
          icon={<Milk className="h-12 w-12" />}
          title={tr('noEntries')}
          action={<Button onClick={openAdd}><Plus className="h-4 w-4" />{tr('addEntry')}</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="sticky-header overflow-auto" style={{ maxHeight: 'calc(100vh - 19rem)' }}>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={filteredEntries.length > 0 && filteredEntries.every((e) => selected.has(e.id))}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700">S.No.</th>
                  <th className="px-4 py-3 font-bold text-slate-700">{tr('date')}</th>
                  <th className="px-4 py-3 font-bold text-slate-700">{tr('product')}</th>
                  <th className="px-4 py-3 font-bold text-slate-700">{tr('district')}</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-700">{tr('purchaseRate')} × Qty</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-700">{tr('purchaseAmount')}</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-700">{tr('sellingRate')} × Qty</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-700">{tr('sellingAmount')}</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-700">{tr('margin')}</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-700">Commission</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-700">{tr('companyPaid')}</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-700">{tr('billPaid')}</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-700">{tr('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((e, idx) => {
                  const isSelected = selected.has(e.id);
                  const unit = e.unit || 'L';
                  return (
                    <tr key={e.id} className={`${isSelected ? 'bg-sky-50/60' : ''} hover:bg-slate-50/50`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(e.id)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-medium text-slate-500">{idx + 1}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(e.entry_date)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                          {e.product_name || 'Milk'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{e.district_name}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{formatCurrency(e.purchase_rate)}</span>
                        <span className="mx-1 text-slate-400">×</span>
                        <span>{e.quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}{unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600">{formatCurrency(e.purchase_amount || e.purchase_rate * e.quantity)}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{formatCurrency(e.selling_rate)}</span>
                        <span className="mx-1 text-slate-400">×</span>
                        <span>{e.quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}{unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(e.selling_amount || e.selling_rate * e.quantity)}</td>
                      <td className="px-4 py-3 text-right font-bold text-sky-600">{formatCurrency(e.margin)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {(e.commission_amount ?? 0) > 0 ? (
                          <span className="text-amber-600 font-medium">{formatCurrency(e.commission_amount)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(e.company_paid)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleBillPaid(e)}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${e.bill_paid ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          {e.bill_paid ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                          {e.bill_paid ? 'Paid' : 'Pending'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(e)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => handleDelete(e.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Export Modal */}
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        dateField="entry_date"
        records={filteredEntries.map((e, idx) => ({
          sr_no: idx + 1, entry_date: e.entry_date, product_name: e.product_name || 'Milk', unit: e.unit || 'L',
          district_name: e.district_name,
          purchase_rate: e.purchase_rate, quantity: e.quantity, purchase_amount: e.purchase_amount || e.purchase_rate * e.quantity,
          selling_rate: e.selling_rate, selling_amount: e.selling_amount || e.selling_rate * e.quantity,
          margin: e.margin, commission_amount: e.commission_amount || 0,
          company_paid: e.company_paid, bill_paid: e.bill_paid ? 'Paid' : 'Pending', notes: e.notes,
        }))}
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
            { header: 'Purchase Rate', key: 'purchase_rate', width: 14, align: 'right', type: 'currency' },
            { header: 'Quantity', key: 'quantity', width: 12, align: 'right', type: 'integer' },
            { header: 'Purchase Amount', key: 'purchase_amount', width: 16, align: 'right', type: 'currency' },
            { header: 'Selling Rate', key: 'selling_rate', width: 14, align: 'right', type: 'currency' },
            { header: 'Selling Amount', key: 'selling_amount', width: 16, align: 'right', type: 'currency' },
            { header: 'Margin', key: 'margin', width: 14, align: 'right', type: 'currency' },
            { header: 'Commission', key: 'commission_amount', width: 14, align: 'right', type: 'currency' },
            { header: 'Company Paid', key: 'company_paid', width: 14, align: 'right', type: 'currency' },
            { header: 'Bill Status', key: 'bill_paid', width: 12, align: 'center' },
            { header: 'Notes', key: 'notes', width: 24, align: 'left' },
          ],
          totals: [
            { label: 'Total Entries', columnKey: 'sr_no', value: filteredEntries.length },
            { label: 'Total Purchase', columnKey: 'purchase_amount', value: filteredEntries.reduce((s, e) => s + (e.purchase_amount || e.purchase_rate * e.quantity), 0) },
            { label: 'Total Sales', columnKey: 'selling_amount', value: filteredEntries.reduce((s, e) => s + (e.selling_amount || e.selling_rate * e.quantity), 0) },
            { label: 'Total Margin', columnKey: 'margin', value: filteredEntries.reduce((s, e) => s + e.margin, 0) },
          ],
        }}
      />

      {/* Invoice Settings Modal */}
      <Modal open={invoiceSettingsOpen} onClose={() => setInvoiceSettingsOpen(false)} title="Invoice Details" size="lg">
        <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice Date Range Filter</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="From Date" type="date" value={invoiceFromDate} onChange={setInvoiceFromDate} />
            <Input label="To Date" type="date" value={invoiceToDate} onChange={setInvoiceToDate} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {invoiceEntries.length} entry(ies) match the selected date range.
            {(invoiceFromDate || invoiceToDate) && (
              <button
                onClick={() => { setInvoiceFromDate(''); setInvoiceToDate(''); }}
                className="ml-2 text-sky-600 hover:underline"
              >Clear dates</button>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Invoice Number" value={invoiceSettings.invoiceNumber} onChange={(v) => setInvoiceSettings((s) => ({ ...s, invoiceNumber: v }))} />
          <Input label="Invoice Date" value={invoiceSettings.invoiceDate} onChange={(v) => setInvoiceSettings((s) => ({ ...s, invoiceDate: v }))} placeholder="DD.MM.YYYY" />
          <Input label="Customer / Bill To Name" value={invoiceSettings.customerName} onChange={(v) => setInvoiceSettings((s) => ({ ...s, customerName: v }))} />
          <Input label="Customer GSTIN" value={invoiceSettings.customerGstin} onChange={(v) => setInvoiceSettings((s) => ({ ...s, customerGstin: v }))} />
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Customer Address</label>
            <textarea
              value={invoiceSettings.customerAddress}
              onChange={(e) => setInvoiceSettings((s) => ({ ...s, customerAddress: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          The invoice will include {invoiceEntries.length} entry(ies) matching the selected date range.
          {hasSelection && selected.size > 0 ? ' Selection from checkboxes also applied.' : ' Select specific entries using the checkboxes to include only those.'}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setInvoiceSettingsOpen(false)}>Cancel</Button>
          <Button onClick={() => { setInvoiceSettingsOpen(false); setInvoiceOpen(true); }}>
            <FileSpreadsheet className="h-4 w-4" /> Preview Invoice
          </Button>
        </div>
      </Modal>

      {/* Invoice Preview */}
      {invoiceOpen && (
        <MilkInvoice
          entries={invoiceEntries}
          settings={invoiceSettings}
          onClose={() => setInvoiceOpen(false)}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? tr('editEntry') : tr('addEntry')} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={tr('date')} type="date" value={form.entry_date} onChange={(v) => setForm({ ...form, entry_date: v })} required />
          {/* Product dropdown */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {tr('product')} <span className="text-red-500">*</span>
            </label>
            <select
              value={form.product_id}
              onChange={(e) => onProductChange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
            >
              <option value="">{tr('selectProduct')}</option>
              {activeProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
              ))}
            </select>
          </div>
          <DistrictPicker
            label={tr('district')}
            value={form.district_id}
            onChange={onDistrictChange}
            districts={districts}
            placeholder={tr('district')}
          />
          <Input label={`${tr('purchaseRate')} (${form.unit})`} type="number" step="0.01" value={form.purchase_rate} onChange={(v) => setForm({ ...form, purchase_rate: v })} required />
          <Input label={`${tr('sellingRate')} (${form.unit})`} type="number" step="0.01" value={form.selling_rate} onChange={(v) => setForm({ ...form, selling_rate: v })} required />
          <Input label={`${tr('quantity')} (${form.unit})`} type="number" step="0.01" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} required />
          <Input label={tr('companyPaid')} type="number" step="0.01" value={form.company_paid} onChange={(v) => setForm({ ...form, company_paid: v })} />
        </div>

        {/* Commission */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={applyCommission}
              onChange={(e) => {
                setApplyCommission(e.target.checked);
                if (!e.target.checked) setCommissionRate('');
              }}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm font-semibold text-slate-700">Apply Commission</span>
          </label>
          {applyCommission && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Commission Rate (₹ per {form.unit})</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-7 pr-3.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Commission Amount (Auto)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                  <input
                    readOnly
                    value={commissionAmt > 0 ? commissionAmt.toFixed(2) : ''}
                    placeholder="0.00"
                    className="w-full cursor-default rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-7 pr-3.5 text-sm font-semibold text-amber-600 placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live calculation breakdown */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-sky-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr('liveCalculation')}</p>
          <div className={`grid gap-4 ${applyCommission ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <div className="rounded-lg border border-rose-100 bg-white p-3 shadow-sm">
              <p className="mb-1 text-xs font-bold text-slate-600">{tr('purchaseAmount')}</p>
              <p className="text-xs text-slate-400">{formatCurrency(purchaseRate)} × {quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}{form.unit}</p>
              <p className="mt-1 text-lg font-bold text-rose-600">{formatCurrency(purchaseAmount)}</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-white p-3 shadow-sm">
              <p className="mb-1 text-xs font-bold text-slate-600">{tr('sellingAmount')}</p>
              <p className="text-xs text-slate-400">{formatCurrency(sellingRate)} × {quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}{form.unit}</p>
              <p className="mt-1 text-lg font-bold text-emerald-600">{formatCurrency(sellingAmount)}</p>
            </div>
            {applyCommission && (
              <div className="rounded-lg border border-amber-100 bg-white p-3 shadow-sm">
                <p className="mb-1 text-xs font-bold text-slate-600">Commission</p>
                <p className="text-xs text-slate-400">{formatCurrency(parseFloat(commissionRate) || 0)} × {quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}{form.unit}</p>
                <p className="mt-1 text-lg font-bold text-amber-600">− {formatCurrency(commissionAmt)}</p>
              </div>
            )}
            <div className="rounded-lg border border-sky-100 bg-white p-3 shadow-sm">
              <p className="mb-1 text-xs font-bold text-slate-600">{tr('margin')}</p>
              <p className="text-xs text-slate-400">{applyCommission ? 'After commission' : `${tr('sellingAmount')} − ${tr('purchaseAmount')}`}</p>
              <p className={`mt-1 text-lg font-bold ${margin >= 0 ? 'text-sky-600' : 'text-rose-600'}`}>{formatCurrency(margin)}</p>
            </div>
          </div>
        </div>

        <TextArea label={tr('notes')} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} className="mt-4" />

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{tr('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? tr('saving') : tr('save')}</Button>
        </div>
      </Modal>
    </div>
  );
}
