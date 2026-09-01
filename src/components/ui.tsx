import { ReactNode, useState, useRef, useEffect } from 'react';
import { Loader2, ChevronDown } from 'lucide-react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}) {
  const variants = {
    primary: 'bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 shadow-sm',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 border border-red-200',
    ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-xl font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
  disabled = false,
  className = '',
}: {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const isNumeric = type === 'number';
  return (
    <div className={className}>
      {label && (
        <label className={`mb-1.5 block text-sm font-medium ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <input
        type={isNumeric ? 'text' : type}
        inputMode={isNumeric ? 'decimal' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
      />
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  required = false,
  className = '',
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Combobox({
  label,
  value,
  onChange,
  options,
  required = false,
  className = '',
  placeholder = '',
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className={className} ref={ref}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={open ? query : value}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          placeholder={placeholder}
          required={required}
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen(!open)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">
                {query ? `Press enter to use "${query}"` : 'No options'}
              </p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setQuery('');
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-sky-50 hover:text-sky-700 ${
                    opt === value ? 'bg-sky-50 font-medium text-sky-700' : 'text-slate-700'
                  }`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder = '',
  rows = 3,
  className = '',
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
      />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6">
      <div className={`my-8 w-full ${sizes[size]} rounded-2xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Badge({
  children,
  color = 'slate',
}: {
  children: ReactNode;
  color?: 'slate' | 'green' | 'amber' | 'red' | 'sky' | 'emerald';
}) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    sky: 'bg-sky-100 text-sky-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

export function LoadingSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-slate-400">
      <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
      {icon && <div className="mb-4 text-slate-300">{icon}</div>}
      <h3 className="text-base font-semibold text-slate-700">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  icon,
  trend,
  color = 'sky',
}: {
  label: string;
  value: string;
  icon: ReactNode;
  trend?: string;
  color?: 'sky' | 'emerald' | 'amber' | 'violet' | 'rose';
}) {
  const colors = {
    sky: 'bg-sky-50 text-sky-600 ring-sky-600/10',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-600/10',
    amber: 'bg-amber-50 text-amber-600 ring-amber-600/10',
    violet: 'bg-violet-50 text-violet-600 ring-violet-600/10',
    rose: 'bg-rose-50 text-rose-600 ring-rose-600/10',
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {trend && <p className="mt-1 text-xs text-slate-400">{trend}</p>}
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 [&>svg]:h-4 [&>svg]:w-4 ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
