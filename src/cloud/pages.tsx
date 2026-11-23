/* Hafif hesap sayfaları (Görevler, Projeler, Dosyalar, Plan, Takım, Ayarlar): tek parça halinde, ilk ziyarette yüklenir. */
import { useCallback, useEffect, useState } from 'react';
import { api, auth, loadByok, saveByok, type AuditRow, type ByokSettings, type FileRow, type Me, type Plan, type Project, type Task, type Team } from './api';
import { Avatar } from './ui';

export function TaskList({ tasks, projects, onChanged }: { tasks: Task[]; projects: Project[]; onChanged: () => void }) {
  const [q, setQ] = useState('');
  const shown = tasks.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));
  const pname = (id: string | null) => projects.find((p) => p.id === id)?.name;
  return (
    <div className="c-page">
      <h1>Görevler</h1>
      <input className="c-search" placeholder="Görevlerde ara…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <ul className="c-list">
        {shown.map((t) => (
          <li key={t.id}>
            <a href={`#/t/${t.id}`}>{t.title}</a>
            {t.mine === false && <span className="c-host">ORTAK</span>}
            <span className="c-dim c-mono">{pname(t.project_id) ? `${pname(t.project_id)} · ` : ''}{new Date(t.updated_at).toLocaleString('tr-TR')}</span>
            {t.mine !== false && <>
              <select value={t.project_id ?? ''} onChange={async (e) => { await api(`/v1/tasks/${t.id}`, { method: 'PATCH', json: { project_id: e.target.value || null } }); onChanged(); }} aria-label="Proje">
                <option value="">Projesiz</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.team_id ? '⧉ ' : ''}{p.name}</option>)}
              </select>
              <button className="c-x" title="Sil" onClick={async () => { if (confirm(`"${t.title}" silinsin mi?`)) { await api(`/v1/tasks/${t.id}`, { method: 'DELETE' }); onChanged(); } }}>×</button>
            </>}
          </li>
        ))}
        {!shown.length && <li className="c-dim">Görev yok.</li>}
      </ul>
    </div>
  );
}

export function Projects({ projects, tasks, me, onChanged }: { projects: Project[]; tasks: Task[]; me: Me | null; onChanged: () => void }) {
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="c-page">
      <h1>Projeler</h1>
      <form className="c-inline" onSubmit={async (e) => {
        e.preventDefault(); if (!name.trim()) return; setErr(null);
        try { await api('/v1/projects', { method: 'POST', json: { name, shared } }); setName(''); onChanged(); } catch (x) { setErr((x as Error).message); }
      }}>
        <input placeholder="Yeni proje adı" value={name} onChange={(e) => setName(e.target.value)} />
        {me?.team && <label className="c-check"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> {me.team.name} ile paylaş</label>}
        <button className="c-btn primary">Oluştur</button>
      </form>
      {err && <div className="c-error">{err}</div>}
      {projects.map((p) => {
        const ts = tasks.filter((t) => t.project_id === p.id);
        return (
          <section key={p.id} className="c-proj">
            <h3>{p.name} {p.team_id && <span className="c-host">ORTAK</span>} <span className="c-dim c-mono">{ts.length} görev</span>
              {p.user_id === me?.id && <button className="c-x" title="Projeyi sil" onClick={async () => { if (confirm('Proje silinsin mi? Görevler silinmez.')) { await api(`/v1/projects/${p.id}`, { method: 'DELETE' }); onChanged(); } }}>×</button>}</h3>
            <ul className="c-list">{ts.map((t) => <li key={t.id}><a href={`#/t/${t.id}`}>{t.title}</a></li>)}</ul>
          </section>
        );
      })}
      {!projects.length && <p className="c-dim">Görevlerini gruplamak için bir proje oluştur. Görevler sayfasından projeye atayabilirsin.</p>}
    </div>
  );
}

export function Files() {
  const [rows, setRows] = useState<FileRow[] | null>(null);
  useEffect(() => { api<FileRow[]>('/v1/files').then(setRows).catch(() => setRows([])); }, []);
  return (
    <div className="c-page">
      <h1>Dosyalar</h1>
      {!rows ? <p className="c-dim">Yükleniyor…</p> : !rows.length ? <p className="c-dim">Henüz model yok.</p> : (
        <table className="c-table">
          <thead><tr><th>Model</th><th>Görev</th><th>Tarih</th><th>İndir</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.message_id}>
              <td>{r.title}</td><td><a href={`#/t/${r.task_id}`}>{r.task_title}</a></td>
              <td className="c-mono c-dim">{new Date(r.created_at).toLocaleString('tr-TR')}</td>
              <td className="c-dl">{Object.entries(r.files).map(([f, u]) => <a key={f} className="c-chip" href={u} download={`${r.title}.${f}`}>{f.toUpperCase()}</a>)}</td>
            </tr>))}</tbody>
        </table>
      )}
    </div>
  );
}

