import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Pencil, Trash2, Truck, Download, Wrench, FileText, CheckCircle, Circle, FileSpreadsheet } from 'lucide-react';
import { TransportInvoice } from '@/components/TransportInvoice';
import { ExportModal } from '@/components/ExportModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Card,
  PageHeader,
  Button,
  Input,
  Select,
  Combobox,
  TextArea,
  Modal,
  Badge,
  LoadingSpinner,
  EmptyState,
  KpiCard,
} from '@/components/ui';
import {
  formatCurrency,
  formatDate,
  todayISO,
  calcCompanyBillTotals,
  calcMarBillTotals,
  calcDailyEmi,
  paymentStatusFromPaid,
} from '@/lib/calc';
import { exportToCSV } from '@/lib/excel';
import {
  CompanyBill,
  MarBill,
  Maintenance,
  Vehicle,
  Location,
  Driver,
  Material,
} from '@/types/database';
import { useToast } from '@/components/Toast';

type SubTab = 'company' | 'mar' | 'maintenance';

export function TransportModule() {
  const { tr } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('company');

  const tabs: { key: SubTab; label: string; icon: typeof Truck }[] = [
    { key: 'company', label: tr('companyBills'), icon: FileText },
    { key: 'mar', label: tr('marBills'), icon: Truck },
    { key: 'maintenance', label: tr('maintenance'), icon: Wrench },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={tr('transport')} subtitle={tr('transportProfit')} />
      <div className="flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                subTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
      {subTab === 'company' && <CompanyBills />}
      {subTab === 'mar' && <MarBills />}
      {subTab === 'maintenance' && <MaintenanceTab />}
    </div>
  );
}

