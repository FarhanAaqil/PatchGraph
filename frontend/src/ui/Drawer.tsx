import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Side panel dialog. Closes on Escape or a click outside, traps keyboard focus inside while open and
 * hands focus back to whatever opened it, so keyboard and screen-reader users never get lost.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]');
    if (first) first.focus();
    else node?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      opener.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Details'}
        tabIndex={-1}
        data-testid={testId}
      >
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p style={{ color: 'var(--text-2)', marginTop: 4 }}>{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            aria-label="Close panel"
            onClick={onClose}
            data-autofocus
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  );
}
