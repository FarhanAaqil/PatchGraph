import { AlertCircle, ChevronLeft, ChevronRight, Info, type LucideIcon } from 'lucide-react';
import { memo, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import type { Band } from '../lib/severity';
import { formatNumber } from '../lib/format';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'quiet' | 'danger';
  size?: 'normal' | 'small';
  busy?: boolean;
  icon?: LucideIcon;
  block?: boolean;
};

export function Button({
  variant = 'default',
  size = 'normal',
  busy,
  icon: Icon,
  block,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant !== 'default' ? `btn-${variant}` : '',
    size === 'small' ? 'btn-small' : '',
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <span className="spinner" aria-hidden="true" /> : Icon ? <Icon size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function Card({
  children,
  flush,
  tint,
  className = '',
  style,
  ...rest
}: {
  children: ReactNode;
  flush?: boolean;
  tint?: boolean;
  className?: string;
  style?: CSSProperties;
} & Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'style'>) {
  return (
    <section
      className={`card ${flush ? 'card-flush' : ''} ${tint ? 'card-tint' : ''} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardHead({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card-head">
      <div>
        <h2>{title}</h2>
        {hint ? <p>{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHead({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {lead ? <p>{lead}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
}) {
  return (
    <div className="card stat">
      <div className="stat-label">
        {Icon ? <Icon size={16} aria-hidden="true" /> : null}
        {label}
      </div>
      {loading ? <Skeleton width={72} height={34} /> : <div className="stat-value">{value}</div>}
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

const BAND_ICON: Record<Band, string> = { critical: '▲▲', high: '▲', medium: '●', low: '○' };

export function SeverityBadge({ band, label }: { band: Band; label: string }) {
  return (
    <span className="badge" data-tone={band}>
      <span aria-hidden="true">{BAND_ICON[band]}</span>
      {label}
    </span>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: 'critical' | 'high' | 'medium' | 'low' | 'neutral' | 'done' | 'alert';
  title?: string;
}) {
  return (
    <span className="badge" data-tone={tone} title={title}>
      {children}
    </span>
  );
}

export function Skeleton({
  width = '100%',
  height = 14,
  radius,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
}) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

/** Placeholder rows that match the real table layout, so nothing jumps when data arrives. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 16,
            padding: '16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {Array.from({ length: columns }, (_, col) => (
            <Skeleton key={col} width={col === 0 ? '80%' : '60%'} height={16} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={26} aria-hidden="true" />
      </div>
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}

export function Notice({
  children,
  tone,
  icon: Icon = Info,
}: {
  children: ReactNode;
  tone?: 'alert';
  icon?: LucideIcon;
}) {
  return (
    <div className="notice" data-tone={tone} role={tone === 'alert' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty" role="alert">
      <div className="empty-icon">
        <AlertCircle size={26} aria-hidden="true" />
      </div>
      <h2>We could not load this</h2>
      <p>{message}</p>
      {onRetry ? (
        <div className="actions">
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export const Meter = memo(function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = Math.max(0, Math.min(100, (Math.abs(value) / max) * 100));
  return (
    <div className="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
});

export function Pagination({
  total,
  limit,
  offset,
  onChange,
  noun = 'results',
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
  noun?: string;
}) {
  if (total === 0) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <nav className="pager" aria-label="Pagination">
      <span aria-live="polite">
        Showing {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)} {noun}
      </span>
      <div className="pager-actions">
        <Button
          size="small"
          icon={ChevronLeft}
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <Button size="small" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>
          Next <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
