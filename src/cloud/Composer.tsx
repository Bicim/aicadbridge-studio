/* Yazma kutusu: ana sayfa ve görev ekranı ortak. Enter gönderir, Shift+Enter yeni satır; kutu içerikle büyür. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { loadByok, type Me } from './api';

export function Composer({ onSend, busy, onStop, me, placeholder, label, initial = '' }: {
  onSend: (text: string) => void; busy: boolean; onStop?: () => void; me: Me | null;
  placeholder: string; label: string; initial?: string;
}) {
  const [text, setText] = useState(initial);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setText(initial); if (initial) ta.current?.focus(); }, [initial]);
  // Yüksekliği içeriğe uydur (CSS max-height'a kadar).
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  // BYOK ayarı bu bileşen açıkken değişmez; her tuşta localStorage okumamak için bir kez oku.
  const byok = useMemo(loadByok, []);
  const model = byok.enabled && byok.api_key ? `${byok.model} · kendi anahtarın`
    : me?.llm.provider === 'mock' ? 'demo modeli (çevrimdışı)' : me?.llm.model ?? '';
  const send = () => { const t = text.trim(); if (!t || busy) return; onSend(t); setText(''); };
  return (
    <div className="c-composer">
      <textarea ref={ta} rows={2} value={text} name="prompt" aria-label={label} placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
      <div className="c-composer-bar">
        <span className="c-composer-model" title={model}>{model}</span>
        <span className="c-composer-hint">Enter gönderir · Shift+Enter satır</span>
        {busy && onStop
          ? <button type="button" className="c-send stop" onClick={onStop} aria-label="Durdur" title="Durdur"><Square fill="currentColor" /></button>
          : <button type="button" className="c-send" onClick={send} disabled={!text.trim() || busy} aria-label="Gönder" title="Gönder (Enter)"><ArrowUp /></button>}
      </div>
    </div>
  );
}
