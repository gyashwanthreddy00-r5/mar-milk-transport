import { useState, type FormEvent } from 'react';
import { Globe, Loader2, LogIn, Phone, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui';
import { Language } from '@/types/database';

export function AuthScreen() {
  const { signIn, tr, lang, setLang } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchLang = (l: Language) => setLang(l);

  const validatePhone = (value: string): boolean => {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13;
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError('Please enter your mobile number');
      return;
    }
    if (!validatePhone(trimmedPhone)) {
      setError('Please enter a valid mobile number (10 digits)');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    const { error: signInError } = await signIn(trimmedPhone, password);
    setLoading(false);

    if (signInError) {
      setError(signInError);
      return;
    }
    // Auth state change listener in AuthProvider will handle the session
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-xl bg-white/10 p-1 backdrop-blur-sm">
        <Globe className="ml-1.5 mr-0.5 h-4 w-4 text-white/70" />
        <button
          onClick={() => switchLang('en')}
          className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
            lang === 'en' ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white'
          }`}
        >
          EN
        </button>
        <button
          onClick={() => switchLang('te')}
          className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
            lang === 'te' ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white'
          }`}
        >
          తె
        </button>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-sky-500/30">
            <img src="/coreone_icon_.png" alt="Core One logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{tr('appName')}</h1>
          <p className="mt-2 text-sm text-slate-400">{tr('appTagline')}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-xl font-bold text-slate-900">Welcome Back</h2>
          <p className="mt-1 text-sm text-slate-500">Enter your mobile number and password to sign in</p>

          <form onSubmit={handleSignIn} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Mobile Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                  placeholder="9876543210"
                  inputMode="numeric"
                  maxLength={13}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">Enter your 10-digit mobile number with or without country code</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</span>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            Use the mobile number and password linked to your account.
          </p>
        </div>
      </div>
    </div>
  );
}
