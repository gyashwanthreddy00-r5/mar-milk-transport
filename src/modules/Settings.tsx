import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Save, MapPin, Building2, User, Settings as Cog, Users, Package, BarChart3, Pencil, Boxes, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Card,
  PageHeader,
  Button,
  Input,
  Select,
  Badge,
  Modal,
  LoadingSpinner,
} from '@/components/ui';
import { formatCurrency } from '@/lib/calc';
import { District, Location, Driver, Material, Settings as SettingsType, Profile, Product } from '@/types/database';
import { useToast } from '@/components/Toast';
import { ReportManagement } from '@/components/ReportManagement';

type SubTab = 'general' | 'locations' | 'districts' | 'materials' | 'products' | 'drivers' | 'users' | 'reports';

export function SettingsModule() {
  const { tr, profile } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('general');

  const tabs: { key: SubTab; label: string; icon: typeof Cog }[] = [
    { key: 'general', label: tr('generalSettings'), icon: Cog },
    { key: 'districts', label: tr('districts'), icon: Building2 },
    { key: 'locations', label: tr('locations'), icon: MapPin },
    { key: 'materials', label: 'Materials', icon: Package },
    { key: 'products', label: tr('productSettings'), icon: Boxes },
    { key: 'drivers', label: tr('drivers'), icon: User },
    { key: 'users', label: tr('userManagement'), icon: Users },
    { key: 'reports', label: 'Report Management', icon: BarChart3 },
  ];

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="space-y-6">
      <PageHeader title={tr('settings')} subtitle={tr('generalSettings')} />

      <div className="flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const disabled = (tab.key === 'users' || tab.key === 'reports') && !isAdmin;
          return (
            <button
              key={tab.key}
              onClick={() => !disabled && setSubTab(tab.key)}
              disabled={disabled}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                subTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {subTab === 'general' && <GeneralSettings />}
      {subTab === 'districts' && <DistrictsManager />}
      {subTab === 'locations' && <LocationsManager />}
      {subTab === 'materials' && <MaterialsManager />}
      {subTab === 'products' && <ProductsManager />}
      {subTab === 'drivers' && <DriversManager />}
      {subTab === 'users' && isAdmin && <UserManagement />}
      {subTab === 'reports' && isAdmin && <ReportManagement />}
    </div>
  );
}

