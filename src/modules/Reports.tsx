import { useState } from 'react';
import { Milk, Truck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { MilkReports } from '@/modules/MilkReports';
import { TransportReports } from '@/modules/TransportReports';

type ReportSection = 'milk' | 'transport';

export function ReportsModule() {
  const { tr } = useAuth();
  const [section, setSection] = useState<ReportSection>('milk');

  return (
    <div className="space-y-5">
      <PageHeader title={tr('reports')} subtitle="Milk & Transport Analytics" />

      {/* Section toggle */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSection('milk')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            section === 'milk'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Milk className="h-4 w-4" />
          {tr('milkReports')}
        </button>
        <button
          onClick={() => setSection('transport')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            section === 'transport'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Truck className="h-4 w-4" />
          {tr('transportReports')}
        </button>
      </div>

      {section === 'milk' ? <MilkReports tr={tr as (k: string) => string} /> : <TransportReports tr={tr as (k: string) => string} />}
    </div>
  );
}
