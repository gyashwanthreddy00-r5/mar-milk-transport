import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showSuccess = useCallback((message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type: 'success' }]);
    setTimeout(() => remove(id), 3500);
  }, [remove]);

  const showError = useCallback((message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type: 'error' }]);
    setTimeout(() => remove(id), 5000);
  }, [remove]);

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg transition-all ${
              t.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle className="h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0" />
            )}
            <span className="text-sm font-medium">{t.message}</span>
            <button onClick={() => remove(t.id)} className="ml-2 text-white/70 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
