/* Küçük ortak arayüz parçaları: avatar, sayfa başlığı, boş durum, açılır menü, iskelet. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Me } from './api';

export function Avatar({ me, large = false }: { me: Me | null; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  const cls = `c-avatar${large ? ' lg' : ''}`;
  if (me?.avatar_url && !broken) {
    return <img className={cls} src={me.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className={cls} aria-hidden="true">{(me?.name || me?.email || '?').slice(0, 2).toUpperCase()}</span>;
}

export const displayName = (me: Me | null) => me?.name || me?.email?.split('@')[0] || '';
export const PLAN_LABEL: Record<Me['plan'], string> = { free: 'Ücretsiz', pro: 'Pro', team: 'Takım' };

export function PageHeader({ title, desc, actions }: { title: ReactNode; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="c-page-head">
      <div>
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {actions}
    </header>
  );
}

/** Boş durum: tek cümle + tek eylem. */
export function Empty({ icon, text, action }: { icon?: ReactNode; text: ReactNode; action?: ReactNode }) {
  return (
    <div className="c-empty">
      {icon && <span className="c-empty-icon" aria-hidden="true">{icon}</span>}
      <p>{text}</p>
      {action}
    </div>
  );
}

/** Tembel yüklenen sayfanın yeri tutucusu (düzen zıplamasın). */
export function PageSkeleton() {
  return <div className="c-skel" aria-busy="true" aria-label="Yükleniyor"><span /><span /><span /></div>;
}

/**
 * Erişilebilir açılır menü: düğme + role=menu. Ok tuşları, Home/End, Esc ve dışarı tıklama;
 * altta yer yoksa yukarı açılır. Öğeler `.c-menu-item` + role="menuitem" taşır; seçilince menü kapanır.
 */
export function Menu({ trigger, label, children, align = 'end', className = 'c-btn', onOpen }: {
  trigger: ReactNode; label?: string; children: ReactNode; align?: 'start' | 'end'; className?: string; onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]:not([aria-disabled=true])') ?? []);
  const close = useCallback((focusButton = true) => { setOpen(false); if (focusButton) btn.current?.focus(); }, []);

  useLayoutEffect(() => {
    if (!open || !menu.current || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const h = menu.current.offsetHeight;
    const below = window.innerHeight - r.bottom;
    setUp(below < h + 16 && r.top > below);
    items()[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) close(false); };
    const onNav = () => close(false);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('hashchange', onNav);
    return () => { document.removeEventListener('pointerdown', onDown); window.removeEventListener('hashchange', onNav); };
  }, [open, close]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus(); }
  };

  return (
    <div className="c-menu-wrap" ref={wrap} onKeyDown={onKey}>
      <button ref={btn} type="button" className={className} aria-haspopup="menu" aria-expanded={open} aria-label={label}
        onClick={() => { if (!open) onOpen?.(); setOpen(!open); }}>
        {trigger}
      </button>
      {open && (
        <div ref={menu} role="menu" className={`c-menu ${align}${up ? ' up' : ''}`}
          onClick={(e) => { if ((e.target as HTMLElement).closest('[role=menuitem]')) close(false); }}>
          {children}
        </div>
      )}
    </div>
  );
}
