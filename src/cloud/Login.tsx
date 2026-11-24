/* Giriş / kayıt: Google, e-posta + şifre, şifresiz bağlantı. Eşleştirme kodu girişten önce saklanır. */
import { useEffect, useState } from 'react';
import { auth, authProviders } from './api';
import { BrandMark } from '../BrandMark';

export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? 'http://localhost:8124').replace(/\/$/, '');

/* Eşleştirme kodu: OAuth / e-posta bağlantısı hash'i düşürür, bu yüzden girişten önce sessionStorage'da saklanır. */
const PENDING_CODE_KEY = 'aicad.pendingCode';
const stashPendingCode = () => {
  try {
    const m = window.location.hash.match(/^#\/connect\?(.*)$/);
    const c = m ? new URLSearchParams(m[1]).get('code') : null;
    if (c) sessionStorage.setItem(PENDING_CODE_KEY, c);
  } catch { /* depolama kapalı olabilir */ }
};
export const takePendingCode = (): string | null => {
  try { const c = sessionStorage.getItem(PENDING_CODE_KEY); if (c) sessionStorage.removeItem(PENDING_CODE_KEY); return c; } catch { return null; }
};

/** Google "G" işareti (Google ile oturum açma düğmesi yönergesindeki standart renkli işaret). */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const redirect = window.location.origin + window.location.pathname;
  const [providers, setProviders] = useState<{ google: boolean; email: boolean } | null>(null);
  useEffect(() => { authProviders().then(setProviders); stashPendingCode(); }, []);
  const googleOff = providers !== null && !providers.google;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = mode === 'in'
      ? await auth!.signInWithPassword({ email, password: pw })
      : await auth!.signUp({ email, password: pw, options: { emailRedirectTo: redirect } });
    setBusy(false);
    if (r.error) setMsg(r.error.message);
    else if (mode === 'up' && !r.data.session) setMsg('Doğrulama bağlantısı e-postana gönderildi.');
  };
  const magic = async () => {
    if (!email) { setMsg('Önce e-posta adresini yaz.'); return; }
    const r = await auth!.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    setMsg(r.error ? r.error.message : 'Giriş bağlantısı e-postana gönderildi.');
  };
  const google = async () => {
    const r = await auth!.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } });
    if (r.error) setMsg('Google girişi bu sunucuda henüz açık değil: ' + r.error.message);
  };

  return (
    <main className="c-login">
      <div className="c-login-inner">
        <a className="c-brand" href={SITE_URL}><BrandMark size={26} />AICADBridge</a>
        <section className="c-login-card" aria-labelledby="login-title">
          <h1 id="login-title">{mode === 'in' ? 'Hesabına giriş yap' : 'Hesap oluştur'}</h1>
          <p className="c-sub">{mode === 'in' ? 'Tasarımlarına kaldığın yerden devam et.' : 'Ücretsiz planla başla, kart gerekmez.'}</p>
          <button type="button" className="c-btn lg block" onClick={google} disabled={googleOff}><GoogleG />Google ile devam et</button>
          {googleOff && <p className="c-fine">Google girişi bu sunucuda henüz yapılandırılıyor.</p>}
          <div className="c-or"><span>veya</span></div>
          <form onSubmit={submit}>
            <label className="c-field" htmlFor="login-email">E-posta
              <input type="email" name="email" id="login-email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <label className="c-field" htmlFor="login-password">Şifre
              <input type="password" name="password" id="login-password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
            </label>
            <button className="c-btn primary lg block" disabled={busy}>{busy && <span className="c-spin" />}{mode === 'in' ? 'Giriş yap' : 'Kaydol'}</button>
          </form>
          {mode === 'in' && <button type="button" className="c-link c-magic" onClick={magic}>Şifresiz giriş bağlantısı gönder</button>}
          {msg && <div className="c-note" role="status">{msg}</div>}
          <p className="c-switch">
            {mode === 'in' ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
            <button type="button" className="c-link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }}>{mode === 'in' ? 'Kaydol' : 'Giriş yap'}</button>
          </p>
        </section>
        <p className="c-fine c-login-foot">
          Devam ederek <a href={SITE_URL + '/#sss'}>kullanım koşullarını</a> kabul edersin. · <a href="#/local">Hesapsız yerel mod</a>
        </p>
      </div>
    </main>
  );
}
