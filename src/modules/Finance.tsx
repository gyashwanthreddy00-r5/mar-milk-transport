import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Download, TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle, AlertCircle, BarChart3, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Card,
  PageHeader,
  Button,
  Input,
  Select,
  Modal,
  Badge,
  LoadingSpinner,
  KpiCard,
} from '@/components/ui';
import { formatCurrency, formatDate, todayISO, firstOfMonthISO } from '@/lib/calc';
import { ExportModal } from '@/components/ExportModal';
import { FinanceEntry, MilkEntry, CompanyBill, MarBill } from '@/types/database';
import { useToast } from '@/components/Toast';

type DateFilter = 'today' | 'range' | 'monthly' | 'yearly';

const CATEGORIES = [
  'milk_income', 'transport_income', 'fuel', 'salary', 'maintenance',
  'emi', 'toll', 'other_expense', 'office', 'general',
];

function getDateRange(filter: DateFilter, from: string, to: string): { from: string; to: string } {
  const today = todayISO();
  if (filter === 'today') return { from: today, to: today };
  if (filter === 'monthly') {
    const d = new Date();
    return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: today };
  }
  if (filter === 'yearly') {
    return { from: `${new Date().getFullYear()}-01-01`, to: today };
  }
  return { from, to };
}

export function FinanceModule() {
  const { tr, profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [milkEntries, setMilkEntries] = useState<MilkEntry[]>([]);
  const [companyBills, setCompanyBills] = useState<CompanyBill[]>([]);
  const [marBills, setMarBills] = useState<MarBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);

  const [dateFilter, setDateFilter] = useState<DateFilter>('monthly');
  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(todayISO());

  const [form, setForm] = useState({
    type: 'income' as 'income' | 'expense',
    category: 'general',
    description: '',
    date: todayISO(),
    amount: '',
  });

  const range = getDateRange(dateFilter, from, to);

  const load = useCallback(async () => {
    if (!profile) return;
    const [finRes, milkRes, cbRes, marRes] = await Promise.all([
      supabase.from('finance').select('*').order('date', { ascending: false }),
      supabase.from('milk_entries').select('*').gte('entry_date', range.from).lte('entry_date', range.to),
      supabase.from('company_bills').select('*').gte('trip_date', range.from).lte('trip_date', range.to),
      supabase.from('mar_bills').select('*').gte('trip_date', range.from).lte('trip_date', range.to),
    ]);
    setEntries((finRes.data || []) as FinanceEntry[]);
    setMilkEntries((milkRes.data || []) as MilkEntry[]);
    setCompanyBills((cbRes.data || []) as CompanyBill[]);
    setMarBills((marRes.data || []) as MarBill[]);
    setLoading(false);
  }, [profile, range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  // Milk metrics
  const milkIncome = milkEntries.reduce((s, e) => s + (e.selling_amount || e.selling_rate * e.quantity), 0);
  const milkExpense = milkEntries.reduce((s, e) => s + (e.purchase_amount || e.purchase_rate * e.quantity), 0);
  const milkMargin = milkEntries.reduce((s, e) => s + e.margin, 0);
  const milkCommission = milkEntries.reduce((s, e) => s + (e.commission_amount || 0), 0);
  const milkPaid = milkEntries.reduce((s, e) => s + e.company_paid, 0);
  const milkPending = milkIncome - milkPaid;

  // Transport metrics
  const transportIncome = companyBills.reduce((s, b) => s + b.net_company_income, 0);
  const transportExpense = marBills.reduce((s, b) => s + b.total_expense, 0);
  const transportProfit = marBills.reduce((s, b) => s + b.trip_profit, 0);
  const transportReceivable = companyBills.reduce((s, b) => s + b.net_receivable, 0);
  const transportReceived = companyBills.reduce((s, b) => s + b.paid_amount, 0);
  const transportPending = transportReceivable - transportReceived;

  // Finance entries filtered by range
  const filteredEntries = entries.filter((e) => e.date >= range.from && e.date <= range.to);
  const finIncome = filteredEntries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const finExpense = filteredEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

  // Overall
  const totalIncome = milkIncome + transportIncome + finIncome;
  const totalExpense = milkExpense + transportExpense + finExpense;
  const netProfit = totalIncome - totalExpense;

  const openAdd = () => {
    setEditing(null);
    setForm({ type: 'income', category: 'general', description: '', date: todayISO(), amount: '' });
    setModalOpen(true);
  };

  const openEdit = (e: FinanceEntry) => {
    setEditing(e);
    setForm({ type: e.type, category: e.category, description: e.description, date: e.date, amount: String(e.amount) });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const amount = parseFloat(form.amount) || 0;
      const payload = { type: form.type, category: form.category, description: form.description, date: form.date, amount };
      let writeError;
      if (editing) {
        ({ error: writeError } = await supabase.from('finance').update(payload).eq('id', editing.id));
      } else {
        ({ error: writeError } = await supabase.from('finance').insert(payload));
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
    const { error } = await supabase.from('finance').delete().eq('id', id);
    if (error) {
      showError('Could not delete entry. Please try again.');
      return;
    }
    showSuccess('Entry deleted');
    load();
  };

  const [exportOpen, setExportOpen] = useState(false);

  if (loading) return <div><PageHeader title={tr('finance')} /><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr('finance')}
        subtitle={tr('financeSummary')}
        action={
          <>
            <Button variant="outline" onClick={() => setExportOpen(true)}><Download className="h-4 w-4" />{tr('exportExcel')}</Button>
            <Button onClick={openAdd}><Plus className="h-4 w-4" />{tr('addEntry')}</Button>
          </>
        }
      />

      {/* Date Filter */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <div className="flex flex-wrap gap-2">
            {(['today', 'monthly', 'yearly', 'range'] as DateFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${dateFilter === f ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {f === 'today' ? tr('today') : f === 'monthly' ? tr('thisMonth') : f === 'yearly' ? tr('thisYear') : tr('dateRange')}
              </button>
            ))}
          </div>
          {dateFilter === 'range' && (
            <div className="flex items-center gap-2">
              <Input type="date" value={from} onChange={setFrom} />
              <span className="text-slate-400">—</span>
              <Input type="date" value={to} onChange={setTo} />
            </div>
          )}
        </div>
      </Card>

      {/* Category Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Milk */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-sky-50 p-2"><TrendingUp className="h-5 w-5 text-sky-600" /></div>
              <div>
                <p className="font-semibold text-slate-900">{tr('milkIncome')}</p>
                <p className="text-xs text-slate-500">{tr('milkExpenses')}</p>
              </div>
            </div>
            <span className={`text-xl font-bold ${milkMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(milkMargin)}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs text-slate-500 mb-1">{tr('totalSales')}</p>
              <p className="font-bold text-emerald-700">{formatCurrency(milkIncome)}</p>
            </div>
            <div className="rounded-lg bg-rose-50 p-3">
              <p className="text-xs text-slate-500 mb-1">{tr('totalPurchase')}</p>
              <p className="font-bold text-rose-700">{formatCurrency(milkExpense)}</p>
            </div>
            <div className="rounded-lg bg-sky-50 p-3">
              <p className="text-xs text-slate-500 mb-1">{tr('margin')}</p>
              <p className="font-bold text-sky-700">{formatCurrency(milkMargin)}</p>
            </div>
            {milkCommission > 0 && (
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs text-slate-500 mb-1">Commission</p>
                <p className="font-bold text-amber-700">{formatCurrency(milkCommission)}</p>
              </div>
            )}
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-1">{tr('companyPaid')}</p>
              <p className="font-bold text-slate-700">{formatCurrency(milkPaid)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs text-slate-500 mb-1">{tr('pendingAmount')}</p>
              <p className="font-bold text-amber-700">{formatCurrency(milkPending)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-1">{tr('entries')}</p>
              <p className="font-bold text-slate-700">{milkEntries.length}</p>
            </div>
          </div>
        </Card>

        {/* Transport */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-50 p-2"><TrendingUp className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="font-semibold text-slate-900">{tr('transportIncome')}</p>
                <p className="text-xs text-slate-500">{tr('transportExpenses')}</p>
              </div>
            </div>
            <span className={`text-xl font-bold ${transportProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(transportProfit)}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs text-slate-500 mb-1">{tr('companyIncome')}</p>
              <p className="font-bold text-emerald-700">{formatCurrency(transportIncome)}</p>
            </div>
            <div className="rounded-lg bg-rose-50 p-3">
              <p className="text-xs text-slate-500 mb-1">{tr('totalExpense')}</p>
              <p className="font-bold text-rose-700">{formatCurrency(transportExpense)}</p>
            </div>
            <div className="rounded-lg bg-sky-50 p-3">
              <p className="text-xs text-slate-500 mb-1">{tr('tripProfit')}</p>
              <p className="font-bold text-sky-700">{formatCurrency(transportProfit)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-1">{tr('amountReceived')}</p>
              <p className="font-bold text-slate-700">{formatCurrency(transportReceived)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs text-slate-500 mb-1">{tr('pendingAmount')}</p>
              <p className="font-bold text-amber-700">{formatCurrency(transportPending)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-1">{tr('totalTrips')}</p>
              <p className="font-bold text-slate-700">{marBills.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label={tr('totalIncome')} value={formatCurrency(totalIncome)} icon={<TrendingUp className="h-5 w-5" />} color="emerald" />
        <KpiCard label={tr('totalExpense')} value={formatCurrency(totalExpense)} icon={<TrendingDown className="h-5 w-5" />} color="rose" />
        <KpiCard label={tr('netProfit')} value={formatCurrency(netProfit)} icon={<DollarSign className="h-5 w-5" />} color={netProfit >= 0 ? 'sky' : 'rose'} />
        {milkCommission > 0 && (
          <KpiCard label="Milk Commission" value={formatCurrency(milkCommission)} icon={<DollarSign className="h-5 w-5" />} color="amber" />
        )}
        <KpiCard label={tr('milkPending')} value={formatCurrency(milkPending)} icon={<Clock className="h-5 w-5" />} color="amber" />
        <KpiCard label={tr('transportPending')} value={formatCurrency(transportPending)} icon={<AlertCircle className="h-5 w-5" />} color="amber" />
        <KpiCard label={tr('totalPaid')} value={formatCurrency(milkPaid + transportReceived)} icon={<CheckCircle className="h-5 w-5" />} color="emerald" />
      </div>

      {/* Finance Entries */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-400" />
            <span className="font-semibold text-slate-800">{tr('financeEntries')}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{filteredEntries.length}</span>
          </div>
          <div className="flex gap-3 text-sm font-medium">
            <span className="text-emerald-600">+{formatCurrency(finIncome)}</span>
            <span className="text-slate-300">|</span>
            <span className="text-rose-600">−{formatCurrency(finExpense)}</span>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">{tr('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">{tr('date')}</th>
                  <th className="px-4 py-3">{tr('type')}</th>
                  <th className="px-4 py-3">{tr('category')}</th>
                  <th className="px-4 py-3">{tr('description')}</th>
                  <th className="px-4 py-3 text-right">{tr('amount')}</th>
                  <th className="px-4 py-3 text-right">{tr('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${e.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {e.type === 'income' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {e.type === 'income' ? tr('income') : tr('expense')}
                      </span>
                    </td>
                    <td className="px-4 py-3"><Badge color="slate">{e.category.replace('_', ' ')}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{e.description}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${e.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {e.type === 'income' ? '+' : '−'}{formatCurrency(e.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(e)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(e.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        dateField="date"
        records={filteredEntries.map((e, idx) => ({
          sr_no: idx + 1, date: e.date, type: e.type, category: e.category.replace(/_/g, ' '), description: e.description, amount: e.amount,
        }))}
        config={{
          reportTitle: 'FINANCE REPORT',
          filenamePrefix: 'Finance_Report',
          dateField: 'date',
          columns: [
            { header: 'Sr No', key: 'sr_no', width: 8, align: 'center', type: 'integer' },
            { header: 'Date', key: 'date', width: 14, align: 'center', type: 'date' },
            { header: 'Type', key: 'type', width: 12, align: 'center' },
            { header: 'Category', key: 'category', width: 18, align: 'left' },
            { header: 'Description', key: 'description', width: 30, align: 'left' },
            { header: 'Amount', key: 'amount', width: 16, align: 'right', type: 'currency' },
          ],
          totals: [
            { label: 'Total Entries', columnKey: 'sr_no', value: filteredEntries.length },
            { label: 'Total Income', columnKey: 'amount', value: filteredEntries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0) },
            { label: 'Total Expense', columnKey: 'amount', value: filteredEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0) },
          ],
        }}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? tr('editEntry') : tr('addEntry')} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={tr('type')}
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v as 'income' | 'expense' })}
              options={[{ value: 'income', label: tr('income') }, { value: 'expense', label: tr('expense') }]}
              required
            />
            <Select
              label={tr('category')}
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              options={CATEGORIES.map((c) => ({ value: c, label: c.replace('_', ' ') }))}
              required
            />
          </div>
          <Input label={tr('description')} value={form.description} onChange={(v) => setForm({ ...form, description: v })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label={tr('date')} type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
            <Input label={tr('amount')} type="number" step="0.01" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{tr('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? tr('saving') : tr('save')}</Button>
        </div>
      </Modal>
    </div>
  );
}
