import { useState, useMemo, type ReactNode } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { Card, Input, Select } from '@/components/ui';

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'currentFY'
  | 'custom';

export interface FilterConfig {
  showCustomer?: boolean;
  showVehicle?: boolean;
  showDriver?: boolean;
  showRoute?: boolean;
  showMaterial?: boolean;
  showLrNumber?: boolean;
  showProduct?: boolean;
  showBillStatus?: boolean;
  showPaymentStatus?: boolean;
}

export interface FilterValues {
  from: string;
  to: string;
  preset: DatePreset;
  customer: string;
  vehicle: string;
  driver: string;
  route: string;
  material: string;
  lrNumber: string;
  product: string;
  billStatus: string;
  paymentStatus: string;
}

interface ReportFiltersProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  config: FilterConfig;
  customers?: string[];
  vehicles?: string[];
  drivers?: string[];
  routes?: string[];
  materials?: string[];
  lrNumbers?: string[];
  products?: string[];
  tr: (key: string) => string;
  children?: ReactNode;
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return localDateStr(d);
}

function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function lastMonthRange(): { from: string; to: string } {
  const d = new Date();
  const lastMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const lastMonthEnd = new Date(d.getFullYear(), d.getMonth(), 0);
  return {
    from: localDateStr(lastMonth),
    to: localDateStr(lastMonthEnd),
  };
}

function currentFYRange(): { from: string; to: string } {
  const d = new Date();
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return {
    from: `${year}-04-01`,
    to: `${year + 1}-03-31`,
  };
}

export function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const today = localDateStr(new Date());
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const y = localDateStr(d);
      return { from: y, to: y };
    }
    case 'thisWeek':
      return { from: startOfWeek(), to: today };
    case 'thisMonth':
      return { from: startOfMonth(), to: today };
    case 'lastMonth': {
      const r = lastMonthRange();
      return r;
    }
    case 'currentFY':
      return currentFYRange();
    case 'custom':
    default:
      return { from: startOfMonth(), to: today };
  }
}

