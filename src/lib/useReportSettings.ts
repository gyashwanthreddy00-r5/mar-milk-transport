import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ALL_REPORTS } from '@/lib/reportRegistry';

export interface ReportSetting {
  id: string;
  report_key: string;
  report_name: string;
  module: string;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string;
}

type SettingsMap = Map<string, boolean>;

let cachedSettings: SettingsMap | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000;

export function useReportSettings() {
  const [settings, setSettings] = useState<SettingsMap>(cachedSettings ?? new Map());
  const [loading, setLoading] = useState(!cachedSettings);

  const load = useCallback(async () => {
    const now = Date.now();
    if (cachedSettings && now - cacheTimestamp < CACHE_TTL) {
      setSettings(cachedSettings);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('report_settings')
      .select('report_key, is_active');

    if (error) {
      console.error('Failed to load report settings:', error.message);
      const fallback = new Map<string, boolean>();
      ALL_REPORTS.forEach((r) => fallback.set(r.key, true));
      cachedSettings = fallback;
      cacheTimestamp = now;
      setSettings(fallback);
      setLoading(false);
      return;
    }

    const map = new Map<string, boolean>();
    ALL_REPORTS.forEach((r) => map.set(r.key, true));
    (data || []).forEach((row: { report_key: string; is_active: boolean }) => {
      map.set(row.report_key, row.is_active);
    });

    cachedSettings = map;
    cacheTimestamp = now;
    setSettings(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isReportActive = useCallback(
    (reportKey: string): boolean => {
      if (!settings) return true;
      const active = settings.get(reportKey);
      return active !== false;
    },
    [settings]
  );

  const refresh = useCallback(async () => {
    cachedSettings = null;
    cacheTimestamp = 0;
    await load();
  }, [load]);

  return { settings, loading, isReportActive, refresh };
}

export function invalidateReportSettingsCache() {
  cachedSettings = null;
  cacheTimestamp = 0;
}