// ===== Company Bills =====
function CompanyBills() {
  const { tr, profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [bills, setBills] = useState<CompanyBill[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyBill | null>(null);
  const [dieselRate, setDieselRate] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (bills.length > 0 && bills.every((b) => selected.has(b.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(bills.map((b) => b.id)));
    }
  };

  const [form, setForm] = useState({
    trip_date: todayISO(),
    vehicle_id: '',
    vehicle_number: '',
    driver_id: '',
    driver_name: '',
    lr_no: '',
    material_name: '',
    loading_location: '',
    unloading_location: '',
    tons: '',
    per_ton: '',
    advance: '',
    advance_company_date: '',
    diesel: '',
    paid_amount: '',
  });
  const [billPaidFilter, setBillPaidFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceWithGst, setInvoiceWithGst] = useState(false);
  const skipAutoAdvance = useRef(false);
  const [invoiceSettingsOpen, setInvoiceSettingsOpen] = useState(false);
  const [invoiceFromDate, setInvoiceFromDate] = useState('');
  const [invoiceToDate, setInvoiceToDate] = useState('');
  const [invoiceSettings, setInvoiceSettings] = useState({
    customerName: 'Satya Syamala Enterprises',
    customerAddress: '4th Floor, Flat no. 402, Sy.no: 145, Laxmi Ganesh Heights\nHydernagar, Kukatpally, Hyderabad - 500085',
    customerGstin: '36AHRPC0682Q1ZQ',
    invoiceDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '.'),
    invoiceNumber: '1',
  });
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [billsRes, vehRes, drvRes, locRes, matRes, setRes] = await Promise.all([
      supabase.from('company_bills').select('*').order('trip_date', { ascending: false }),
      supabase.from('vehicles').select('*').order('vehicle_number'),
      supabase.from('drivers').select('*').eq('is_active', true).order('name'),
      supabase.from('locations').select('*').order('name'),
      supabase.from('materials').select('*').order('name'),
      supabase.from('settings').select('*').maybeSingle(),
    ]);
    setBills((billsRes.data || []) as CompanyBill[]);
    setVehicles((vehRes.data || []) as Vehicle[]);
    setDrivers((drvRes.data || []) as Driver[]);
    setLocations((locRes.data || []) as Location[]);
    setMaterials((matRes.data || []) as Material[]);
    if (setRes.data) {
      setDieselRate((setRes.data as { diesel_rate: number }).diesel_rate || 0);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (skipAutoAdvance.current) return;
    const tons = parseFloat(form.tons) || 0;
    const perTon = parseFloat(form.per_ton) || 0;
    if (tons > 0 && perTon > 0) {
      const autoAdvance = Math.round(tons * perTon * 0.8 * 100) / 100;
      setForm((f) => ({ ...f, advance: String(autoAdvance) }));
    }
  }, [form.tons, form.per_ton]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    skipAutoAdvance.current = false;
    setForm({ trip_date: todayISO(), vehicle_id: '', vehicle_number: '', driver_id: '', driver_name: '', lr_no: '', material_name: '', loading_location: '', unloading_location: '', tons: '', per_ton: '', advance: '', advance_company_date: '', diesel: '', paid_amount: '' });
    setModalOpen(true);
  };

  const openEdit = (b: CompanyBill) => {
    setEditing(b);
    skipAutoAdvance.current = true;
    const matchDriver = drivers.find((d) => d.name === b.driver_name);
    setForm({
      trip_date: b.trip_date,
      vehicle_id: b.vehicle_id || '',
      vehicle_number: b.vehicle_number,
      driver_id: matchDriver?.id || '',
      driver_name: b.driver_name,
      lr_no: b.lr_no || '',
      material_name: b.material_name || '',
      loading_location: b.loading_location || '',
      unloading_location: b.unloading_location,
      tons: String(b.tons),
      per_ton: String(b.per_ton),
      advance: String(b.advance),
      advance_company_date: b.advance_company_date || '',
      diesel: String(b.diesel),
      paid_amount: String(b.paid_amount),
    });
    setModalOpen(true);
  };

  const onVehicleChange = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    const driver = drivers.find((d) => d.id === v?.driver_id);
    setForm((f) => ({
      ...f,
      vehicle_id: id,
      vehicle_number: v?.vehicle_number || '',
      driver_id: driver?.id || f.driver_id,
      driver_name: driver?.name || f.driver_name,
    }));
  };

  const onDriverChange = (id: string) => {
    const d = drivers.find((x) => x.id === id);
    setForm((f) => ({ ...f, driver_id: id, driver_name: d?.name || '' }));
  };

  const advanceAmount = parseFloat(form.advance) || 0;
  const totals = calcCompanyBillTotals(
    parseFloat(form.tons) || 0,
    parseFloat(form.per_ton) || 0,
    0,
    advanceAmount,
    parseFloat(form.diesel) || 0,
    dieselRate
  );
  const advanceExceedsIncome = advanceAmount > totals.grossCompanyIncome;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const tons = parseFloat(form.tons) || 0;
      const perTon = parseFloat(form.per_ton) || 0;
      const advance = parseFloat(form.advance) || 0;
      const diesel = parseFloat(form.diesel) || 0;
      const paidAmount = parseFloat(form.paid_amount) || 0;
      const t = calcCompanyBillTotals(tons, perTon, 0, advance, diesel, dieselRate);
      const status = paymentStatusFromPaid(t.netReceivable, paidAmount);
      const payload = {
        trip_date: form.trip_date,
        vehicle_id: form.vehicle_id || null,
        vehicle_number: form.vehicle_number,
        driver_name: form.driver_name,
        lr_no: form.lr_no || null,
        material_name: form.material_name || null,
        loading_location: form.loading_location,
        unloading_location: form.unloading_location,
        tons, per_ton: perTon,
        amount_without_gst: t.amountWithoutGst,
        gst_amount: t.gstAmount,
        amount_with_gst: t.amountWithGst,
        advance, diesel,
        advance_company_date: advance > 0 ? (form.advance_company_date || null) : null,
        diesel_rate: dieselRate,
        diesel_amount: t.dieselAmount,
        company_income: t.grossCompanyIncome,
        net_company_income: t.netCompanyIncome,
        net_receivable: t.netReceivable,
        paid_amount: paidAmount,
        payment_status: status,
      };
      let writeError;
      if (editing) {
        ({ error: writeError } = await supabase.from('company_bills').update(payload).eq('id', editing.id));
      } else {
        ({ error: writeError } = await supabase.from('company_bills').insert(payload));
      }
      if (writeError) {
        showError('Could not save bill. Please try again.');
        return;
      }
      showSuccess(editing ? 'Bill updated' : 'Bill added');
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr('confirmDelete'))) return;
    const { error } = await supabase.from('company_bills').delete().eq('id', id);
    if (error) {
      showError('Could not delete bill. Please try again.');
      return;
    }
    showSuccess('Bill deleted');
    load();
  };

  const toggleBillPaid = async (b: CompanyBill) => {
    const newBillPaid = !b.bill_paid;
    const newPaidAmount = newBillPaid ? b.net_receivable : 0;
    const newStatus = newBillPaid ? 'paid' : paymentStatusFromPaid(b.net_receivable, 0);
    const { error } = await supabase.from('company_bills').update({
      bill_paid: newBillPaid,
      paid_amount: newPaidAmount,
      payment_status: newStatus,
      paid_date: newBillPaid ? new Date().toISOString() : null,
    }).eq('id', b.id);
    if (error) {
      showError('Could not update bill status. Please try again.');
      return;
    }
    load();
  };

  const ownerNameForVehicle = (vehicleNumber: string) =>
    vehicles.find((v) => v.vehicle_number === vehicleNumber)?.owner_name || '';

  const filteredBills = bills.filter((b) => {
    if (billPaidFilter === 'paid') return b.bill_paid;
    if (billPaidFilter === 'pending') return !b.bill_paid;
    return true;
  });

  const hasSelection = selected.size > 0;
  const invoiceBills = useMemo(() => {
    let base = bills;
    if (invoiceFromDate) base = base.filter((b) => b.trip_date >= invoiceFromDate);
    if (invoiceToDate) base = base.filter((b) => b.trip_date <= invoiceToDate);
    if (hasSelection && selected.size > 0) base = base.filter((b) => selected.has(b.id));
    return base.map((b) => ({ ...b, owner_name: ownerNameForVehicle(b.vehicle_number) }));
  }, [hasSelection, selected, bills, invoiceFromDate, invoiceToDate, vehicles]);
  const kpiSource = hasSelection ? bills.filter((b) => selected.has(b.id)) : filteredBills;
  const totalReceivable = kpiSource.reduce((s, b) => s + b.net_receivable, 0);
  const totalReceived = kpiSource.reduce((s, b) => s + b.paid_amount, 0);
  const totalPending = totalReceivable - totalReceived;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          {hasSelection && (
            <p className="text-xs font-medium text-sky-600">
              Showing totals for {selected.size} selected {selected.size === 1 ? 'row' : 'rows'}
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label={tr('netReceivable')} value={formatCurrency(totalReceivable)} icon={<Truck className="h-5 w-5" />} color="sky" />
            <KpiCard label={tr('paidAmount')} value={formatCurrency(totalReceived)} icon={<Truck className="h-5 w-5" />} color="emerald" />
            <KpiCard label={tr('pending')} value={formatCurrency(totalPending)} icon={<Truck className="h-5 w-5" />} color="rose" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExportOpen(true)}><Download className="h-4 w-4" />{tr('exportExcel')}</Button>
          <Button variant="outline" onClick={() => { setInvoiceWithGst(false); setInvoiceSettingsOpen(true); }}><FileSpreadsheet className="h-4 w-4" />Generate Invoice</Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4" />{tr('addBill')}</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-600">Filter:</span>
        {(['all', 'paid', 'pending'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setBillPaidFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              billPaidFilter === f
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'all' ? 'All' : f === 'paid' ? 'Paid' : 'Pending'}
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-400">{filteredBills.length} bill(s)</span>
      </div>

      {filteredBills.length === 0 ? (
        <EmptyState icon={<FileText className="h-12 w-12" />} title={tr('noData')} action={<Button onClick={openAdd}><Plus className="h-4 w-4" />{tr('addBill')}</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="sticky-header overflow-auto" style={{ maxHeight: 'calc(100vh - 19rem)' }}>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={filteredBills.length > 0 && filteredBills.every((b) => selected.has(b.id))}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                  </th>
                  <th className="px-3 py-3 font-bold text-slate-700">{tr('tripDate')}</th>
                  <th className="px-3 py-3 text-center font-bold text-slate-700">S.No.</th>
                  <th className="px-3 py-3 font-bold text-slate-700">{tr('vehicleNumber')}</th>
                  <th className="px-3 py-3 font-bold text-slate-700">Owner Name</th>
                  <th className="px-3 py-3 font-bold text-slate-700">{tr('driverName')}</th>
                  <th className="px-3 py-3 font-bold text-slate-700">{tr('lrNo')}</th>
                  <th className="px-3 py-3 font-bold text-slate-700">Material</th>
                  <th className="px-3 py-3 font-bold text-slate-700">{tr('loadingLocation')}</th>
                  <th className="px-3 py-3 font-bold text-slate-700">{tr('unloadingLocation')}</th>
                  <th className="px-3 py-3 text-right font-bold text-slate-700">{tr('tons')}</th>
                  <th className="px-3 py-3 text-right font-bold text-slate-700">{tr('netCompanyIncome')}</th>
                  <th className="px-3 py-3 text-right font-bold text-slate-700">{tr('netReceivable')}</th>
                  <th className="px-3 py-3 text-center font-bold text-slate-700">{tr('billPaid')}</th>
                  <th className="px-3 py-3 text-center font-bold text-slate-700">{tr('paymentStatus')}</th>
                  <th className="px-3 py-3 text-right font-bold text-slate-700">{tr('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  return filteredBills.map((b, idx) => {
                  const isSelected = selected.has(b.id);
                  return (
                  <tr key={b.id} className={`${isSelected ? 'bg-sky-50/60' : ''} hover:bg-slate-50/50`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(b.id)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">{formatDate(b.trip_date)}</td>
                    <td className="px-3 py-3 text-center text-sm font-medium text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{b.vehicle_number}</td>
                    <td className="px-3 py-3 text-slate-600">{ownerNameForVehicle(b.vehicle_number) || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{b.driver_name}</td>
                    <td className="px-3 py-3 text-slate-500 text-xs">{b.lr_no || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{b.material_name || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{b.loading_location}</td>
                    <td className="px-3 py-3 text-slate-600">{b.unloading_location}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{b.tons}</td>
                    <td className="px-3 py-3 text-right text-sky-600 font-semibold">{formatCurrency(b.net_company_income)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800">{formatCurrency(b.net_receivable)}</td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => toggleBillPaid(b)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${b.bill_paid ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        {b.bill_paid ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                        {b.bill_paid ? 'Paid' : 'Pending'}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Badge color={b.payment_status === 'paid' ? 'green' : b.payment_status === 'partial' ? 'amber' : 'red'}>
                        {tr(b.payment_status as 'pending' | 'partial' | 'paid')}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(b)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(b.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                  );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Export Modal */}
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        dateField="trip_date"
        records={filteredBills.map((b, idx) => ({
          sr_no: idx + 1, trip_date: b.trip_date, vehicle_number: b.vehicle_number, owner_name: ownerNameForVehicle(b.vehicle_number), driver_name: b.driver_name,
          lr_no: b.lr_no || '', material_name: b.material_name || '', loading_location: b.loading_location, unloading_location: b.unloading_location,
          tons: b.tons, per_ton: b.per_ton, amount_without_gst: b.amount_without_gst, gst_amount: b.gst_amount, amount_with_gst: b.amount_with_gst,
          diesel: b.diesel, diesel_rate: b.diesel_rate, diesel_amount: b.diesel_amount, company_income: b.company_income, net_company_income: b.net_company_income,
          advance: b.advance, advance_company_date: b.advance_company_date || '', net_receivable: b.net_receivable, paid_amount: b.paid_amount,
          bill_paid: b.bill_paid ? 'Paid' : 'Pending', payment_status: b.payment_status,
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
            { header: 'Loading Location', key: 'loading_location', width: 18, align: 'left' },
            { header: 'Unloading Location', key: 'unloading_location', width: 18, align: 'left' },
            { header: 'Tons', key: 'tons', width: 10, align: 'right', type: 'number' },
            { header: 'Per Ton', key: 'per_ton', width: 12, align: 'right', type: 'currency' },
            { header: 'Amount (excl GST)', key: 'amount_without_gst', width: 16, align: 'right', type: 'currency' },
            { header: 'GST Amount', key: 'gst_amount', width: 14, align: 'right', type: 'currency' },
            { header: 'Amount (with GST)', key: 'amount_with_gst', width: 16, align: 'right', type: 'currency' },
            { header: 'Diesel (L)', key: 'diesel', width: 10, align: 'right', type: 'number' },
            { header: 'Diesel Rate', key: 'diesel_rate', width: 12, align: 'right', type: 'currency' },
            { header: 'Diesel Amount', key: 'diesel_amount', width: 14, align: 'right', type: 'currency' },
            { header: 'Company Income', key: 'company_income', width: 16, align: 'right', type: 'currency' },
            { header: 'Net Company Income', key: 'net_company_income', width: 16, align: 'right', type: 'currency' },
            { header: 'Advance', key: 'advance', width: 12, align: 'right', type: 'currency' },
            { header: 'Advance Date', key: 'advance_company_date', width: 14, align: 'center', type: 'date' },
            { header: 'Net Receivable', key: 'net_receivable', width: 16, align: 'right', type: 'currency' },
            { header: 'Paid Amount', key: 'paid_amount', width: 14, align: 'right', type: 'currency' },
            { header: 'Bill Paid', key: 'bill_paid', width: 10, align: 'center' },
            { header: 'Payment Status', key: 'payment_status', width: 14, align: 'center' },
          ],
          totals: [
            { label: 'Total Trips', columnKey: 'sr_no', value: filteredBills.length },
            { label: 'Total Tons', columnKey: 'tons', value: filteredBills.reduce((s, b) => s + b.tons, 0) },
            { label: 'Total Amount', columnKey: 'amount_without_gst', value: filteredBills.reduce((s, b) => s + b.amount_without_gst, 0) },
            { label: 'Total GST', columnKey: 'gst_amount', value: filteredBills.reduce((s, b) => s + b.gst_amount, 0) },
            { label: 'Grand Total', columnKey: 'amount_with_gst', value: filteredBills.reduce((s, b) => s + b.amount_with_gst, 0) },
          ],
        }}
      />

      {/* Invoice Settings Modal */}
      <Modal open={invoiceSettingsOpen} onClose={() => setInvoiceSettingsOpen(false)} title="Invoice Details" size="lg">
        {/* Date Range Filter */}
        <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice Date Range Filter</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="From Date" type="date" value={invoiceFromDate} onChange={setInvoiceFromDate} />
            <Input label="To Date" type="date" value={invoiceToDate} onChange={setInvoiceToDate} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {invoiceBills.length} bill(s) match the selected date range.
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
          The invoice will include {invoiceBills.length} bill(s) matching the selected date range.
          {hasSelection && selected.size > 0 ? ' Selection from checkboxes also applied.' : ' Select specific bills using the checkboxes to include only those.'}
        </p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">GST for this invoice</p>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={invoiceWithGst} onChange={(e) => setInvoiceWithGst(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
            Generate Invoice With GST (CGST 9% + SGST 9%)
          </label>
          <p className="mt-2 text-xs text-slate-500">GST is applied only to this invoice and does not change the transport entry.</p>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setInvoiceSettingsOpen(false)}>Cancel</Button>
          <Button onClick={() => { setInvoiceSettingsOpen(false); setInvoiceOpen(true); }}>
            <FileSpreadsheet className="h-4 w-4" /> Preview Invoice
          </Button>
        </div>
      </Modal>

      {/* Invoice Preview */}
      {invoiceOpen && (
        <TransportInvoice
          bills={invoiceBills}
          settings={invoiceSettings}
          withGst={invoiceWithGst}
          onClose={() => setInvoiceOpen(false)}
          onSettingsChange={setInvoiceSettings}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? tr('editBill') : tr('addBill')} size="xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label={tr('tripDate')} type="date" value={form.trip_date} onChange={(v) => setForm({ ...form, trip_date: v })} required />
          <Select label={tr('vehicleNumber')} value={form.vehicle_id} onChange={onVehicleChange} options={vehicles.map((v) => ({ value: v.id, label: v.vehicle_number }))} placeholder={tr('vehicleNumber')} required />
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Owner Name</p>
            <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-700 font-medium">
              {form.vehicle_id ? (vehicles.find((v) => v.id === form.vehicle_id)?.owner_name || '—') : 'Select vehicle first'}
            </div>
          </div>
          <Select label={tr('driverName')} value={form.driver_id} onChange={onDriverChange} options={drivers.map((d) => ({ value: d.id, label: d.name }))} placeholder={tr('driverName')} required />
          <Input label={tr('lrNo')} type="text" value={form.lr_no} onChange={(v) => setForm({ ...form, lr_no: v })} placeholder={tr('enterLrNumber')} />
          <Select
            label="Material"
            value={form.material_name}
            onChange={(v) => setForm({ ...form, material_name: v })}
            options={materials.map((m) => ({ value: m.name, label: m.name }))}
            placeholder="Select Material"
          />
          <Combobox
            label={tr('loadingLocation')}
            value={form.loading_location}
            onChange={(v) => setForm({ ...form, loading_location: v })}
            options={locations.map((l) => l.name)}
            placeholder="Type or select loading location"
          />
          <Combobox
            label={tr('unloadingLocation')}
            value={form.unloading_location}
            onChange={(v) => setForm({ ...form, unloading_location: v })}
            options={locations.map((l) => l.name)}
            placeholder="Type or select unloading location"
            required
          />
          <Input label={tr('tons')} type="number" step="0.01" value={form.tons} onChange={(v) => { skipAutoAdvance.current = false; setForm({ ...form, tons: v }); }} required />
          <Input label={tr('perTon')} type="number" step="0.01" value={form.per_ton} onChange={(v) => { skipAutoAdvance.current = false; setForm({ ...form, per_ton: v }); }} required />
          <Input label={tr('advance')} type="number" step="0.01" value={form.advance} onChange={(v) => { skipAutoAdvance.current = true; setForm({ ...form, advance: v, ...(parseFloat(v) || 0 === 0 ? { advance_company_date: '' } : {}) }); }} />
          <Input
            label={tr('advanceDate')}
            type="date"
            value={form.advance_company_date}
            onChange={(v) => setForm({ ...form, advance_company_date: v })}
            disabled={advanceAmount === 0}
            required={advanceAmount > 0}
          />
          <Input label={tr('dieselLitres')} type="number" step="0.01" value={form.diesel} onChange={(v) => setForm({ ...form, diesel: v })} />
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">{tr('dieselRate')} (from Settings)</p>
            <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-600 font-medium">
              {formatCurrency(dieselRate)}/L
            </div>
          </div>
          <Input label={tr('paidAmount')} type="number" step="0.01" value={form.paid_amount} onChange={(v) => setForm({ ...form, paid_amount: v })} />
        </div>

        {/* Auto-calc summary */}
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-slate-500">{tr('calculationSummary')}</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">GST applied during invoice generation</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <div><p className="text-xs text-slate-500">Amount (excl GST)</p><p className="font-semibold text-slate-800">{formatCurrency(totals.amountWithoutGst)}</p></div>
            <div><p className="text-xs text-slate-500">{tr('grossCompanyIncome')}</p><p className="font-semibold text-slate-800">{formatCurrency(totals.grossCompanyIncome)}</p></div>
            <div><p className="text-xs text-slate-500">{tr('dieselAmount')}</p><p className="font-semibold text-amber-700">−{formatCurrency(totals.dieselAmount)}</p></div>
            <div><p className="text-xs text-slate-500">{tr('advance')}</p><p className={`font-semibold ${advanceExceedsIncome ? 'text-rose-600' : 'text-amber-700'}`}>−{formatCurrency(advanceAmount)}</p></div>
            <div><p className="text-xs text-slate-500">{tr('netCompanyIncome')}</p><p className="font-bold text-sky-700">{formatCurrency(totals.netCompanyIncome)}</p></div>
          </div>
          {advanceExceedsIncome && (
            <p className="mt-2 text-xs font-medium text-rose-600">⚠ {tr('advanceExceedsIncome')}</p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{tr('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? tr('saving') : tr('save')}</Button>
        </div>
      </Modal>
    </div>
  );
}

// ===== MAR Bills =====
function MarBills() {
  const { tr, profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [bills, setBills] = useState<MarBill[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [companyBills, setCompanyBills] = useState<CompanyBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MarBill | null>(null);
  const [linkedBill, setLinkedBill] = useState<CompanyBill | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (bills.length > 0 && bills.every((b) => selected.has(b.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(bills.map((b) => b.id)));
    }
  };

  const [form, setForm] = useState({
    trip_date: todayISO(),
    vehicle_id: '',
    vehicle_number: '',
    driver_id: '',
    driver_name: '',
    company_bill_id: '',
    driver_wage: '',
    diesel_litres: '',
    toll_gates: '',
    driver_waiting: '',
    other_charges: '',
    maintenance: '',
  });

  const load = useCallback(async () => {
    if (!profile) return;
    const [billsRes, vehRes, drvRes, cbRes] = await Promise.all([
      supabase.from('mar_bills').select('*').order('trip_date', { ascending: false }),
      supabase.from('vehicles').select('*').order('vehicle_number'),
      supabase.from('drivers').select('*').eq('is_active', true).order('name'),
      supabase.from('company_bills').select('*').order('trip_date', { ascending: false }),
    ]);
    setBills((billsRes.data || []) as MarBill[]);
    setVehicles((vehRes.data || []) as Vehicle[]);
    setDrivers((drvRes.data || []) as Driver[]);
    setCompanyBills((cbRes.data || []) as CompanyBill[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const getDailyEmi = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    return v ? calcDailyEmi(v.monthly_emi) : 0;
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ trip_date: todayISO(), vehicle_id: '', vehicle_number: '', driver_id: '', driver_name: '', company_bill_id: '', driver_wage: '', diesel_litres: '', toll_gates: '', driver_waiting: '', other_charges: '', maintenance: '' });
    setLinkedBill(null);
    setModalOpen(true);
  };

  const openEdit = (b: MarBill) => {
    setEditing(b);
    const matchDriver = drivers.find((d) => d.name === b.driver_name);
    setForm({
      trip_date: b.trip_date,
      vehicle_id: b.vehicle_id || '',
      vehicle_number: b.vehicle_number,
      driver_id: matchDriver?.id || '',
      driver_name: b.driver_name,
      company_bill_id: b.company_bill_id || '',
      driver_wage: String(b.driver_wage),
      diesel_litres: String(b.diesel_litres),
      toll_gates: String(b.toll_gates),
      driver_waiting: String(b.driver_waiting),
      other_charges: String(b.other_charges),
      maintenance: String(b.maintenance),
    });
    const linked = companyBills.find((cb) => cb.id === b.company_bill_id) || null;
    setLinkedBill(linked);
    setModalOpen(true);
  };

  const onVehicleChange = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    const driver = drivers.find((d) => d.id === v?.driver_id);
    setForm((f) => ({
      ...f,
      vehicle_id: id,
      vehicle_number: v?.vehicle_number || '',
      driver_id: driver?.id || f.driver_id,
      driver_name: driver?.name || f.driver_name,
    }));
  };

  const onDriverChange = (id: string) => {
    const d = drivers.find((x) => x.id === id);
    setForm((f) => ({ ...f, driver_id: id, driver_name: d?.name || '' }));
  };

  const onCompanyBillChange = (billId: string) => {
    const cb = companyBills.find((b) => b.id === billId) || null;
    setLinkedBill(cb);
    if (cb) {
      const matchDriver = drivers.find((d) => d.name === cb.driver_name);
      const matchedVehicle = vehicles.find((v) => v.vehicle_number === cb.vehicle_number);
      setForm((f) => ({
        ...f,
        company_bill_id: billId,
        trip_date: cb.trip_date,
        vehicle_id: matchedVehicle?.id || f.vehicle_id,
        vehicle_number: cb.vehicle_number,
        driver_id: matchDriver?.id || f.driver_id,
        driver_name: cb.driver_name,
        diesel_litres: String(cb.diesel),
      }));
    } else {
      setForm((f) => ({ ...f, company_bill_id: '' }));
    }
  };

  const dieselRate = linkedBill?.diesel_rate || 0;
  const dieselLitres = parseFloat(form.diesel_litres) || 0;
  const dieselCost = dieselLitres * dieselRate;
  const netCompanyIncome = linkedBill?.net_company_income || 0;
  const dailyEmi = getDailyEmi(form.vehicle_id);

  // Company Bills not yet linked to any MAR Bill (excluding the one currently being edited)
  const linkedBillIds = new Set(bills.map((b) => b.company_bill_id).filter(Boolean) as string[]);
  if (editing?.company_bill_id) linkedBillIds.delete(editing.company_bill_id);
  const availableCompanyBills = companyBills.filter((cb) => !linkedBillIds.has(cb.id));

  const t = calcMarBillTotals(
    netCompanyIncome,
    parseFloat(form.driver_wage) || 0,
    dieselCost,
    parseFloat(form.toll_gates) || 0,
    parseFloat(form.driver_waiting) || 0,
    parseFloat(form.other_charges) || 0,
    parseFloat(form.maintenance) || 0,
    dailyEmi
  );

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        trip_date: form.trip_date,
        vehicle_id: form.vehicle_id || null,
        vehicle_number: form.vehicle_number,
        driver_name: form.driver_name,
        company_bill_id: form.company_bill_id || null,
        driver_wage: parseFloat(form.driver_wage) || 0,
        diesel_litres: dieselLitres,
        diesel_cost: dieselCost,
        diesel_rate: dieselRate,
        net_company_income: netCompanyIncome,
        toll_gates: parseFloat(form.toll_gates) || 0,
        driver_waiting: parseFloat(form.driver_waiting) || 0,
        other_charges: parseFloat(form.other_charges) || 0,
        maintenance: parseFloat(form.maintenance) || 0,
        daily_emi: dailyEmi,
        total_expense: t.totalExpense,
        trip_income: netCompanyIncome,
        trip_profit: t.tripProfit,
      };
      let writeError;
      if (editing) {
        ({ error: writeError } = await supabase.from('mar_bills').update(payload).eq('id', editing.id));
      } else {
        ({ error: writeError } = await supabase.from('mar_bills').insert(payload));
      }
      if (writeError) {
        showError('Could not save bill. Please try again.');
        return;
      }
      showSuccess(editing ? 'Bill updated' : 'Bill added');
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr('confirmDelete'))) return;
    const { error } = await supabase.from('mar_bills').delete().eq('id', id);
    if (error) {
      showError('Could not delete bill. Please try again.');
      return;
    }
    showSuccess('Bill deleted');
    load();
  };

  const handleExport = () => {
    exportToCSV('mar_bills', [
      'S.No.', tr('tripDate'), tr('vehicleNumber'), tr('driverName'),
      tr('netCompanyIncome'), tr('dieselLitres'), tr('dieselRate'), tr('dieselCost'),
      tr('driverWage'), tr('tollGates'), tr('driverWaiting'), tr('otherCharges'),
      tr('maintenanceCost'), tr('dailyEmi'), tr('totalExpense'), tr('tripProfit'),
    ], bills.map((b, idx) => {
      return [
        idx + 1, formatDate(b.trip_date), b.vehicle_number, b.driver_name,
        b.net_company_income, b.diesel_litres, b.diesel_rate, b.diesel_cost,
        b.driver_wage, b.toll_gates, b.driver_waiting, b.other_charges,
        b.maintenance, b.daily_emi, b.total_expense, b.trip_profit,
      ];
    }));
  };

  const hasSelection = selected.size > 0;
  const kpiSource = hasSelection ? bills.filter((b) => selected.has(b.id)) : bills;
  const totalProfit = kpiSource.reduce((s, b) => s + b.trip_profit, 0);
  const totalIncome = kpiSource.reduce((s, b) => s + b.net_company_income, 0);
  const totalExpenseSum = kpiSource.reduce((s, b) => s + b.total_expense, 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          {hasSelection && (
            <p className="text-xs font-medium text-sky-600">
              Showing totals for {selected.size} selected {selected.size === 1 ? 'row' : 'rows'}
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label={tr('netCompanyIncome')} value={formatCurrency(totalIncome)} icon={<Truck className="h-5 w-5" />} color="emerald" />
            <KpiCard label={tr('totalExpense')} value={formatCurrency(totalExpenseSum)} icon={<Truck className="h-5 w-5" />} color="rose" />
            <KpiCard label={tr('tripProfit')} value={formatCurrency(totalProfit)} icon={<Truck className="h-5 w-5" />} color={totalProfit >= 0 ? 'sky' : 'rose'} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4" />{tr('exportExcel')}</Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4" />{tr('addBill')}</Button>
        </div>
      </div>

      {bills.length === 0 ? (
        <EmptyState icon={<Truck className="h-12 w-12" />} title={tr('noData')} action={<Button onClick={openAdd}><Plus className="h-4 w-4" />{tr('addBill')}</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="sticky-header overflow-auto" style={{ maxHeight: 'calc(100vh - 19rem)' }}>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={bills.length > 0 && bills.every((b) => selected.has(b.id))}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                  </th>
                  <th className="px-3 py-3 font-bold text-slate-700">{tr('tripDate')}</th>
                  <th className="px-3 py-3 text-center font-bold text-slate-700">S.No.</th>
                  <th className="px-3 py-3 font-bold text-slate-700">{tr('vehicleNumber')}</th>
                  <th className="px-3 py-3 font-bold text-slate-700">{tr('driverName')}</th>
                  <th className="px-3 py-3 text-right font-bold text-slate-700">{tr('netCompanyIncome')}</th>
                  <th className="px-3 py-3 text-right font-bold text-slate-700">{tr('totalExpense')}</th>
                  <th className="px-3 py-3 text-right font-bold text-slate-700">{tr('tripProfit')}</th>
                  <th className="px-3 py-3 text-right font-bold text-slate-700">{tr('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  return bills.map((b, idx) => {
                  const isSelected = selected.has(b.id);
                  return (
                  <tr key={b.id} className={`${isSelected ? 'bg-sky-50/60' : ''} hover:bg-slate-50/50`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(b.id)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">{formatDate(b.trip_date)}</td>
                    <td className="px-3 py-3 text-center text-sm font-medium text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{b.vehicle_number}</td>
                    <td className="px-3 py-3 text-slate-600">{b.driver_name}</td>
                    <td className="px-3 py-3 text-right text-emerald-600 font-semibold">{formatCurrency(b.net_company_income)}</td>
                    <td className="px-3 py-3 text-right text-rose-600">{formatCurrency(b.total_expense)}</td>
                    <td className={`px-3 py-3 text-right font-bold ${b.trip_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(b.trip_profit)}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(b)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(b.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                  );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? tr('editBill') : tr('addBill')} size="xl">
        <div className="mb-4">
          {availableCompanyBills.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">
              {tr('noUnlinkedCompanyBills')}
            </div>
          ) : (
            <Select
              label={tr('linkCompanyBill')}
              value={form.company_bill_id}
              onChange={onCompanyBillChange}
              options={availableCompanyBills.map((cb) => ({ value: cb.id, label: `${formatDate(cb.trip_date)} • ${cb.vehicle_number} • ${cb.driver_name} • ${cb.tons}T` }))}
              placeholder={tr('selectCompanyBill')}
            />
          )}
        </div>

        {linkedBill && (
          <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase text-sky-600">{tr('companyBillReference')}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div><p className="text-xs text-slate-500">{tr('vehicleNumber')}</p><p className="font-medium text-slate-800">{linkedBill.vehicle_number}</p></div>
              <div><p className="text-xs text-slate-500">{tr('tripDate')}</p><p className="font-medium text-slate-800">{formatDate(linkedBill.trip_date)}</p></div>
              <div><p className="text-xs text-slate-500">{tr('driverName')}</p><p className="font-medium text-slate-800">{linkedBill.driver_name}</p></div>
              <div><p className="text-xs text-slate-500">{tr('tons')}</p><p className="font-medium text-slate-800">{linkedBill.tons} T</p></div>
              <div><p className="text-xs text-slate-500">{tr('dieselLitres')}</p><p className="font-medium text-slate-800">{linkedBill.diesel} L</p></div>
              <div><p className="text-xs text-slate-500">{tr('dieselRate')}</p><p className="font-medium text-slate-800">{formatCurrency(linkedBill.diesel_rate)}/L</p></div>
              <div><p className="text-xs text-slate-500">{tr('dieselAmount')}</p><p className="font-medium text-amber-700">{formatCurrency(linkedBill.diesel_amount)}</p></div>
              <div><p className="text-xs text-slate-500">{tr('companyIncome')}</p><p className="font-medium text-slate-800">{formatCurrency(linkedBill.company_income)}</p></div>
              <div><p className="text-xs text-slate-500">{tr('netCompanyIncome')}</p><p className="font-bold text-sky-700">{formatCurrency(linkedBill.net_company_income)}</p></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label={tr('tripDate')} type="date" value={form.trip_date} onChange={(v) => setForm({ ...form, trip_date: v })} required />
          <Select label={tr('vehicleNumber')} value={form.vehicle_id} onChange={onVehicleChange} options={vehicles.map((v) => ({ value: v.id, label: v.vehicle_number }))} placeholder={tr('vehicleNumber')} required />
          <Select label={tr('driverName')} value={form.driver_id} onChange={onDriverChange} options={drivers.map((d) => ({ value: d.id, label: d.name }))} placeholder={tr('driverName')} required />
          <Input label={tr('driverWage')} type="number" step="0.01" value={form.driver_wage} onChange={(v) => setForm({ ...form, driver_wage: v })} />
          <Input label={tr('dieselLitres')} type="number" step="0.01" value={form.diesel_litres} onChange={(v) => setForm({ ...form, diesel_litres: v })} />
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">{tr('dieselRate')}</p>
            <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-500">
              {linkedBill ? `${formatCurrency(dieselRate)}/L (auto)` : tr('selectCompanyBill')}
            </div>
          </div>
          <Input label={tr('tollGates')} type="number" step="0.01" value={form.toll_gates} onChange={(v) => setForm({ ...form, toll_gates: v })} />
          <Input label={tr('driverWaiting')} type="number" step="0.01" value={form.driver_waiting} onChange={(v) => setForm({ ...form, driver_waiting: v })} />
          <Input label={tr('otherCharges')} type="number" step="0.01" value={form.other_charges} onChange={(v) => setForm({ ...form, other_charges: v })} />
          <Input label={tr('maintenanceCost')} type="number" step="0.01" value={form.maintenance} onChange={(v) => setForm({ ...form, maintenance: v })} />
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><p className="text-xs text-slate-500">{tr('dieselCost')} (auto)</p><p className="font-semibold text-amber-700">{formatCurrency(dieselCost)}</p><p className="text-xs text-slate-400">{dieselLitres}L × {formatCurrency(dieselRate)}/L</p></div>
            <div><p className="text-xs text-slate-500">{tr('dailyEmi')} (auto)</p><p className="font-semibold text-amber-700">{formatCurrency(dailyEmi)}</p></div>
            <div><p className="text-xs text-slate-500">{tr('totalExpense')}</p><p className="font-semibold text-rose-600">{formatCurrency(t.totalExpense)}</p></div>
            <div><p className="text-xs text-slate-500">{tr('tripProfit')}</p><p className={`font-bold ${t.tripProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(t.tripProfit)}</p></div>
          </div>
          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">{tr('profitBreakdown')}</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">{tr('netCompanyIncome')}</span><span className="font-medium text-emerald-600">+{formatCurrency(netCompanyIncome)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">{tr('driverWage')}</span><span className="text-rose-600">−{formatCurrency(parseFloat(form.driver_wage) || 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">{tr('dieselCost')}</span><span className="text-rose-600">−{formatCurrency(dieselCost)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">{tr('tollGates')}</span><span className="text-rose-600">−{formatCurrency(parseFloat(form.toll_gates) || 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">{tr('driverWaiting')}</span><span className="text-rose-600">−{formatCurrency(parseFloat(form.driver_waiting) || 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">{tr('otherCharges')}</span><span className="text-rose-600">−{formatCurrency(parseFloat(form.other_charges) || 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">{tr('maintenanceCost')}</span><span className="text-rose-600">−{formatCurrency(parseFloat(form.maintenance) || 0)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-1"><span className="font-semibold text-slate-700">{tr('tripProfit')}</span><span className={`font-bold ${t.tripProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(t.tripProfit)}</span></div>
            </div>
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

// ===== Maintenance =====
function MaintenanceTab() {
  const { tr, profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState<Maintenance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);

  const [form, setForm] = useState({
    vehicle_id: '',
    vehicle_number: '',
    type: 'tyre' as 'tyre' | 'repair' | 'service' | 'other',
    date: todayISO(),
    amount: '',
    description: '',
  });

  const load = useCallback(async () => {
    if (!profile) return;
    const [maintRes, vehRes] = await Promise.all([
      supabase.from('maintenance').select('*').order('date', { ascending: false }),
      supabase.from('vehicles').select('*').order('vehicle_number'),
    ]);
    setItems((maintRes.data || []) as Maintenance[]);
    setVehicles((vehRes.data || []) as Vehicle[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ vehicle_id: '', vehicle_number: '', type: 'tyre', date: todayISO(), amount: '', description: '' });
    setModalOpen(true);
  };

  const openEdit = (m: Maintenance) => {
    setEditing(m);
    setForm({ vehicle_id: m.vehicle_id || '', vehicle_number: m.vehicle_number, type: m.type, date: m.date, amount: String(m.amount), description: m.description });
    setModalOpen(true);
  };

  const onVehicleChange = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    setForm((f) => ({ ...f, vehicle_id: id, vehicle_number: v?.vehicle_number || '' }));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const amount = parseFloat(form.amount) || 0;
      const payload = { vehicle_id: form.vehicle_id || null, vehicle_number: form.vehicle_number, type: form.type, date: form.date, amount, description: form.description };
      let writeError;
      if (editing) {
        ({ error: writeError } = await supabase.from('maintenance').update(payload).eq('id', editing.id));
      } else {
        ({ error: writeError } = await supabase.from('maintenance').insert(payload));
      }
      if (writeError) {
        showError('Could not save maintenance record. Please try again.');
        return;
      }
      showSuccess(editing ? 'Record updated' : 'Record added');
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr('confirmDelete'))) return;
    const { error } = await supabase.from('maintenance').delete().eq('id', id);
    if (error) {
      showError('Could not delete record. Please try again.');
      return;
    }
    showSuccess('Record deleted');
    load();
  };

  const handleExport = () => {
    exportToCSV('maintenance', [
      tr('date'), tr('vehicleNumber'), tr('maintenanceType'), tr('amount'), tr('description'),
    ], items.map((m) => [formatDate(m.date), m.vehicle_number, tr(m.type), m.amount, m.description]));
  };

  const totalCost = items.reduce((s, m) => s + m.amount, 0);
  const typeColors: Record<string, 'amber' | 'sky' | 'emerald' | 'slate'> = { tyre: 'amber', repair: 'sky', service: 'emerald', other: 'slate' };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <KpiCard label={tr('maintenance')} value={formatCurrency(totalCost)} icon={<Wrench className="h-5 w-5" />} color="amber" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4" />{tr('exportExcel')}</Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4" />{tr('addMaintenance')}</Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Wrench className="h-12 w-12" />} title={tr('noData')} action={<Button onClick={openAdd}><Plus className="h-4 w-4" />{tr('addMaintenance')}</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="sticky-header overflow-auto" style={{ maxHeight: 'calc(100vh - 19rem)' }}>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">{tr('date')}</th>
                  <th className="px-4 py-3">{tr('vehicleNumber')}</th>
                  <th className="px-4 py-3">{tr('maintenanceType')}</th>
                  <th className="px-4 py-3 text-right">{tr('amount')}</th>
                  <th className="px-4 py-3">{tr('description')}</th>
                  <th className="px-4 py-3 text-right">{tr('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(m.date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{m.vehicle_number}</td>
                    <td className="px-4 py-3"><Badge color={typeColors[m.type]}>{tr(m.type)}</Badge></td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(m.amount)}</td>
                    <td className="px-4 py-3 text-slate-600">{m.description}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(m)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(m.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? tr('editMaintenance') : tr('addMaintenance')}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label={tr('vehicleNumber')} value={form.vehicle_id} onChange={onVehicleChange} options={vehicles.map((v) => ({ value: v.id, label: v.vehicle_number }))} placeholder={tr('vehicleNumber')} required />
            <Select
              label={tr('maintenanceType')}
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v as typeof form.type })}
              options={[
                { value: 'tyre', label: tr('tyre') },
                { value: 'repair', label: tr('repair') },
                { value: 'service', label: tr('service') },
                { value: 'other', label: tr('other') },
              ]}
              required
            />
            <Input label={tr('date')} type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
            <Input label={tr('amount')} type="number" step="0.01" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
          </div>
          <TextArea label={tr('description')} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{tr('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? tr('saving') : tr('save')}</Button>
        </div>
      </Modal>
    </div>
  );
}
