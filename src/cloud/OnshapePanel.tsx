/* Onshape bağlayıcısı (bulut-bulut): anahtar girişi, bağlantı durumu ve görev ekranından gönderme. */
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { api } from './api';

export interface OnshapeLink {
  connected: boolean;
  configured?: boolean;
  name?: string | null;
  base_url?: string;
  default_document?: { id: string; workspace_id: string } | null;
}
interface OnshapeDoc { id: string; name: string; default_workspace_id: string | null; modified_at?: string }

const ONSHAPE_KEYS_URL = 'https://cad.onshape.com/user/developer/apiKeys';

/** Bağlantı durumunu yükler; sunucuya ulaşılamazsa "bağlı değil" sayar. */
export function useOnshapeLink() {
  const [link, setLink] = useState<OnshapeLink | null>(null);
  const refresh = useCallback(async () => {
    try { setLink(await api<OnshapeLink>('/v1/onshape/link')); } catch { setLink({ connected: false }); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { link, refresh };
}

/** Ayrıntı penceresinin gövdesi: bağlı değilse anahtar formu, bağlıysa durum ve kaldırma. */
export function OnshapeConnect({ link, onChanged }: { link: OnshapeLink | null; onChanged: () => void }) {
  const [access, setAccess] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api('/v1/onshape/link', { method: 'PUT', json: { access_key: access.trim(), secret_key: secret.trim() } });
      setAccess(''); setSecret(''); onChanged();
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true); setErr(null);
    try { await api('/v1/onshape/link', { method: 'DELETE' }); onChanged(); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };

  if (!link) return <p className="c-muted">Durum yükleniyor…</p>;
  if (link.connected) {
    return (
      <div className="c-stack">
        <p className="c-status"><i className="c-dot on" /><b>Bağlı{link.name ? `: ${link.name}` : ''}</b></p>
        <p className="c-fine">Görev ekranında model kartındaki Gönder → Onshape ile modeli belgene aktarabilirsin. Kredi harcanmaz.</p>
        <div><button type="button" className="c-btn" disabled={busy} onClick={remove}>Bağlantıyı kaldır</button></div>
        {err && <div className="c-error" role="alert">{err}</div>}
      </div>
    );
  }
  if (link.configured === false) {
    return <div className="c-note">Onshape bağlantısı sunucuda henüz yapılandırılmamış. Yönetici ONSHAPE_ENC_KEY değerini tanımlamalı.</div>;
  }
  return (
    <form className="c-stack" onSubmit={save}>
      <ol className="c-howto">
        <li><a href={ONSHAPE_KEYS_URL} target="_blank" rel="noopener noreferrer" className="c-link">Onshape API anahtarları sayfasını aç<ExternalLink aria-hidden="true" /></a> (Hesabım → Geliştirici → API anahtarları)</li>
        <li>"Yeni anahtar oluştur"a bas; okuma ve yazma izinlerini işaretle.</li>
        <li>Erişim anahtarını ve gizli anahtarı aşağıya yapıştır (gizli anahtar yalnız bir kez gösterilir).</li>
      </ol>
      <label className="c-field">Erişim anahtarı
        <input value={access} name="onshape-access" onChange={(e) => setAccess(e.target.value)} autoComplete="off" spellCheck={false} required />
      </label>
      <label className="c-field">Gizli anahtar
        <input type="password" name="onshape-secret" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" spellCheck={false} required />
      </label>
      <p className="c-fine">Gizli anahtar sunucuda şifreli saklanır ve bir daha gösterilmez.</p>
      <div><button className="c-btn primary" disabled={busy || !access.trim() || !secret.trim()}>{busy ? 'Doğrulanıyor…' : 'Bağla'}</button></div>
      {err && <div className="c-error" role="alert">{err}</div>}
    </form>
  );
}

const NEW_DOC = '__new__';

/** Model kartındaki Onshape satırı: var olan belge ya da yeni belge. */
export function OnshapeSend({ messageId, link }: { messageId: string; link: OnshapeLink }) {
  const last = link.default_document;
  const [docs, setDocs] = useState<OnshapeDoc[] | null>(null);
  const [pick, setPick] = useState(NEW_DOC);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  // Satır açılınca belge listesini bir kez getir.
  useEffect(() => {
    let live = true;
    api<OnshapeDoc[]>('/v1/onshape/documents').then((d) => { if (live) setDocs(d); }).catch((e) => { if (live) setNote((e as Error).message); });
    return () => { live = false; };
  }, []);

  const send = async () => {
    setBusy(true); setNote("Onshape'a gönderiliyor…"); setUrl(null);
    try {
      let json: Record<string, string> = {};
      if (pick !== NEW_DOC) {
        const [document_id, workspace_id] = pick.split('|');
        json = { document_id, ...(workspace_id ? { workspace_id } : {}) };
      }
      const r = await api<{ document_url: string }>(`/v1/messages/${messageId}/send-onshape`, { method: 'POST', json });
      setUrl(r.document_url);
      setNote('Gönderildi. Onshape modeli çevirirken birkaç saniye sürebilir.');
    } catch (e) { setNote((e as Error).message); }
    setBusy(false);
  };

  return (
    <div className="c-os-send">
      <div className="c-os-send-row">
        <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Onshape belgesi">
          <option value={NEW_DOC}>Yeni belge</option>
          {last && !docs?.some((d) => d.id === last.id) && <option value={`${last.id}|${last.workspace_id}`}>Son kullanılan belge</option>}
          {(docs ?? []).map((d) => <option key={d.id} value={`${d.id}|${d.default_workspace_id ?? ''}`}>{d.name}</option>)}
        </select>
        <button type="button" className="c-btn sm primary" disabled={busy} onClick={send}>Onshape'a gönder</button>
      </div>
      {note && <span className="c-os-note" role="status">{note}{url && <> <a href={url} target="_blank" rel="noopener noreferrer">Onshape'ta aç</a></>}</span>}
    </div>
  );
}