export function ReportFilters({
  values,
  onChange,
  config,
  customers = [],
  vehicles = [],
  drivers = [],
  routes = [],
  materials = [],
  lrNumbers = [],
  products = [],
  tr,
  children,
}: ReportFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const presetOptions: { value: DatePreset; label: string }[] = [
    { value: 'today', label: tr('today') },
    { value: 'yesterday', label: tr('yesterday') },
    { value: 'thisWeek', label: tr('thisWeek') },
    { value: 'thisMonth', label: tr('thisMonth') },
    { value: 'lastMonth', label: tr('lastMonth') },
    { value: 'currentFY', label: tr('currentFY') },
    { value: 'custom', label: tr('customRange') },
  ];

  const hasAdvancedFilters = useMemo(() => {
    return !!(
      config.showCustomer ||
      config.showVehicle ||
      config.showDriver ||
      config.showRoute ||
      config.showMaterial ||
      config.showLrNumber ||
      config.showProduct ||
      config.showBillStatus ||
      config.showPaymentStatus
    );
  }, [config]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (values.customer) count++;
    if (values.vehicle) count++;
    if (values.driver) count++;
    if (values.route) count++;
    if (values.material) count++;
    if (values.lrNumber) count++;
    if (values.product) count++;
    if (values.billStatus && values.billStatus !== 'all') count++;
    if (values.paymentStatus && values.paymentStatus !== 'all') count++;
    return count;
  }, [values]);

  const update = (patch: Partial<FilterValues>) => onChange({ ...values, ...patch });

  const handlePresetChange = (preset: DatePreset) => {
    if (preset === 'custom') {
      update({ preset });
    } else {
      const { from, to } = getPresetRange(preset);
      onChange({ ...values, preset, from, to });
    }
  };

  const clearAll = () => {
    onChange({
      ...values,
      customer: '',
      vehicle: '',
      driver: '',
      route: '',
      material: '',
      lrNumber: '',
      product: '',
      billStatus: 'all',
      paymentStatus: 'all',
    });
  };

  return (
    <Card className="p-4">
      {/* Date presets */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {presetOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handlePresetChange(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                values.preset === opt.value
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {values.preset === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={values.from} onChange={(v) => update({ from: v })} className="w-36" />
            <span className="text-slate-400">—</span>
            <Input type="date" value={values.to} onChange={(v) => update({ to: v })} className="w-36" />
          </div>
        )}

        {hasAdvancedFilters && (
          <div className="ml-auto flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Clear ({activeFilterCount})
              </button>
            )}
            <button
              onClick={() => setShowAdvanced((s) => !s)}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5" />
              Filters
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Advanced filters */}
      {showAdvanced && hasAdvancedFilters && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {config.showCustomer && (
            <Select
              label={tr('customer')}
              value={values.customer}
              onChange={(v) => update({ customer: v })}
              options={customers.map((c) => ({ value: c, label: c }))}
              placeholder={tr('allRecords')}
            />
          )}
          {config.showVehicle && (
            <Select
              label={tr('vehicleNumber')}
              value={values.vehicle}
              onChange={(v) => update({ vehicle: v })}
              options={vehicles.map((v) => ({ value: v, label: v }))}
              placeholder={tr('allRecords')}
            />
          )}
          {config.showDriver && (
            <Select
              label={tr('driverName')}
              value={values.driver}
              onChange={(v) => update({ driver: v })}
              options={drivers.map((d) => ({ value: d, label: d }))}
              placeholder={tr('allRecords')}
            />
          )}
          {config.showRoute && (
            <Select
              label={tr('route')}
              value={values.route}
              onChange={(v) => update({ route: v })}
              options={routes.map((r) => ({ value: r, label: r }))}
              placeholder={tr('allRecords')}
            />
          )}
          {config.showMaterial && (
            <Select
              label={tr('material')}
              value={values.material}
              onChange={(v) => update({ material: v })}
              options={materials.map((m) => ({ value: m, label: m }))}
              placeholder={tr('allRecords')}
            />
          )}
          {config.showLrNumber && (
            <Select
              label={tr('lrNo')}
              value={values.lrNumber}
              onChange={(v) => update({ lrNumber: v })}
              options={lrNumbers.map((l) => ({ value: l, label: l }))}
              placeholder={tr('allRecords')}
            />
          )}
          {config.showProduct && (
            <Select
              label={tr('product')}
              value={values.product}
              onChange={(v) => update({ product: v })}
              options={products.map((p) => ({ value: p, label: p }))}
              placeholder={tr('allRecords')}
            />
          )}
          {config.showBillStatus && (
            <Select
              label={tr('billStatus')}
              value={values.billStatus}
              onChange={(v) => update({ billStatus: v })}
              options={[
                { value: 'paid', label: tr('paid') },
                { value: 'pending', label: tr('pending') },
                { value: 'cancelled', label: tr('cancelled') },
              ]}
              placeholder={tr('allRecords')}
            />
          )}
          {config.showPaymentStatus && (
            <Select
              label={tr('paymentStatusFilter')}
              value={values.paymentStatus}
              onChange={(v) => update({ paymentStatus: v })}
              options={[
                { value: 'paid', label: tr('paid') },
                { value: 'partial', label: tr('partial') },
                { value: 'pending', label: tr('pending') },
              ]}
              placeholder={tr('allRecords')}
            />
          )}
        </div>
      )}

      {children && <div className="mt-4">{children}</div>}
    </Card>
  );
}

// Summary card for report dashboards
export function ReportSummaryCard({
  label,
  value,
  color = 'sky',
  icon,
}: {
  label: string;
  value: string;
  color?: 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';
  icon?: ReactNode;
}) {
  const colors: Record<string, string> = {
    sky: 'bg-sky-50 border-sky-100 text-sky-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    rose: 'bg-rose-50 border-rose-100 text-rose-700',
    violet: 'bg-violet-50 border-violet-100 text-violet-700',
    slate: 'bg-slate-50 border-slate-100 text-slate-700',
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {icon && <div className="opacity-60">{icon}</div>}
      </div>
      <p className="mt-1.5 text-xl font-bold">{value}</p>
    </div>
  );
}
