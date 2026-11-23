import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

/* İki mod ayrı parçalar halinde, yalnız gerektiğinde yüklenir:
   #/local = hesapsız, tarayıcı içi (BYOK) yerel stüdyo (three + CSG); diğer her şey bulut uygulaması. */
const LocalApp = lazy(() => import('./App').then((m) => ({ default: m.App })));
const CloudApp = lazy(() => import('./cloud/CloudApp').then((m) => ({ default: m.CloudApp })));

const cloudConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
const isLocal = () => !cloudConfigured || window.location.hash.startsWith('#/local');

function Root() {
  const [local, setLocal] = useState(isLocal);
  useEffect(() => {
    const on = () => setLocal(isLocal());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
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