// ===== General Settings =====
function GeneralSettings() {
  const { tr, profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    company_name: 'MAR Transport',
    currency: '₹',
    gst_rate: '18',
    diesel_rate: '0',
    default_language: 'en' as 'en' | 'te',
    show_sgst_cgst: false,
  });

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('settings').select('*').order('created_at').limit(1).maybeSingle();
    if (data) {
      const s = data as SettingsType;
      setSettings(s);
      setForm({
        company_name: s.company_name,
        currency: s.currency,
        gst_rate: String(s.gst_rate),
        diesel_rate: String(s.diesel_rate || 0),
        default_language: s.default_language,
        show_sgst_cgst: s.show_sgst_cgst ?? false,
      });
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const payload = {
      company_name: form.company_name,
      currency: form.currency,
      gst_rate: parseFloat(form.gst_rate) || 18,
      diesel_rate: parseFloat(form.diesel_rate) || 0,
      default_language: form.default_language,
      show_sgst_cgst: form.show_sgst_cgst,
    };
    let writeError;
    if (settings) {
      ({ error: writeError } = await supabase.from('settings').update(payload).eq('id', settings.id));
    } else {
      ({ error: writeError } = await supabase.from('settings').insert({ ...payload, user_id: profile.id }));
    }
    if (writeError) {
      showError('Could not save settings. Please try again.');
      setSaving(false);
      return;
    }
    showSuccess('Settings saved');
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Card className="max-w-2xl p-6">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
        <Cog className="h-5 w-5 text-slate-400" />
        {tr('companyDetails')}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label={tr('companyName')} value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} className="sm:col-span-2" />
        <Input label={tr('currency')} value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
        <Input label={tr('gstRate')} type="number" step="0.01" value={form.gst_rate} onChange={(v) => setForm({ ...form, gst_rate: v })} />
        <Input label={tr('dieselRate')} type="number" step="0.01" value={form.diesel_rate} onChange={(v) => setForm({ ...form, diesel_rate: v })} />
        <Select
          label={tr('defaultLanguage')}
          value={form.default_language}
          onChange={(v) => setForm({ ...form, default_language: v as 'en' | 'te' })}
          options={[
            { value: 'en', label: tr('english') },
            { value: 'te', label: tr('telugu') },
          ]}
          className="sm:col-span-2"
        />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Show SGST / CGST Split</p>
            <p className="text-xs text-slate-500">When ON, invoices show GST split into SGST and CGST. When OFF, GST is shown as a single combined amount. Both are always on or off together.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <div className={`relative h-6 w-11 rounded-full transition-colors ${form.show_sgst_cgst ? 'bg-sky-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.show_sgst_cgst ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <input type="checkbox" className="sr-only" checked={form.show_sgst_cgst} onChange={(e) => setForm({ ...form, show_sgst_cgst: e.target.checked })} />
            <span className={`text-sm font-medium ${form.show_sgst_cgst ? 'text-sky-600' : 'text-slate-400'}`}>
              {form.show_sgst_cgst ? 'ON' : 'OFF'}
            </span>
          </label>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? tr('loading') : tr('save')}
        </Button>
        {saved && <span className="text-sm font-medium text-emerald-600">{tr('saved')}</span>}
      </div>
    </Card>
  );
}

// ===== Districts Manager =====
function DistrictsManager() {
  const { tr, profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('districts').select('*').order('name');
    setDistricts((data || []) as District[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('districts').insert({ name: newName.trim() });
    if (error) { showError('Could not add district.'); return; }
    showSuccess('District added');
    setNewName('');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr('confirmDelete'))) return;
    const { error } = await supabase.from('districts').delete().eq('id', id);
    if (error) { showError('Could not delete district.'); return; }
    showSuccess('District deleted');
    load();
  };

  const handleSeedDefaults = async () => {
    if (!profile) return;
    const defaults = ['Karimnagar', 'Jammikunta', 'Sircilla', 'Vemulawada'];
    const existing = districts.map((d) => d.name.toLowerCase());
    const toAdd = defaults.filter((d) => !existing.includes(d.toLowerCase()));
    if (toAdd.length === 0) return;
    const { error } = await supabase.from('districts').insert(toAdd.map((name) => ({ name })));
    if (error) { showError('Could not add default districts.'); return; }
    showSuccess(`${toAdd.length} district(s) added`);
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Card className="max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Building2 className="h-5 w-5 text-slate-400" />
          {tr('districts')}
        </h3>
        {districts.length === 0 && (
          <Button variant="outline" size="sm" onClick={handleSeedDefaults}>
            <Plus className="h-3.5 w-3.5" />
            Add Defaults
          </Button>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        <Input value={newName} onChange={setNewName} placeholder={tr('addDistrict')} className="flex-1" />
        <Button onClick={handleAdd}><Plus className="h-4 w-4" />{tr('add')}</Button>
      </div>

      <div className="space-y-2">
        {districts.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-800">{d.name}</span>
            <button onClick={() => handleDelete(d.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {districts.length === 0 && <p className="py-4 text-center text-sm text-slate-400">{tr('noData')}</p>}
      </div>
    </Card>
  );
}

// ===== Locations Manager =====
function LocationsManager() {
  const { tr, profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('locations').select('*').order('name');
    setLocations((data || []) as Location[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('locations').insert({ name: newName.trim() });
    if (error) { showError('Could not add location.'); return; }
    showSuccess('Location added');
    setNewName('');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr('confirmDelete'))) return;
    const { error } = await supabase.from('locations').delete().eq('id', id);
    if (error) { showError('Could not delete location.'); return; }
    showSuccess('Location deleted');
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Card className="max-w-2xl p-6">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
        <MapPin className="h-5 w-5 text-slate-400" />
        {tr('locations')}
      </h3>

      <div className="mb-4 flex gap-2">
        <Input value={newName} onChange={setNewName} placeholder={tr('addLocation')} className="flex-1" />
        <Button onClick={handleAdd}><Plus className="h-4 w-4" />{tr('add')}</Button>
      </div>

      <div className="space-y-2">
        {locations.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-800">{l.name}</span>
            <button onClick={() => handleDelete(l.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {locations.length === 0 && <p className="py-4 text-center text-sm text-slate-400">{tr('noData')}</p>}
      </div>
    </Card>
  );
}

// ===== Drivers Manager =====
function DriversManager() {
  const { tr, profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [editingAdvance, setEditingAdvance] = useState<string | null>(null);
  const [advanceValue, setAdvanceValue] = useState('');
  const [savingAdvance, setSavingAdvance] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('drivers').select('*').order('name');
    setDrivers((data || []) as Driver[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('drivers').insert({ name: newName.trim(), phone: newPhone.trim(), is_active: true });
    if (error) { showError('Could not add driver.'); return; }
    showSuccess('Driver added');
    setNewName('');
    setNewPhone('');
    load();
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('drivers').update({ is_active: !current }).eq('id', id);
    if (error) { showError('Could not update driver.'); return; }
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr('confirmDelete'))) return;
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (error) { showError('Could not delete driver.'); return; }
    showSuccess('Driver deleted');
    load();
  };

  const startEditAdvance = (d: Driver) => {
    setEditingAdvance(d.id);
    setAdvanceValue(String(d.advance_salary || 0));
  };

  const cancelEditAdvance = () => {
    setEditingAdvance(null);
    setAdvanceValue('');
  };

  const saveAdvance = async (driverId: string) => {
    const parsed = parseFloat(advanceValue);
    if (isNaN(parsed) || parsed < 0) {
      showError('Enter a valid amount (0 or more)');
      return;
    }
    setSavingAdvance(true);
    const { error } = await supabase.from('drivers').update({ advance_salary: parsed }).eq('id', driverId);
    setSavingAdvance(false);
    if (error) { showError('Could not save advance salary.'); return; }
    showSuccess('Advance salary saved');
    setEditingAdvance(null);
    setAdvanceValue('');
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Card className="max-w-3xl p-6">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
        <User className="h-5 w-5 text-slate-400" />
        {tr('drivers')}
      </h3>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input value={newName} onChange={setNewName} placeholder={tr('driverName')} />
        <Input value={newPhone} onChange={setNewPhone} placeholder={tr('phone')} />
        <Button onClick={handleAdd}><Plus className="h-4 w-4" />{tr('add')}</Button>
      </div>

      <div className="space-y-2">
        {drivers.map((d) => (
          <div key={d.id} className="flex flex-col gap-3 rounded-xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${d.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <div>
                <span className="text-sm font-medium text-slate-800">{d.name}</span>
                {d.phone && <span className="ml-3 text-sm text-slate-500">{d.phone}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Advance Salary */}
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1">
                <span className="text-xs font-medium text-amber-700">Advance</span>
                {editingAdvance === d.id ? (
                  <>
                    <div className="relative">
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-amber-500">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={advanceValue}
                        onChange={(e) => setAdvanceValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveAdvance(d.id); if (e.key === 'Escape') cancelEditAdvance(); }}
                        className="w-20 rounded border border-amber-200 bg-white py-0.5 pl-5 pr-1.5 text-xs font-semibold text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={() => saveAdvance(d.id)}
                      disabled={savingAdvance}
                      className="rounded p-1 text-emerald-600 hover:bg-emerald-100 disabled:opacity-40"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={cancelEditAdvance}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200"
                    >
                      <span className="text-xs">×</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startEditAdvance(d)}
                    className="flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-900"
                  >
                    ₹{formatCurrency(d.advance_salary || 0)}
                    <Pencil className="h-3 w-3 text-amber-500" />
                  </button>
                )}
              </div>
              <button
                onClick={() => handleToggleActive(d.id, d.is_active)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${d.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                {d.is_active ? tr('active') : tr('inactive')}
              </button>
              <button onClick={() => handleDelete(d.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {drivers.length === 0 && <p className="py-4 text-center text-sm text-slate-400">{tr('noData')}</p>}
      </div>
    </Card>
  );
}

// ===== Materials Manager =====
function MaterialsManager() {
  const { tr, profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('materials').select('*').order('name');
    setMaterials((data || []) as Material[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('materials').insert({ name: newName.trim() });
    if (error) { showError('Could not add material.'); return; }
    showSuccess('Material added');
    setNewName('');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr('confirmDelete'))) return;
    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (error) { showError('Could not delete material.'); return; }
    showSuccess('Material deleted');
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Card className="max-w-2xl p-6">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
        <Package className="h-5 w-5 text-slate-400" />
        Materials
      </h3>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <Input value={newName} onChange={setNewName} placeholder="e.g. Fly Ash, Sand, Cement..." />
        <Button onClick={handleAdd}><Plus className="h-4 w-4" />{tr('add')}</Button>
      </div>

      <div className="space-y-2">
        {materials.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-800">{m.name}</span>
            <button onClick={() => handleDelete(m.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {materials.length === 0 && <p className="py-4 text-center text-sm text-slate-400">{tr('noData')}</p>}
      </div>
    </Card>
  );
}

// ===== Products Manager =====
function ProductsManager() {
  const { tr, profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    unit: 'L',
    unit_display: 'Litres',
    default_purchase_rate: '',
    default_selling_rate: '',
    is_active: true,
    sort_order: 0,
  });

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('products').select('*').order('sort_order', { ascending: true });
    setProducts((data || []) as Product[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', code: '', unit: 'L', unit_display: 'Litres', default_purchase_rate: '', default_selling_rate: '', is_active: true, sort_order: products.length + 1 });
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code,
      unit: p.unit,
      unit_display: p.unit_display,
      default_purchase_rate: String(p.default_purchase_rate),
      default_selling_rate: String(p.default_selling_rate),
      is_active: p.is_active,
      sort_order: p.sort_order,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim()) { showError('Product name is required'); return; }
    if (!form.unit.trim()) { showError('Unit is required'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      unit: form.unit.trim(),
      unit_display: form.unit_display.trim(),
      default_purchase_rate: parseFloat(form.default_purchase_rate) || 0,
      default_selling_rate: parseFloat(form.default_selling_rate) || 0,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };
    let writeError;
    if (editing) {
      ({ error: writeError } = await supabase.from('products').update(payload).eq('id', editing.id));
    } else {
      ({ error: writeError } = await supabase.from('products').insert({ ...payload, user_id: profile!.id }));
    }
    if (writeError) {
      showError('Could not save product. Please try again.');
      setSaving(false);
      return;
    }
    showSuccess(editing ? 'Product updated' : 'Product added');
    setModalOpen(false);
    setSaving(false);
    load();
  };

  const handleToggleActive = async (p: Product) => {
    const { error } = await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) { showError('Could not update product.'); return; }
    load();
  };

  const handleDelete = async (p: Product) => {
    // Check if product has transactions
    const { count } = await supabase.from('milk_entries').select('*', { count: 'exact', head: true }).eq('product_id', p.id);
    if ((count ?? 0) > 0) {
      showError(tr('cannotDeleteProduct'));
      return;
    }
    if (!confirm(tr('confirmDelete'))) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) { showError('Could not delete product.'); return; }
    showSuccess('Product deleted');
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Boxes className="h-5 w-5 text-slate-400" />
          {tr('productSettings')}
        </h3>
        <Button onClick={openAdd}><Plus className="h-4 w-4" />{tr('addProduct')}</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">{tr('productName')}</th>
              <th className="px-4 py-3">{tr('productCode')}</th>
              <th className="px-4 py-3">{tr('unit')}</th>
              <th className="px-4 py-3 text-right">{tr('defaultPurchaseRate')}</th>
              <th className="px-4 py-3 text-right">{tr('defaultSellingRate')}</th>
              <th className="px-4 py-3 text-center">{tr('status')}</th>
              <th className="px-4 py-3 text-right">{tr('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-3 text-slate-500">{p.code || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{p.unit} ({p.unit_display})</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(p.default_purchase_rate)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(p.default_selling_rate)}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleActive(p)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${p.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                  >
                    {p.is_active ? tr('active') : tr('inactive')}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">{tr('noData')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? tr('editProduct') : tr('addProduct')} size="md">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={`${tr('productName')} *`} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Input label={tr('productCode')} value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
          <Input label={`${tr('unit')} *`} value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="L, Kg..." />
          <Input label={tr('unitDisplay')} value={form.unit_display} onChange={(v) => setForm({ ...form, unit_display: v })} placeholder="Litres, Kilograms..." />
          <Input label={tr('defaultPurchaseRate')} type="number" step="0.01" value={form.default_purchase_rate} onChange={(v) => setForm({ ...form, default_purchase_rate: v })} />
          <Input label={tr('defaultSellingRate')} type="number" step="0.01" value={form.default_selling_rate} onChange={(v) => setForm({ ...form, default_selling_rate: v })} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm font-semibold text-slate-700">{tr('active')}</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{tr('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? tr('saving') : tr('save')}</Button>
        </div>
      </Modal>
    </Card>
  );
}

// ===== User Management (admin only) =====
function UserManagement() {
  const { tr, profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState({ full_name: '', phone: '', password: '', role: 'staff' });
  const [resetPassword, setResetPassword] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, email, full_name, phone, role, language, created_at').order('created_at', { ascending: false });
    setUsers((data || []) as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateRole = async (id: string, role: string) => {
    const { error } = await supabase.rpc('update_user_role', { target_user: id, new_role: role });
    if (error) {
      showError('Could not update user role. You must be an admin.');
      return;
    }
    showSuccess('User role updated');
    load();
  };

  const handleCreate = async () => {
    if (!profile) return;
    if (!createForm.full_name.trim()) { showError('Name is required'); return; }
    if (!createForm.phone.trim()) { showError('Mobile number is required'); return; }
    if (!createForm.password || createForm.password.length < 4) { showError('Password must be at least 4 characters'); return; }

    setSaving(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-manage-user`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'create',
          caller_id: profile.id,
          full_name: createForm.full_name.trim(),
          phone: createForm.phone.trim(),
          password: createForm.password,
          role: createForm.role,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        showError(data.error || 'Could not create user');
        setSaving(false);
        return;
      }
      showSuccess('User created successfully');
      setCreateOpen(false);
      setCreateForm({ full_name: '', phone: '', password: '', role: 'staff' });
      load();
    } catch {
      showError('Network error. Please try again.');
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!profile || !resetTarget) return;
    if (!resetPassword || resetPassword.length < 4) { showError('Password must be at least 4 characters'); return; }

    setSaving(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-manage-user`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'reset_password',
          caller_id: profile.id,
          target_user_id: resetTarget.id,
          password: resetPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        showError(data.error || 'Could not reset password');
        setSaving(false);
        return;
      }
      showSuccess('Password reset successfully');
      setResetTarget(null);
      setResetPassword('');
    } catch {
      showError('Network error. Please try again.');
    }
    setSaving(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Users className="h-5 w-5 text-slate-400" />
          {tr('userManagement')}
        </h3>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />Add User</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">{tr('fullName')}</th>
              <th className="px-4 py-3">Mobile Number</th>
              <th className="px-4 py-3">{tr('role')}</th>
              <th className="px-4 py-3 text-right">{tr('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.full_name || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{u.phone || '—'}</td>
                <td className="px-4 py-3">
                  {u.id === profile?.id ? (
                    <Badge color="sky">{tr(u.role)}</Badge>
                  ) : (
                    <Select
                      value={u.role}
                      onChange={(v) => updateRole(u.id, v)}
                      options={[
                        { value: 'admin', label: tr('admin') },
                        { value: 'manager', label: tr('manager') },
                        { value: 'staff', label: tr('staff') },
                      ]}
                      className="w-32"
                    />
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {u.id !== profile?.id && (
                      <button
                        onClick={() => { setResetTarget(u); setResetPassword(''); }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                        title="Reset Password"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add New User" size="md">
        <div className="space-y-4">
          <Input label="Full Name *" value={createForm.full_name} onChange={(v) => setCreateForm({ ...createForm, full_name: v })} />
          <Input label="Mobile Number *" value={createForm.phone} onChange={(v) => setCreateForm({ ...createForm, phone: v })} placeholder="9876543210" />
          <Input label="Password *" type="password" value={createForm.password} onChange={(v) => setCreateForm({ ...createForm, password: v })} />
          <Select
            label="Role"
            value={createForm.role}
            onChange={(v) => setCreateForm({ ...createForm, role: v })}
            options={[
              { value: 'staff', label: tr('staff') },
              { value: 'manager', label: tr('manager') },
              { value: 'admin', label: tr('admin') },
            ]}
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>{tr('cancel')}</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? tr('saving') : 'Create User'}</Button>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title="Reset Password" size="md">
        <p className="mb-4 text-sm text-slate-600">
          Set a new password for <span className="font-semibold text-slate-800">{resetTarget?.full_name || resetTarget?.phone}</span>
        </p>
        <Input label="New Password *" type="password" value={resetPassword} onChange={setResetPassword} />
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setResetTarget(null)}>{tr('cancel')}</Button>
          <Button onClick={handleResetPassword} disabled={saving}>{saving ? tr('saving') : 'Reset Password'}</Button>
        </div>
      </Modal>
    </Card>
  );
}
