/* Uygulama kabuğu: daraltılabilir kenar çubuğu (5 ana öğe + son görevler + hesap menüsü); dar ekranda çekmece. */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Blocks, Box, ChevronsUpDown, CreditCard, FolderKanban, LogOut, Menu as MenuIcon, MessagesSquare,
  PanelLeftClose, PanelLeftOpen, Settings, SquarePen, Users,
} from 'lucide-react';
import { BrandMark } from '../BrandMark';
import { auth, type Me, type Task } from './api';
import { Avatar, Menu, PLAN_LABEL, displayName } from './ui';

const NAV = [
  { path: '/', label: 'Yeni görev', Icon: SquarePen },
  { path: '/tasks', label: 'Görevler', Icon: MessagesSquare },
  { path: '/projects', label: 'Projeler', Icon: FolderKanban },
  { path: '/files', label: 'Dosyalar', Icon: Box },
  { path: '/integrations', label: 'Entegrasyonlar', Icon: Blocks },
] as const;

const COLLAPSE_KEY = 'aicad.sidebar.collapsed';
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; } };

export function Shell({ me, tasks, path, children }: { me: Me | null; tasks: Task[]; path: string; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const taskId = path.startsWith('/t/') ? path.slice(3) : null;

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* gizli pencere */ }
  };

  // Çekmece: sayfa değişince kapanır, Esc ile kapanır.
  useEffect(() => { setDrawer(false); }, [path]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  const active = (p: string) => path === p || (p === '/integrations' && path === '/connect');

  return (
    <div className={`c-shell${collapsed ? ' collapsed' : ''}${drawer ? ' drawer' : ''}`}>
      <header className="c-topbar">
        <button type="button" className="c-icon-btn" aria-label="Menüyü aç" aria-expanded={drawer} onClick={() => setDrawer(true)}><MenuIcon /></button>
        <a className="c-brand" href="#/"><BrandMark />AICADBridge</a>
        <a className="c-icon-btn" href="#/" aria-label="Yeni görev"><SquarePen /></a>
      </header>
      <div className="c-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />

      <aside className="c-side" aria-label="Kenar çubuğu">
        <div className="c-side-head">
          <a className="c-brand" href="#/" aria-label="AICADBridge ana sayfa"><BrandMark /><span className="c-label">AICADBridge</span></a>
          <button type="button" className="c-icon-btn c-collapse" onClick={toggle}
            aria-label={collapsed ? 'Kenar çubuğunu genişlet' : 'Kenar çubuğunu daralt'} title={collapsed ? 'Genişlet' : 'Daralt'}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
        </div>

        <nav className="c-nav" aria-label="Ana menü">
          {NAV.map(({ path: p, label, Icon }) => (
            <a key={p} href={`#${p}`} aria-current={active(p) ? 'page' : undefined} title={collapsed ? label : undefined}>
              <Icon aria-hidden="true" /><span className="c-label">{label}</span>
            </a>
          ))}
        </nav>

        {tasks.length > 0 ? (
          <nav className="c-recent" aria-labelledby="c-recent-h">
            <h2 id="c-recent-h">Son görevler</h2>
            {tasks.slice(0, 12).map((t) => (
              <a key={t.id} href={`#/t/${t.id}`} aria-current={taskId === t.id ? 'page' : undefined} title={t.title}>{t.title}</a>
            ))}
          </nav>
        ) : <div className="c-side-spacer" />}

        <div className="c-account">
          <Menu label="Hesap menüsü" align="start" className="c-account-btn"
            trigger={<>
              <Avatar me={me} />
              <span className="c-account-meta">
                <b>{displayName(me) || '…'}</b>
                <small>{me ? `${me.credits} kredi · ${PLAN_LABEL[me.plan]}` : ' '}</small>
              </span>
              <ChevronsUpDown aria-hidden="true" />
            </>}>
            <div className="c-menu-label">{me?.email}</div>
            <a role="menuitem" className="c-menu-item" href="#/settings"><Settings />Ayarlar</a>
            <a role="menuitem" className="c-menu-item" href="#/billing"><CreditCard />Plan ve kredi{me && <span className="c-menu-meta">{me.credits} kredi</span>}</a>
            <a role="menuitem" className="c-menu-item" href="#/team"><Users />Takım</a>
            <div className="c-menu-sep" role="separator" />
            <button type="button" role="menuitem" className="c-menu-item" onClick={() => { void auth!.signOut(); }}><LogOut />Çıkış yap</button>
          </Menu>
        </div>
      </aside>

      <main className="c-main" id="main">{children}</main>
    </div>
  );
}
