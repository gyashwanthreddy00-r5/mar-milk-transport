import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import { AuthScreen } from '@/components/AuthScreen';
import { AppShell, ModuleKey } from '@/components/AppShell';
import { DashboardModule } from '@/modules/Dashboard';
import { MilkModule } from '@/modules/Milk';
import { TransportModule } from '@/modules/Transport';
import { VehiclesModule } from '@/modules/Vehicles';
import { FinanceModule } from '@/modules/Finance';
import { ReportsModule } from '@/modules/Reports';
import { SettingsModule } from '@/modules/Settings';
import { LoadingSpinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';

function AppContent() {
  const { profile, loading } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');

  // Seed default districts for first-time users
  useEffect(() => {
    if (profile) {
      supabase.from('districts').select('id', { count: 'exact', head: true }).then(({ count }) => {
        if (count === 0) {
          const defaults = ['Karimnagar', 'Jammikunta', 'Sircilla', 'Vemulawada'];
          supabase.from('districts').insert(defaults.map((name) => ({ name }))).then();
        }
      });
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner />
      </div>
    );
  }

  if (!profile) {
    return <AuthScreen />;
  }

  return (
    <AppShell activeModule={activeModule} onModuleChange={setActiveModule}>
      {activeModule === 'dashboard' && <DashboardModule />}
      {activeModule === 'milk' && <MilkModule />}
      {activeModule === 'transport' && <TransportModule />}
      {activeModule === 'vehicles' && <VehiclesModule />}
      {activeModule === 'finance' && <FinanceModule />}
      {activeModule === 'reports' && <ReportsModule />}
      {activeModule === 'settings' && <SettingsModule />}
    </AppShell>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
