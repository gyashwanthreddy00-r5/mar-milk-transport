import { useState, useEffect, ReactNode } from 'react';
import {
  LayoutDashboard,
  Milk,
  Truck,
  Car,
  Wallet,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Globe,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui';

export type ModuleKey =
  | 'dashboard'
  | 'milk'
  | 'transport'
  | 'vehicles'
  | 'finance'
  | 'reports'
  | 'settings';

interface NavItem {
  key: ModuleKey;
  label: string;
  icon: ReactNode;
}

const SIDEBAR_KEY = 'mar-erp-sidebar-collapsed';

export function AppShell({
  activeModule,
  onModuleChange,
  children,
}: {
  activeModule: ModuleKey;
  onModuleChange: (m: ModuleKey) => void;
  children: ReactNode;
}) {
  const { profile, signOut, tr, lang, setLang } = useAuth();
  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(desktopCollapsed)); } catch { /* ignore */ }
  }, [desktopCollapsed]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const navItems: NavItem[] = [
    { key: 'dashboard', label: tr('dashboard'), icon: <LayoutDashboard className="h-5 w-5" /> },
    { key: 'milk', label: tr('milkDistribution'), icon: <Milk className="h-5 w-5" /> },
    { key: 'transport', label: tr('transport'), icon: <Truck className="h-5 w-5" /> },
    { key: 'vehicles', label: tr('vehicleMaster'), icon: <Car className="h-5 w-5" /> },
    { key: 'finance', label: tr('finance'), icon: <Wallet className="h-5 w-5" /> },
    { key: 'reports', label: tr('reports'), icon: <BarChart3 className="h-5 w-5" /> },
    { key: 'settings', label: tr('settings'), icon: <SettingsIcon className="h-5 w-5" /> },
  ];

  const toggleLang = () => setLang(lang === 'en' ? 'te' : 'en');

  const toggleSidebar = () => {
    if (window.innerWidth >= 1024) {
      setDesktopCollapsed((prev) => !prev);
    } else {
      setMobileOpen((prev) => !prev);
    }
  };

  const handleModuleChange = (m: ModuleKey) => {
    onModuleChange(m);
    if (window.innerWidth < 1024) {
      setMobileOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar — shared desktop persistent + mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${desktopCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'}`}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarContent
          navItems={navItems}
          activeModule={activeModule}
          onModuleChange={handleModuleChange}
          appName={tr('appName')}
          appTagline={tr('appTagline')}
        />
      </aside>

      {/* Main content */}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-[padding] duration-300 ease-in-out ${
          desktopCollapsed ? 'lg:pl-0' : 'lg:pl-64'
        }`}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-slate-500">
                {navItems.find((n) => n.key === activeModule)?.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">{lang === 'en' ? tr('english') : tr('telugu')}</span>
              <span className="sm:hidden">{lang === 'en' ? 'EN' : 'తె'}</span>
            </button>

            {/* User menu */}
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 py-1.5 pl-1.5 pr-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-white">
                <UserIcon className="h-4 w-4" />
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold text-slate-800">
                  {profile?.full_name || profile?.email}
                </p>
                <div className="flex items-center gap-1">
                  <Badge color="sky">{tr(profile?.role || 'staff')}</Badge>
                </div>
              </div>
            </div>

            <button
              onClick={signOut}
              className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
              title={tr('logout')}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  navItems,
  activeModule,
  onModuleChange,
  appName,
  appTagline,
}: {
  navItems: NavItem[];
  activeModule: ModuleKey;
  onModuleChange: (m: ModuleKey) => void;
  appName: string;
  appTagline: string;
}) {
  return (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
          <img src="/coreone_icon_.png" alt="Core One logo" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{appName}</p>
          <p className="truncate text-xs text-slate-500">{appTagline}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onModuleChange(item.key)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              activeModule === item.key
                ? 'bg-sky-50 text-sky-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className={activeModule === item.key ? 'text-sky-600' : 'text-slate-400'}>
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
            {activeModule === item.key && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sky-500" />
            )}
          </button>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-3 text-center">
          <p className="text-xs text-slate-500">© 2026 MAR ERP</p>
          <p className="mt-0.5 text-xs font-medium text-slate-400">v1.0</p>
        </div>
      </div>
    </>
  );
}
