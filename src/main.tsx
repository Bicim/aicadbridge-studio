import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';

/* İki mod ayrı parçalar halinde, yalnız gerektiğinde yüklenir:
   #/local = hesapsız, tarayıcı içi (BYOK) yerel stüdyo (three + CSG); diğer her şey bulut uygulaması. */
const LocalApp = lazy(() => import('./App').then((m) => ({ default: m.App })));
const CloudApp = lazy(() => import('./cloud/CloudApp').then((m) => ({ default: m.CloudApp })));

const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const cloudConfigured = Boolean(SB_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
const isLocal = () => !cloudConfigured || window.location.hash.startsWith('#/local');

// Bulut parçası inerken oturum sunucusuyla TLS el sıkışmasını önceden başlat.
if (cloudConfigured && !isLocal()) {
  try {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = new URL(SB_URL!).origin;
    link.crossOrigin = '';
    document.head.append(link);
  } catch { /* geçersiz adres: atla */ }
}

function Root() {
  const [local, setLocal] = useState(isLocal);
  useEffect(() => {
    const on = () => setLocal(isLocal());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { if (local) document.title = 'AICADBridge Studio · Yerel mod'; }, [local]);
  return (
    <Suspense fallback={<div className="boot" aria-busy="true"><span className="spinner" /></div>}>
      {local ? <LocalApp /> : <CloudApp />}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