export function Billing({ me, query }: { me: Me | null; query: URLSearchParams }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [msg, setMsg] = useState<string | null>(query.get('ok') ? 'Ödeme alındı, planın birkaç saniye içinde güncellenir.' : null);
  useEffect(() => { api<Plan[]>('/v1/plans', { anon: true }).then(setPlans).catch(() => undefined); }, []);
  const buy = async (plan: string) => {
    try { const r = await api<{ url: string }>('/v1/billing/checkout', { method: 'POST', json: { plan } }); window.location.href = r.url; }
    catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div className="c-page">
      <h1>Plan ve kredi</h1>
      {me && <p>Şu anki plan: <b>{plans.find((p) => p.id === me.plan)?.name ?? me.plan}</b> · <span className="c-mono">{me.credits}</span> kredi ({me.credits_period === 'day' ? 'günlük' : 'aylık'} yenilenir)</p>}
      <p className="c-fine">Her model üretimi ya da düzeltme turu 1 kredi harcar. Parametre kaydırıcılarıyla yeniden kurma ücretsizdir.</p>
      <div className="c-grid3">
        {plans.map((p) => (
          <section key={p.id} className={`c-box plan ${me?.plan === p.id ? 'current' : ''}`}>
            <h3>{p.name}</h3>
            <div className="c-price">${p.price_usd}<span className="c-dim">/{p.period}</span></div>
            <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
            {me?.plan === p.id ? <span className="c-chip">Mevcut plan</span>
              : p.id !== 'free' && <button className="c-btn primary" onClick={() => buy(p.id)}>{p.name}'ya geç</button>}
          </section>
        ))}
      </div>
      {msg && <div className="c-note">{msg}</div>}
    </div>
  );
}

const ACTIONS: Record<string, string> = {
  'team.create': 'takımı kurdu', 'team.invite': 'davet etti', 'team.join': 'takıma katıldı', 'team.remove': 'üyeyi çıkardı',
  'team.leave': 'takımdan ayrıldı', 'project.create': 'proje oluşturdu', 'project.delete': 'projeyi sildi',
  'task.create': 'görev oluşturdu', 'task.delete': 'görevi sildi', 'task.move': 'görevi taşıdı', 'model.generate': 'model üretti',
  'model.send': 'modeli programa gönderdi', 'device.connect': 'eklenti bağladı', 'device.revoke': 'eklentiyi kaldırdı',
};

export function TeamPage({ me, refreshMe, onChanged }: { me: Me | null; refreshMe: () => void; onChanged: () => void }) {
  const [team, setTeam] = useState<Team | null | undefined>(undefined);
  const [log, setLog] = useState<AuditRow[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const t = await api<Team | null>('/v1/team');
    setTeam(t);
    if (t?.role === 'owner') setLog(await api<AuditRow[]>('/v1/team/audit?limit=100'));
  }, []);
  useEffect(() => { load().catch((e) => setMsg((e as Error).message)); }, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try { await fn(); await load(); refreshMe(); onChanged(); } catch (e) { setMsg((e as Error).message); }
  };

  if (team === undefined) return <div className="c-page"><h1>Takım</h1><p className="c-dim">Yükleniyor…</p></div>;
  if (!team) return (
    <div className="c-page">
      <h1>Takım</h1>
      <p className="c-dim">Takım kurunca üyelerinle ortak projeler açabilir, birbirinizin modellerini görüp düzenleyebilir ve kim ne yaptı denetim kaydından izleyebilirsin. Her üye kendi kredisini kullanır.</p>
      {me?.plan === 'team' ? (
        <form className="c-inline" onSubmit={(e) => { e.preventDefault(); if (name.trim()) act(() => api('/v1/team', { method: 'POST', json: { name } })); }}>
          <input placeholder="Takım adı" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="c-btn primary">Takımı kur</button>
        </form>
      ) : <p>Takım kurmak <a href="#/billing">Takım planı</a> gerektirir. Bir takıma davet edildiysen, davet edilen e-postayla giriş yapman yeterli.</p>}
      {msg && <div className="c-error">{msg}</div>}
    </div>
  );

  const owner = team.role === 'owner';
  return (
    <div className="c-page">
      <h1>{team.name} <span className="c-host">{owner ? 'SAHİP' : 'ÜYE'}</span></h1>
      {owner && (
        <form className="c-inline" onSubmit={(e) => { e.preventDefault(); if (email.trim()) act(async () => { await api('/v1/team/invite', { method: 'POST', json: { email } }); setEmail(''); }); }}>
          <input type="email" placeholder="ekip.arkadasi@firma.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="c-btn primary">Davet et</button>
        </form>
      )}
      {msg && <div className="c-error">{msg}</div>}
      <section className="c-box">
        <h3>Üyeler ({team.members.length})</h3>
        <ul className="c-list">
          {team.members.map((m) => (
            <li key={m.user_id}>
              <span>{m.name || m.email}</span>
              <span className="c-dim c-mono">{m.role === 'owner' ? 'sahip' : 'üye'} · {new Date(m.joined_at).toLocaleDateString('tr-TR')}</span>
              {owner && m.role !== 'owner' && <button className="c-x" title="Takımdan çıkar" onClick={() => confirm(`${m.email} çıkarılsın mı?`) && act(() => api(`/v1/team/members/${m.user_id}`, { method: 'DELETE' }))}>×</button>}
            </li>
          ))}
          {team.invites.map((i) => (
            <li key={i.email}>
              <span>{i.email}</span><span className="c-dim c-mono">davet bekliyor</span>
              <button className="c-x" title="Daveti iptal et" onClick={() => act(() => api(`/v1/team/invites/${encodeURIComponent(i.email)}`, { method: 'DELETE' }))}>×</button>
            </li>
          ))}
        </ul>
        {!owner && <button className="c-btn" onClick={() => confirm('Takımdan ayrılmak istiyor musun?') && act(() => api('/v1/team/leave', { method: 'POST' }))}>Takımdan ayrıl</button>}
      </section>
      {owner && (
        <section className="c-box">
          <h3>Denetim kaydı</h3>
          <table className="c-table">
            <thead><tr><th>Zaman</th><th>Kim</th><th>İşlem</th></tr></thead>
            <tbody>{log.map((r) => (
              <tr key={r.id}>
                <td className="c-mono c-dim">{new Date(r.created_at).toLocaleString('tr-TR')}</td>
                <td>{r.email ?? '–'}</td>
                <td>{ACTIONS[r.action] ?? r.action}{r.meta && typeof r.meta.name === 'string' ? `: ${r.meta.name}` : ''}{r.meta && typeof r.meta.host === 'string' ? ` (${r.meta.host})` : ''}</td>
              </tr>))}
              {!log.length && <tr><td colSpan={3} className="c-dim">Kayıt yok.</td></tr>}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export function Settings({ me }: { me: Me | null }) {
  const [s, setS] = useState<ByokSettings>(loadByok);
  const [saved, setSaved] = useState(false);
  const set = (p: Partial<ByokSettings>) => { setS({ ...s, ...p }); setSaved(false); };
  return (
    <div className="c-page">
      <h1>Ayarlar</h1>
      <section className="c-box">
        <h3>Model</h3>
        <p className="c-dim">Varsayılan: <span className="c-mono">{me?.llm.model}</span> (sunucu, kredi harcar).</p>
        <label className="c-check"><input type="checkbox" checked={s.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Kendi API anahtarımı kullan (Pro/Takım, kredi harcamaz)</label>
        <div className="c-form">
          <label>Sağlayıcı<select value={s.provider} onChange={(e) => set({ provider: e.target.value })}>
            <option value="anthropic">Anthropic</option><option value="openai">OpenAI</option><option value="google">Google Gemini</option>
            <option value="openrouter">OpenRouter</option><option value="custom">OpenAI uyumlu (özel URL)</option></select></label>
          <label>Model<input className="c-mono" value={s.model} onChange={(e) => set({ model: e.target.value })} /></label>
          <label>API anahtarı<input type="password" className="c-mono" value={s.api_key} onChange={(e) => set({ api_key: e.target.value })} placeholder="yalnızca bu tarayıcıda saklanır" /></label>
          {s.provider === 'custom' && <label>Base URL<input className="c-mono" value={s.base_url} onChange={(e) => set({ base_url: e.target.value })} /></label>}
        </div>
        <button className="c-btn primary" onClick={() => { saveByok(s); setSaved(true); }}>Kaydet</button> {saved && <span className="c-dim">Kaydedildi</span>}
      </section>
      <section className="c-box">
        <h3>Hesap</h3>
        <div className="c-profile">
          <Avatar me={me} />
          <div>
            <b>{me?.name || me?.email?.split('@')[0]}</b>
            <p className="c-dim">{me?.email}</p>
            <p className="c-fine">Giriş yöntemi: {me?.provider === 'google' ? 'Google' : me?.provider === 'email' ? 'E-posta' : me?.provider ?? '-'} · Plan: {me?.plan === 'free' ? 'Ücretsiz' : me?.plan === 'pro' ? 'Pro' : 'Takım'}</p>
          </div>
        </div>
        <p className="c-fine">Görevlerin, modellerin ve dosyaların AICADBridge sunucusunda hesabına bağlı saklanır; başka kullanıcılar göremez.</p>
        <button className="c-btn" onClick={() => auth!.signOut()}>Çıkış yap</button>
      </section>
    </div>
  );
}
