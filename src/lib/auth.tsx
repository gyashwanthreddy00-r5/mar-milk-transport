import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile, Language } from '@/types/database';
import { t, TranslationKey } from '@/lib/i18n';

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  lang: Language;
  setLang: (lang: Language) => void;
  tr: (key: TranslationKey) => string;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfileWithRetry(uid: string, attempts = 5): Promise<Profile | null> {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, role, language, created_at')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      console.error(`Profile load attempt ${i + 1} error:`, error.message);
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
      continue;
    }
    if (data) return data as Profile;
    await new Promise((r) => setTimeout(r, 300 * (i + 1)));
  }
  return null;
}

async function ensureProfileExists(uid: string, email: string): Promise<Profile | null> {
  const existing = await loadProfileWithRetry(uid);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: uid, email, full_name: '' })
    .select('id, email, full_name, phone, role, language, created_at')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return loadProfileWithRetry(uid, 2);
    }
    console.error('Profile create error:', error.message);
    return null;
  }
  return data as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Language>('en');

  const applyProfile = useCallback((p: Profile) => {
    setProfile(p);
    setLangState(p.language || 'en');
  }, []);

  const ensureProfile = useCallback(async (uid: string, email: string): Promise<Profile | null> => {
    const p = await ensureProfileExists(uid, email);
    if (p) applyProfile(p);
    return p;
  }, [applyProfile]);

  const refreshProfile = useCallback(async () => {
    if (profile) {
      const p = await loadProfileWithRetry(profile.id);
      if (p) applyProfile(p);
    }
  }, [profile, applyProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        ensureProfile(session.user.id, session.user.email || '').finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      (async () => {
        if (session?.user) {
          await ensureProfile(session.user.id, session.user.email || '');
        } else {
          setProfile(null);
        }
        if (mounted) setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [ensureProfile]);

  const signIn = useCallback(async (phone: string, password: string): Promise<{ error: string | null }> => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-phone-login`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ phone, password }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        return { error: data.error || 'Could not sign in' };
      }

      if (typeof data.email !== 'string' || !data.email) {
        return { error: 'Could not complete sign-in. Please try again.' };
      }

      // Sign in with the auth account's email + the same password the user typed.
      // The edge function synced this password to the auth account above.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password,
      });

      if (signInError) {
        return { error: 'Could not complete sign-in. Please try again.' };
      }

      return { error: null };
    } catch {
      return { error: 'Network error. Please try again.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    if (profile) {
      supabase
        .from('profiles')
        .update({ language: newLang })
        .eq('id', profile.id)
        .then(({ error }) => {
          if (error) console.error('Language preference update failed:', error.message);
        });
    }
  }, [profile]);

  const tr = useCallback((key: TranslationKey) => t(lang, key), [lang]);

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, signOut, lang, setLang, tr, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
