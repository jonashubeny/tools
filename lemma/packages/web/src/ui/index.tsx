import { AlertTriangle, CheckCircle2, CircleAlert, Info, Loader2, X, XCircle } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  useEffect,
  useId,
  useRef,
} from 'react';
import { Link } from 'react-router';
import { ApiFailure } from '../app/api';
import { useT } from '../app/i18n';
import { cn } from '../lib/cn';

// ----------------------------------------------------------------------------- buttons

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-solid text-white hover:bg-accent-solid-hover border border-transparent',
  secondary: 'bg-surface-2 text-ink hover:bg-surface-3 border border-border',
  ghost: 'bg-transparent text-ink-2 hover:text-ink hover:bg-surface-2 border border-transparent',
  danger: 'bg-transparent text-critical-ink hover:bg-critical-wash border border-border',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-lg',
};

const buttonClass = (variant: Variant, size: Size, className?: string): string =>
  cn(
    'inline-flex items-center justify-center font-medium whitespace-nowrap select-none transition-colors',
    'disabled:opacity-45 disabled:pointer-events-none',
    VARIANTS[variant],
    SIZES[size],
    className,
  );

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  busy?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  busy = false,
  className,
  children,
  disabled,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || busy}
      {...rest}
    >
      {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  className,
  children,
}: {
  to: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cn(buttonClass(variant, size, className), 'hover:no-underline')}>
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------------------ layout

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface-1', className)} {...rest}>
      {children}
    </div>
  );
}

/** A titled section inside a card or on a page. The label is small and technical. */
export function SectionLabel({
  children,
  className,
  action,
}: {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 className="mono-label">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  lead,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <div className="mono-label mb-1.5">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {lead && <p className="mt-1.5 text-ink-2">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// ------------------------------------------------------------------------- small pieces

export function Badge({
  children,
  tone = 'neutral',
  className,
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'outline';
  className?: string;
  title?: string;
}) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2 border-border',
    accent: 'bg-accent-wash text-accent-ink border-transparent',
    outline: 'bg-transparent text-ink-2 border-border-strong',
  };
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-[22px] items-center gap-1 rounded-md border px-1.5 font-mono text-[11px] leading-none whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">
      {children}
    </kbd>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 size={16} className={cn('animate-spin text-ink-3', className)} aria-hidden />;
}

export function Loading({ label }: { label?: string }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-ink-3" role="status">
      <Spinner />
      {label ?? t('Načítám…', 'Loading…')}
    </div>
  );
}

export type StatusTone = 'good' | 'warning' | 'serious' | 'critical' | 'info';

const STATUS_ICON = {
  good: CheckCircle2,
  warning: AlertTriangle,
  serious: CircleAlert,
  critical: XCircle,
  info: Info,
} as const;
const STATUS_COLOR: Record<StatusTone, string> = {
  good: 'var(--good)',
  warning: 'var(--warning)',
  serious: 'var(--serious)',
  critical: 'var(--critical)',
  info: 'var(--accent)',
};
const STATUS_WASH: Record<StatusTone, string> = {
  good: 'bg-good-wash',
  warning: 'bg-warning-wash',
  serious: 'bg-warning-wash',
  critical: 'bg-critical-wash',
  info: 'bg-accent-wash',
};

/** A state, always as icon plus words: colour alone never carries it. */
export function StatusIcon({ tone, size = 16 }: { tone: StatusTone; size?: number }) {
  const Icon = STATUS_ICON[tone];
  return <Icon size={size} style={{ color: STATUS_COLOR[tone] }} className="shrink-0" aria-hidden />;
}

export function Notice({
  tone = 'info',
  title,
  children,
  className,
  action,
}: {
  tone?: StatusTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn('flex gap-3 rounded-lg border border-border px-3.5 py-3 text-sm', STATUS_WASH[tone], className)}
      role={tone === 'critical' ? 'alert' : 'note'}
    >
      <div className="pt-0.5">
        <StatusIcon tone={tone} />
      </div>
      <div className="min-w-0 flex-1">
        {title && <div className="font-medium text-ink">{title}</div>}
        {children && <div className={cn('text-ink-2', title ? 'mt-0.5' : '')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function ErrorNote({ error, retry }: { error: unknown; retry?: () => void }) {
  const t = useT();
  const offline = error instanceof ApiFailure && error.status === 0;
  const message = offline
    ? t('Server neodpovídá. Zkontroluj, že Lemma běží.', 'The server is not responding. Check that Lemma is running.')
    : error instanceof ApiFailure
      ? `${t('Požadavek selhal', 'The request failed')} (${error.code})`
      : t('Něco se pokazilo.', 'Something went wrong.');
  return (
    <Notice
      tone="critical"
      title={message}
      action={
        retry && (
          <Button size="sm" onClick={retry}>
            {t('Zkusit znovu', 'Try again')}
          </Button>
        )
      }
    >
      {error instanceof ApiFailure && !offline ? error.message : null}
    </Notice>
  );
}

export function Empty({
  title,
  children,
  action,
  icon,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong px-6 py-10 text-center">
      {icon && <div className="text-ink-3">{icon}</div>}
      <div className="font-medium">{title}</div>
      {children && <div className="max-w-md text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ------------------------------------------------------------------------------ figures

/**
 * A ratio against a limit. The unfilled track is a lighter step of the same hue, so the
 * whole bar reads as one quantity.
 */
export function Meter({
  value,
  label,
  className,
  height = 6,
}: {
  value: number;
  label?: string;
  className?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full', className)}
      style={{ height, background: 'var(--accent-wash)' }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${clamped * 100}%`, background: 'var(--accent)', minWidth: clamped > 0 ? 3 : 0 }}
      />
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  className,
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mono-label truncate">{label}</div>
      <div className="mt-1 text-[1.6rem] font-semibold leading-none tracking-tight">{value}</div>
      {sub && <div className="mt-1.5 text-[13px] text-ink-2">{sub}</div>}
      {children}
    </div>
  );
}

// ------------------------------------------------------------------------------- inputs

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

const inputClass =
  'h-9 w-full rounded-lg border border-border-strong bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none';

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputClass, 'pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="text-sm text-ink">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full border transition-colors',
          checked ? 'border-transparent bg-accent-solid' : 'border-border-strong bg-surface-3',
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all',
            checked ? 'left-[19px]' : 'left-[3px]',
          )}
        />
      </button>
    </div>
  );
}

/** A small set of mutually exclusive choices, shown all at once. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md font-medium whitespace-nowrap transition-colors',
            size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-[13px]',
            option.value === value ? 'bg-surface-1 text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------------------ overlay

/** A panel sliding in from the right, or a centred dialog. Escape and the backdrop close it. */
export function Overlay({
  open,
  onClose,
  title,
  children,
  side = 'right',
  width = 440,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  side?: 'right' | 'center';
  width?: number;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        style={{ width: `min(${width}px, 100vw)`, boxShadow: 'var(--shadow)' }}
        className={cn(
          'relative flex max-h-dvh flex-col border-border bg-surface-1 outline-none',
          side === 'right' ? 'ml-auto h-dvh border-l' : 'm-auto max-h-[88dvh] rounded-xl border',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 truncate font-semibold">{title}</div>
          <IconButton label={t('Zavřít', 'Close')} onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
