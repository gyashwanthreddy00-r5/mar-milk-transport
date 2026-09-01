import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Car, Download } from 'lucide-react';
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
  EmptyState,
} from '@/components/ui';
import { formatCurrency } from '@/lib/calc';
import { ExportModal } from '@/components/ExportModal';
import { Vehicle, Driver } from '@/types/database';
import { useToast } from '@/components/Toast';

export function VehiclesModule() {
  const { tr, profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const [form, setForm] = useState({
    vehicle_number: '',
    owner_name: '',
    driver_id: '',
    monthly_emi: '',
    emi_date: '1',
    status: 'active' as 'active' | 'inactive',
  });

  const load = useCallback(async () => {
    if (!profile) return;
    const [vehRes, drvRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('vehicle_number'),
      supabase.from('drivers').select('*').order('name'),
    ]);
    setVehicles((vehRes.data || []) as Vehicle[]);
    setDrivers((drvRes.data || []) as Driver[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ vehicle_number: '', owner_name: '', driver_id: '', monthly_emi: '', emi_date: '1', status: 'active' });
    setModalOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({
      vehicle_number: v.vehicle_number,
      owner_name: v.owner_name || '',
      driver_id: v.driver_id || '',
      monthly_emi: String(v.monthly_emi),
      emi_date: String(v.emi_date),
      status: v.status,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.vehicle_number.trim()) {
      showError('Vehicle number is required');
      return;
    }
    const payload = {
      vehicle_number: form.vehicle_number,
      owner_name: form.owner_name || null,
      driver_id: form.driver_id || null,
      monthly_emi: parseFloat(form.monthly_emi) || 0,
      emi_date: parseInt(form.emi_date) || 1,
      status: form.status,
    };
    let writeError;
    if (editing) {
      ({ error: writeError } = await supabase.from('vehicles').update(payload).eq('id', editing.id));
    } else {
      ({ error: writeError } = await supabase.from('vehicles').insert(payload));
    }
    if (writeError) {
      showError('Could not save vehicle. Please try again.');
      return;
    }
    showSuccess(editing ? 'Vehicle updated' : 'Vehicle added');
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr('confirmDelete'))) return;
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) {
      showError('Could not delete vehicle. Please try again.');
      return;
    }
    showSuccess('Vehicle deleted');
    load();
  };

  const [exportOpen, setExportOpen] = useState(false);

  const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.name || '—';

  if (loading) {
    return (
      <div>
        <PageHeader title={tr('vehicleMaster')} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr('vehicleMaster')}
        subtitle={tr('vehicles')}
        action={
          <>
            <Button variant="outline" onClick={() => setExportOpen(true)}><Download className="h-4 w-4" />{tr('exportExcel')}</Button>
            <Button onClick={openAdd}><Plus className="h-4 w-4" />{tr('addVehicle')}</Button>
          </>
        }
      />

      {vehicles.length === 0 ? (
        <EmptyState
          icon={<Car className="h-12 w-12" />}
          title={tr('noVehicles')}
          action={<Button onClick={openAdd}><Plus className="h-4 w-4" />{tr('addVehicle')}</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <Card key={v.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${v.status === 'active' ? 'bg-sky-50 text-sky-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Car className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{v.vehicle_number}</p>
                    {v.owner_name && <p className="text-xs text-slate-400">Owner: {v.owner_name}</p>}
                    <p className="text-sm text-slate-500">{driverName(v.driver_id)}</p>
                  </div>
                </div>
                <Badge color={v.status === 'active' ? 'green' : 'slate'}>{tr(v.status)}</Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-xs text-slate-400">{tr('monthlyEmi')}</p>
                  <p className="text-sm font-semibold text-slate-800">{formatCurrency(v.monthly_emi)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{tr('emiDate')}</p>
                  <p className="text-sm font-semibold text-slate-800">{v.emi_date}th</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Daily EMI</p>
                  <p className="text-sm font-semibold text-amber-600">{formatCurrency(v.monthly_emi / 30)}</p>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-1">
                <button onClick={() => openEdit(v)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-sky-600"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(v.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        dateField="created_at"
        records={vehicles.map((v, idx) => {
          const driver = drivers.find((d) => d.id === v.driver_id);
          return { sr_no: idx + 1, created_at: v.created_at, vehicle_number: v.vehicle_number, owner_name: v.owner_name || '', driver_name: driver?.name || '', monthly_emi: v.monthly_emi, emi_date: v.emi_date, status: v.status };
        })}
        config={{
          reportTitle: 'VEHICLE MASTER REPORT',
          filenamePrefix: 'Vehicles_Report',
          dateField: 'created_at',
          columns: [
            { header: 'Sr No', key: 'sr_no', width: 8, align: 'center', type: 'integer' },
            { header: 'Vehicle Number', key: 'vehicle_number', width: 18, align: 'left' },
            { header: 'Owner Name', key: 'owner_name', width: 18, align: 'left' },
            { header: 'Driver', key: 'driver_name', width: 20, align: 'left' },
            { header: 'Monthly EMI', key: 'monthly_emi', width: 16, align: 'right', type: 'currency' },
            { header: 'EMI Date', key: 'emi_date', width: 12, align: 'center' },
            { header: 'Status', key: 'status', width: 12, align: 'center' },
          ],
          totals: [
            { label: 'Total Vehicles', columnKey: 'sr_no', value: vehicles.length },
            { label: 'Total Monthly EMI', columnKey: 'monthly_emi', value: vehicles.reduce((s, v) => s + v.monthly_emi, 0) },
          ],
        }}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? tr('editVehicle') : tr('addVehicle')}>
        <div className="space-y-4">
          <Input label={tr('vehicleNumber')} value={form.vehicle_number} onChange={(v) => setForm({ ...form, vehicle_number: v })} required placeholder="TS 09 AB 1234" />
          <Input label="Owner Name" value={form.owner_name} onChange={(v) => setForm({ ...form, owner_name: v })} placeholder="Vehicle owner name" />
          <Select
            label={tr('driver')}
            value={form.driver_id}
            onChange={(v) => setForm({ ...form, driver_id: v })}
            options={drivers.map((d) => ({ value: d.id, label: d.name }))}
            placeholder={tr('driver')}
          />
          <Input label={tr('monthlyEmi')} type="number" step="0.01" value={form.monthly_emi} onChange={(v) => setForm({ ...form, monthly_emi: v })} />
          <Input label={tr('emiDate')} type="number" min="1" max="31" value={form.emi_date} onChange={(v) => setForm({ ...form, emi_date: v })} />
          <Select
            label={tr('status')}
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v as 'active' | 'inactive' })}
            options={[
              { value: 'active', label: tr('active') },
              { value: 'inactive', label: tr('inactive') },
            ]}
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{tr('cancel')}</Button>
          <Button onClick={handleSave}>{tr('save')}</Button>
        </div>
      </Modal>
    </div>
  );
}
