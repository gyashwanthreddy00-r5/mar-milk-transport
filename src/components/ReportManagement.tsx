import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react';
import { Search, Save, Milk, Truck, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Button, LoadingSpinner, Badge } from '@/components/ui';
import { MILK_REPORTS, TRANSPORT_REPORTS, type ReportDef } from '@/lib/reportRegistry';
import { invalidateReportSettingsCache } from '@/lib/useReportSettings';

interface RowState {
  id: string | null;
  report_key: string;
  report_name: string;
  module: string;
  is_active: boolean;
}

export function ReportManagement() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('report_settings')
      .select('id, report_key, report_name, module, is_active');

    const dbMap = new Map<string, RowState>();
    (data || []).forEach((r: RowState) => dbMap.set(r.report_key, r));

    const merged: RowState[] = [
      ...MILK_REPORTS,
      ...TRANSPORT_REPORTS,
    ].map((def: ReportDef) => {
      const existing = dbMap.get(def.key);
      return {
        id: existing?.id ?? null,
        report_key: def.key,
        report_name: def.label,
        module: def.module,
        is_active: existing?.is_active ?? true,
      };
    });

    setRows(merged);
    setChangedKeys(new Set());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (reportKey: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.report_key === reportKey ? { ...r, is_active: !r.is_active } : r
      )
    );
    setChangedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(reportKey)) next.delete(reportKey);
      else next.add(reportKey);
      return next;
    });
  };

  const setGroup = (module: 'milk' | 'transport', active: boolean) => {
    const groupKeys = rows.filter((r) => r.module === module).map((r) => r.report_key);
    setRows((prev) =>
      prev.map((r) => (r.module === module ? { ...r, is_active: active } : r))
    );
    setChangedKeys((prev) => {
      const next = new Set(prev);
      groupKeys.forEach((k) => next.add(k));
      return next;
    });
  };

  const setAll = (active: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, is_active: active })));
    setChangedKeys((prev) => {
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.report_key));
      return next;
    });
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    const toUpsert = rows
      .filter((r) => changedKeys.has(r.report_key))
      .map((r) => {
        const row: Record<string, unknown> = {
          report_key: r.report_key,
          report_name: r.report_name,
          module: r.module,
          is_active: r.is_active,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        };
        if (r.id) row.id = r.id;
        return row;
      });

    if (toUpsert.length > 0) {
      const { error } = await supabase
        .from('report_settings')
        .upsert(toUpsert, { onConflict: 'report_key' });

      if (error) {
        console.error('Failed to save report settings:', error.message);
        alert('Failed to save report settings. Please try again.');
        setSaving(false);
        return;
      }
    }

    invalidateReportSettingsCache();
    setSaving(false);
    setSaved(true);
    setChangedKeys(new Set());
    setTimeout(() => setSaved(false), 3000);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.report_name.toLowerCase().includes(q) || r.report_key.toLowerCase().includes(q));
  }, [rows, search]);

  const milkRows = filtered.filter((r) => r.module === 'milk');
  const transportRows = filtered.filter((r) => r.module === 'transport');
  const activeCount = rows.filter((r) => r.is_active).length;
  const totalCount = rows.length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      {/* Search + bulk actions */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge color="sky">{activeCount}/{totalCount} active</Badge>
            {changedKeys.size > 0 && <Badge color="amber">{changedKeys.size} unsaved</Badge>}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={() => setGroup('milk', true)}>
            <CheckCircle2 className="h-3.5 w-3.5" />Enable All Milk
          </Button>
          <Button variant="outline" size="sm" onClick={() => setGroup('milk', false)}>
            Disable All Milk
          </Button>
          <Button variant="outline" size="sm" onClick={() => setGroup('transport', true)}>
            <CheckCircle2 className="h-3.5 w-3.5" />Enable All Transport
          </Button>
          <Button variant="outline" size="sm" onClick={() => setGroup('transport', false)}>
            Disable All Transport
          </Button>
          <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
          <Button variant="outline" size="sm" onClick={() => setAll(true)}>
            Enable All
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAll(false)}>
            Disable All
          </Button>
        </div>
      </Card>

      {/* Milk Reports */}
      {milkRows.length > 0 && (
        <ReportGroup
          title="Milk Reports"
          icon={<Milk className="h-5 w-5 text-sky-600" />}
          accent="sky"
          reports={milkRows}
          changedKeys={changedKeys}
          onToggle={toggle}
        />
      )}

      {/* Transport Reports */}
      {transportRows.length > 0 && (
        <ReportGroup
          title="Transport Reports"
          icon={<Truck className="h-5 w-5 text-amber-600" />}
          accent="amber"
          reports={transportRows}
          changedKeys={changedKeys}
          onToggle={toggle}
        />
      )}

      {filtered.length === 0 && (
        <Card className="p-8 text-center text-sm text-slate-400">No reports match your search.</Card>
      )}

      {/* Save bar */}
      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-md">
        {saved && <span className="text-sm font-medium text-emerald-600">Settings saved — changes are live.</span>}
        <Button onClick={handleSave} disabled={saving || changedKeys.size === 0}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : `Save Changes${changedKeys.size > 0 ? ` (${changedKeys.size})` : ''}`}
        </Button>
      </div>
    </div>
  );
}

function ReportGroup({
  title,
  icon,
  accent,
  reports,
  changedKeys,
  onToggle,
}: {
  title: string;
  icon: ReactNode;
  accent: 'sky' | 'amber';
  reports: RowState[];
  changedKeys: Set<string>;
  onToggle: (key: string) => void;
}) {
  const activeCount = reports.filter((r) => r.is_active).length;
  const accentBg = accent === 'sky' ? 'bg-sky-50' : 'bg-amber-50';
  const accentText = accent === 'sky' ? 'text-sky-700' : 'text-amber-700';

  return (
    <Card className="overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-3 ${accentBg}`}>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className={`text-sm font-bold ${accentText}`}>{title}</h3>
        </div>
        <span className="text-xs font-medium text-slate-500">{activeCount}/{reports.length} active</span>
      </div>
      <div className="divide-y divide-slate-100">
        {reports.map((r) => (
          <ReportToggleRow
            key={r.report_key}
            report={r}
            changed={changedKeys.has(r.report_key)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </Card>
  );
}

function ReportToggleRow({
  report,
  changed,
  onToggle,
}: {
  report: RowState;
  changed: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-slate-50/50">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-800">{report.report_name}</span>
        {changed && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Unsaved change" />}
      </div>
      <button
        onClick={() => onToggle(report.report_key)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30 ${
          report.is_active ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
        role="switch"
        aria-checked={report.is_active}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            report.is_active ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
