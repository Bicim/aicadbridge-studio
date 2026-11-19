import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { cloudConfigured } from './cloud/api';
import { CloudApp } from './cloud/CloudApp';
import './styles.css';

/* #/local = hesapsız, tarayıcı içi (BYOK) eski stüdyo. Diğer her şey bulut uygulaması. */
function Root() {
  const isLocal = () => window.location.hash.startsWith('#/local');
  const [local, setLocal] = useState(isLocal() || !cloudConfigured);
  useEffect(() => {
    const on = () => setLocal(isLocal() || !cloudConfigured);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return local ? <App /> : <CloudApp />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
