import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, Truck, Milk, Car, Package,
  Users, Activity, DollarSign, Clock, CheckCircle, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Fuel,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, LoadingSpinner, Badge } from '@/components/ui';
import { BarChart, DonutChart, LineChart } from '@/components/Charts';
import { formatCurrency, formatDate, firstOfMonthISO, todayISO } from '@/lib/calc';
import { MilkEntry, CompanyBill, MarBill, Vehicle, Driver, Product } from '@/types/database';

export function DashboardModule() {
  const { tr, profile } = useAuth();
  const [loading, setLoading] = useState(true);

  // Raw data
  const [milkEntries, setMilkEntries] = useState<MilkEntry[]>([]);
  const [companyBills, setCompanyBills] = useState<CompanyBill[]>([]);
  const [marBills, setMarBills] = useState<MarBill[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const start = firstOfMonthISO();
    const end = todayISO();
    const [milkRes, cbRes, marRes, vehRes, drvRes, prodRes] = await Promise.all([
      supabase.from('milk_entries').select('*').gte('entry_date', start).lte('entry_date', end),
      supabase.from('company_bills').select('*').gte('trip_date', start).lte('trip_date', end),
      supabase.from('mar_bills').select('*').gte('trip_date', start).lte('trip_date', end),
      supabase.from('vehicles').select('*'),
      supabase.from('drivers').select('*'),
      supabase.from('products').select('*').order('sort_order', { ascending: true }),
    ]);
    setMilkEntries((milkRes.data || []) as MilkEntry[]);
    setCompanyBills((cbRes.data || []) as CompanyBill[]);
    setMarBills((marRes.data || []) as MarBill[]);
    setVehicles((vehRes.data || []) as Vehicle[]);
    setDrivers((drvRes.data || []) as Driver[]);
    setProducts((prodRes.data || []) as Product[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  // Metrics
  const milkSales = milkEntries.reduce((s, e) => s + (e.selling_amount || e.selling_rate * e.quantity), 0);
  const milkPurchase = milkEntries.reduce((s, e) => s + (e.purchase_amount || e.purchase_rate * e.quantity), 0);
  const milkMargin = milkEntries.reduce((s, e) => s + e.margin, 0);
  const milkPaid = milkEntries.reduce((s, e) => s + e.company_paid, 0);
  const milkPending = milkSales - milkPaid;

  const transportIncome = companyBills.reduce((s, b) => s + b.net_company_income, 0);
  const transportExpense = marBills.reduce((s, b) => s + b.total_expense, 0);
  const transportProfit = marBills.reduce((s, b) => s + b.trip_profit, 0);
  const transportReceivable = companyBills.reduce((s, b) => s + b.net_receivable, 0);
  const transportReceived = companyBills.reduce((s, b) => s + b.paid_amount, 0);
  const transportPending = transportReceivable - transportReceived;

  const totalIncome = milkSales + transportIncome;
  const totalExpense = milkPurchase + transportExpense;
  const netProfit = milkMargin + transportProfit;

  const activeVehicles = vehicles.filter((v) => v.status === 'active').length;
  const activeDrivers = drivers.filter((d) => d.is_active).length;
  const totalTrips = marBills.length;

  // Bill paid stats
  const totalBills = companyBills.length + milkEntries.length;
  const paidBills = companyBills.filter((b) => b.bill_paid).length + milkEntries.filter((e) => e.bill_paid).length;
  const pendingBills = totalBills - paidBills;
  const totalPaidAmount = transportReceived + milkPaid;
  const totalOutstanding = transportPending + milkPending;

  // Chart: last 14 days trend
  const trendData = (() => {
    const days = 14;
    const today = new Date();
    const result: { label: string; income: number; expense: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      const dayMilk = milkEntries.filter((e) => e.entry_date === iso).reduce((s, e) => s + e.margin, 0);
      const dayTransport = marBills.filter((b) => b.trip_date === iso).reduce((s, b) => s + b.trip_profit, 0);
      result.push({ label, income: dayMilk + dayTransport, expense: 0 });
    }
    return result;
  })();

  // Vehicle profit chart
  const vehicleProfitData = (() => {
    const map = new Map<string, number>();
    marBills.forEach((b) => map.set(b.vehicle_number, (map.get(b.vehicle_number) || 0) + b.trip_profit));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));
  })();

  // Donut: income split
  const incomeDonut = [
    { label: tr('milkIncome'), value: milkSales, color: '#0ea5e9' },
    { label: tr('transportIncome'), value: transportIncome, color: '#f59e0b' },
  ];

  // District chart
  const districtData = (() => {
    const map = new Map<string, number>();
    milkEntries.forEach((e) => map.set(e.district_name, (map.get(e.district_name) || 0) + e.margin));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));
  })();

  // Pending vs Paid donut
  const pendingPaid = [
    { label: tr('amountReceived'), value: milkPaid + transportReceived, color: '#10b981' },
    { label: tr('pendingAmount'), value: milkPending + transportPending, color: '#f59e0b' },
  ];

  // Product-wise milk summary (quantities kept per-unit, finances combined)
  const productSummary = (() => {
    const map = new Map<string, { name: string; unit: string; unit_display: string; qty: number; purchase: number; sales: number; margin: number; entries: number }>();
    milkEntries.forEach((e) => {
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
    const rows = Array.from(map.values());
    // include active products with zero entries so admins see all products
    products.filter((p) => p.is_active).forEach((p) => {
      if (!rows.some((r) => r.name === p.name)) {
        rows.push({ name: p.name, unit: p.unit, unit_display: p.unit_display, qty: 0, purchase: 0, sales: 0, margin: 0, entries: 0 });
      }
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Recent activities
  const recentActivity = [
    ...companyBills.map((b) => ({
      type: 'company' as const,
      date: b.trip_date,
      label: `${b.vehicle_number} — ${b.driver_name}`,
      amount: b.net_company_income,
      positive: true,
    })),
    ...milkEntries.map((e) => ({
      type: 'milk' as const,
      date: e.entry_date,
      label: `${e.district_name}`,
      amount: e.margin,
      positive: e.margin >= 0,
    })),
  ]
    .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
    .slice(0, 6);

  // Upcoming EMIs
  const upcomingEmis = vehicles
    .filter((v) => v.status === 'active' && v.emi_date)
    .sort((a, b) => (a.emi_date > b.emi_date ? 1 : a.emi_date < b.emi_date ? -1 : 0))
    .slice(0, 4);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white">
        <p className="text-sm font-medium text-slate-300">{tr('currentMonth')}</p>
        <h1 className="mt-1 text-3xl font-bold">{tr('dashboard')}</h1>
        <p className="mt-1 text-slate-400 text-sm">{formatDate(firstOfMonthISO())} — {formatDate(todayISO())}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">{tr('totalIncome')}</p>
            <p className="mt-1 text-2xl font-bold text-emerald-400">{formatCurrency(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">{tr('totalExpense')}</p>
            <p className="mt-1 text-2xl font-bold text-rose-400">{formatCurrency(totalExpense)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">{tr('netProfit')}</p>
            <p className={`mt-1 text-2xl font-bold ${netProfit >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>{formatCurrency(netProfit)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">{tr('pendingAmount')}</p>
            <p className="mt-1 text-2xl font-bold text-amber-400">{formatCurrency(milkPending + transportPending)}</p>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile label={tr('milkSales')} value={formatCurrency(milkSales)} sub={`${tr('purchase')}: ${formatCurrency(milkPurchase)}`} icon={<Milk className="h-5 w-5" />} color="sky" trend={milkMargin} />
        <KpiTile label={tr('milkMargin')} value={formatCurrency(milkMargin)} sub={`${milkEntries.length} ${tr('entries')}`} icon={<TrendingUp className="h-5 w-5" />} color="emerald" trend={milkMargin} />
        <KpiTile label={tr('transportIncome')} value={formatCurrency(transportIncome)} sub={`${totalTrips} ${tr('totalTrips')}`} icon={<Truck className="h-5 w-5" />} color="amber" trend={transportProfit} />
        <KpiTile label={tr('tripProfit')} value={formatCurrency(transportProfit)} sub={`${tr('expense')}: ${formatCurrency(transportExpense)}`} icon={<DollarSign className="h-5 w-5" />} color={transportProfit >= 0 ? 'emerald' : 'rose'} trend={transportProfit} />
        <KpiTile label={tr('pendingAmount')} value={formatCurrency(milkPending + transportPending)} sub={tr('outstanding')} icon={<Clock className="h-5 w-5" />} color="rose" trend={-1} />
        <KpiTile label={tr('amountReceived')} value={formatCurrency(milkPaid + transportReceived)} sub={tr('totalPaid')} icon={<CheckCircle className="h-5 w-5" />} color="emerald" trend={1} />
      </div>

      {/* Fleet Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-sky-100 p-3"><Car className="h-6 w-6 text-sky-700" /></div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{activeVehicles}<span className="text-base text-slate-400">/{vehicles.length}</span></p>
            <p className="text-sm text-slate-500">{tr('activeVehicles')}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-emerald-100 p-3"><Users className="h-6 w-6 text-emerald-700" /></div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{activeDrivers}<span className="text-base text-slate-400">/{drivers.length}</span></p>
            <p className="text-sm text-slate-500">{tr('activeDrivers')}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-amber-100 p-3"><Activity className="h-6 w-6 text-amber-700" /></div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalTrips}</p>
            <p className="text-sm text-slate-500">{tr('totalTrips')}</p>
          </div>
        </Card>
      </div>

      {/* Bill Payment Status */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold text-slate-800">{tr('billPaid')} — {tr('paymentStatus')}</p>
          <Badge color={pendingBills > 0 ? 'amber' : 'green'}>{pendingBills === 0 ? 'All Paid' : `${pendingBills} Pending`}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">{tr('totalBills')}</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{totalBills}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-xs text-slate-500">{tr('paidBills')}</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">{paidBills}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-xs text-slate-500">{tr('pendingBills')}</p>
            <p className="mt-1 text-xl font-bold text-amber-700">{pendingBills}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-xs text-slate-500">Total Paid</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">{formatCurrency(totalPaidAmount)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-xs text-slate-500">Total Outstanding</p>
            <p className="mt-1 text-xl font-bold text-amber-700">{formatCurrency(totalOutstanding)}</p>
          </div>
        </div>
      </Card>

      {/* Product-wise Milk Summary */}
      {milkEntries.length > 0 && (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-sky-500" />
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

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <p className="mb-4 font-semibold text-slate-800">{tr('profitTrend')} (14 {tr('days')})</p>
          {trendData.some((d) => d.income > 0) ? (
            <LineChart
              data={trendData.map((d) => ({ label: d.label, value: d.income }))}
              height={200}
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">{tr('noData')}</p>
          )}
        </Card>
        <Card className="p-5">
          <p className="mb-4 font-semibold text-slate-800">{tr('incomeBreakdown')}</p>
          {incomeDonut.some((s) => s.value > 0) ? (
            <DonutChart segments={incomeDonut} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">{tr('noData')}</p>
          )}
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-4 font-semibold text-slate-800">{tr('vehicleProfit')}</p>
          {vehicleProfitData.length > 0 ? (
            <BarChart data={vehicleProfitData} height={180} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">{tr('noData')}</p>
          )}
        </Card>
        <Card className="p-5">
          <p className="mb-4 font-semibold text-slate-800">{tr('milkByDistrict')}</p>
          {districtData.length > 0 ? (
            <BarChart data={districtData} height={180} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">{tr('noData')}</p>
          )}
        </Card>
      </div>

      {/* Pending vs Paid + Recent Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="mb-4 font-semibold text-slate-800">{tr('pendingVsPaid')}</p>
          {pendingPaid.some((s) => s.value > 0) ? (
            <DonutChart segments={pendingPaid} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">{tr('noData')}</p>
          )}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{tr('milkPending')}</span>
              <span className="font-medium text-amber-600">{formatCurrency(milkPending)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{tr('transportPending')}</span>
              <span className="font-medium text-amber-600">{formatCurrency(transportPending)}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <p className="mb-4 font-semibold text-slate-800">{tr('recentActivity')}</p>
          {recentActivity.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">{tr('noData')}</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${a.type === 'milk' ? 'bg-sky-100' : 'bg-amber-100'}`}>
                      {a.type === 'milk' ? <Milk className="h-4 w-4 text-sky-600" /> : <Truck className="h-4 w-4 text-amber-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.label}</p>
                      <p className="text-xs text-slate-500">{formatDate(a.date)}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 font-semibold text-sm ${a.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {a.positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {formatCurrency(a.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Upcoming EMIs */}
      {upcomingEmis.length > 0 && (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <p className="font-semibold text-slate-800">{tr('upcomingEmi')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {upcomingEmis.map((v) => (
              <div key={v.id} className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Fuel className="h-4 w-4 text-amber-600" />
                  <p className="font-semibold text-slate-800 text-sm">{v.vehicle_number}</p>
                </div>
                <p className="text-sm font-bold text-amber-700">{formatCurrency(v.monthly_emi)}</p>
                <p className="text-xs text-slate-500 mt-1">{tr('emiDate')}: {v.emi_date}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// Small KPI tile with trend arrow
function KpiTile({ label, value, sub, icon, color, trend }: {
  label: string; value: string; sub: string; icon: React.ReactNode;
  color: 'sky' | 'emerald' | 'amber' | 'rose'; trend: number;
}) {
  const colorMap = {
    sky: { bg: 'bg-sky-50', icon: 'bg-sky-100 text-sky-700', value: 'text-slate-900' },
    emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-700', value: 'text-slate-900' },
    amber: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-700', value: 'text-slate-900' },
    rose: { bg: 'bg-rose-50', icon: 'bg-rose-100 text-rose-700', value: 'text-slate-900' },
  };
  const c = colorMap[color];
  return (
    <Card className={`p-4 ${c.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`rounded-lg p-2 ${c.icon}`}>{icon}</div>
        <span className={trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-rose-500' : 'text-slate-300'}>
          {trend > 0 ? <ArrowUpRight className="h-4 w-4" /> : trend < 0 ? <ArrowDownRight className="h-4 w-4" /> : null}
        </span>
      </div>
      <p className={`text-lg font-bold ${c.value}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </Card>
  );
}
