import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, FileText, Cpu, Hammer, Leaf, Recycle, Shirt, Star, Wine, X, Zap } from 'lucide-react';
import type { CategoryKey } from '../types';
import { categoryMap } from '../data';

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className={`logo ${light ? 'logo-light' : ''}`}>
      <span className="logo-mark" aria-hidden="true">
        <Recycle size={compact ? 15 : 17} strokeWidth={2.6} />
      </span>
      <span className="logo-text">
        EcoCycle <b>Hub</b>
      </span>
    </span>
  );
}

const categoryIcons = {
  plastic: Recycle,
  paper: FileText,
  glass: Wine,
  metal: Zap,
  organic: Leaf,
  construction: Hammer,
  textile: Shirt,
  electronic: Cpu,
};

export function CategoryIcon({
  category,
  size = 40,
  radius = 12,
  muted = false,
}: {
  category: CategoryKey;
  size?: number;
  radius?: number;
  muted?: boolean;
}) {
  const cat = categoryMap[category];
  const Icon = categoryIcons[category];
  return (
    <span
      className="cat-icon"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: muted ? 'var(--surface-3)' : cat.bg,
        color: muted ? '#7a857c' : cat.color,
      }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={2.1} />
    </span>
  );
}

export function Stars({ count = 5, size = 14 }: { count?: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={size} fill="#F5A623" stroke="#F5A623" />
      ))}
    </span>
  );
}

const ToastContext = createContext<{ show: (message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<{ id: number; text: string }[]>([]);

  const show = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setMessages((m) => [...m, { id, text: message }]);
    window.setTimeout(() => {
      setMessages((m) => m.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {messages.map((m) => (
          <div className="toast" key={m.id}>
            <CheckCircle2 size={18} />
            <span>{m.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

let topModal: HTMLElement | null = null;
let modalLocks = 0;

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
  titleId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  titleId?: string;
}) {
  const autoId = useId();
  const headingId = titleId || `${autoId}-title`;
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousTop = topModal;
    if (node) topModal = node;

    modalLocks += 1;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.offsetParent !== null)
        : [];

    const frame = requestAnimationFrame(() => {
      const first =
        node?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ||
        focusables()[0];
      first?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (topModal !== node) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !node?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !node?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      modalLocks -= 1;
      if (modalLocks === 0) document.body.style.overflow = '';
      if (topModal === node) topModal = previousTop;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={dialogRef}
      >
        <div className="modal-grab" aria-hidden="true" />
        <header className="modal-head">
          <div>
            <h2 id={headingId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
