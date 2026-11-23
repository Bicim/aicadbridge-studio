/* Yazma kutusu: ana sayfa ve görev ekranı ortak. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadByok, type Me } from './api';

export function Composer({ onSend, busy, onStop, me, placeholder, initial = '' }: {
  onSend: (text: string) => void; busy: boolean; onStop?: () => void; me: Me | null; placeholder: string; initial?: string;
}) {
  const [text, setText] = useState(initial);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setText(initial); if (initial) ta.current?.focus(); }, [initial]);
  // BYOK ayarı bu bileşen açıkken değişmez; her tuşta localStorage okumamak için bir kez oku.
  const byok = useMemo(loadByok, []);
  const model = byok.enabled && byok.api_key ? `${byok.model} (kendi anahtarın)`
    : me?.llm.provider === 'mock' ? 'demo modeli (çevrimdışı)' : me?.llm.model ?? '';
  const send = () => { const t = text.trim(); if (!t || busy) return; onSend(t); setText(''); };
  return (
    <div className="c-composer">
      <textarea ref={ta} rows={2} value={text} placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
      <div className="c-composer-bar">
        <span className="c-mono c-dim">{model}</span>
        {busy && onStop
          ? <button className="c-send stop" onClick={onStop} aria-label="Durdur">■</button>
          : <button className="c-send" onClick={send} disabled={!text.trim() || busy} aria-label="Gönder">↑</button>}
      </div>
    </div>
  );
}
