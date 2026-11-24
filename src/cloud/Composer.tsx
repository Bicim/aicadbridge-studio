/* Yazma kutusu: ana sayfa ve görev ekranı ortak. Enter gönderir, Shift+Enter yeni satır; model seçimi, görsel, ses (ASR) ve çizim OCR. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowUp, ImagePlus, Mic, ScanText, Square, X } from 'lucide-react';
import { loadByok, loadSelectedModel, ocrDrawing, saveSelectedModel, transcribeAudio, type Me } from './api';
import { toast } from './ui';

export interface SendOptions { model?: string; images?: string[] }

const PROVIDER_LABEL: Record<string, string> = {
  evren: 'EVREN (SSYZ)',
  nvidia: 'NVIDIA NIM',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ''));
    fr.onerror = () => reject(new Error('Dosya okunamadı'));
    fr.readAsDataURL(file);
  });
}

async function readImageDataUrl(file: File, maxDim = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Görsel yüklenemedi'));
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return await fileToDataUrl(file);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    return canvas.toDataURL(outType, 0.88);
  } catch {
    return await fileToDataUrl(file);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function Composer({ onSend, busy, onStop, me, placeholder, label, initial = '' }: {
  onSend: (text: string, opts?: SendOptions) => void; busy: boolean; onStop?: () => void; me: Me | null;
  placeholder: string; label: string; initial?: string;
}) {
  const [text, setText] = useState(initial);
  const [selectedModel, setSelectedModel] = useState(loadSelectedModel);
  const [images, setImages] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [ocring, setOcring] = useState(false);

  const ta = useRef<HTMLTextAreaElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const ocrInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => { setText(initial); if (initial) ta.current?.focus(); }, [initial]);
  useEffect(() => () => {
    try { recorder.current?.stop(); } catch { /* kapalı */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // Yüksekliği içeriğe uydur (CSS max-height'a kadar).
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  // BYOK ayarı bu bileşen açıkken değişmez; her tuşta localStorage okumamak için bir kez oku.
  const byok = useMemo(loadByok, []);
  const byokActive = !!(byok.enabled && byok.api_key);
  const models = me?.llm.models ?? [];
  const activeModel = models.some((m) => m.id === selectedModel) ? selectedModel : (me?.llm.model ?? '');
  const activeMeta = models.find((m) => m.id === activeModel);
  const supportsVision = byokActive || (activeMeta ? activeMeta.vision !== false : me?.llm.features?.vision !== false);
  const modelLabel = byokActive ? `${byok.model} · kendi anahtarın`
    : me?.llm.provider === 'mock' ? 'demo modeli (çevrimdışı)' : activeMeta?.label || activeModel;

  const send = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSend(t, {
      model: byokActive ? undefined : (activeModel || undefined),
      images: supportsVision && images.length ? images : undefined,
    });
    setText('');
    setImages([]);
  };

  const onModelChange = (next: string) => {
    setSelectedModel(next);
    saveSelectedModel(next);
    const meta = models.find((m) => m.id === next);
    if (meta?.vision === false && images.length) {
      setImages([]);
      toast(`${meta.label} görsel desteklemiyor, ekli görseller kaldırıldı.`, 'info');
    }
  };

  const onPickImages = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - images.length);
    e.target.value = '';
    if (!files.length) return;
    try {
      const urls = await Promise.all(files.map((f) => readImageDataUrl(f)));
      setImages((prev) => [...prev, ...urls].slice(0, 4));
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  };

  const onPickOcr = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setOcring(true);
    try {
      const dataUrl = await readImageDataUrl(file);
      const res = await ocrDrawing(dataUrl);
      if (res.text) {
        setText((prev) => (prev ? `${prev.trimEnd()}\n\n${res.text}` : res.text));
        toast('Teknik çizim metni eklendi.');
      } else {
        toast('Çizimde okunabilir metin bulunamadı.', 'warn');
      }
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setOcring(false);
    }
  };

  const toggleVoice = async () => {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast('Bu tarayıcı ses kaydını desteklemiyor.', 'warn');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const chunks: BlobPart[] = [];
      const mr = new MediaRecorder(stream);
      recorder.current = mr;
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (!chunks.length) return;
        const mime = mr.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mime });
        setTranscribing(true);
        try {
          const dataUrl = await fileToDataUrl(blob);
          const b64 = dataUrl.split(',')[1] ?? '';
          const res = await transcribeAudio(b64, mime, 'tr');
          if (res.text) {
            setText((prev) => (prev ? `${prev.trimEnd()} ${res.text}` : res.text));
          } else {
            toast('Ses algılanamadı.', 'warn');
          }
        } catch (err) {
          toast((err as Error).message, 'err');
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      setRecording(true);
    } catch {
      toast('Mikrofon izni alınamadı.', 'err');
    }
  };

  const canMic = !!me?.llm.features?.asr && typeof MediaRecorder !== 'undefined';
  const canOcr = !!me?.llm.features?.ocr;
  const providerGroups = useMemo(() => {
    const groups: { provider: string; items: typeof models }[] = [];
    for (const m of models) {
      const p = m.provider || me?.llm.provider || 'default';
      const existing = groups.find((g) => g.provider === p);
      if (existing) existing.items.push(m);
      else groups.push({ provider: p, items: [m] });
    }
    return groups;
  }, [models, me?.llm.provider]);

  return (
    <div className="c-composer">
      {images.length > 0 && (
        <div className="c-composer-thumbs" aria-label="Ekli görseller">
          {images.map((src, i) => (
            <span key={i} className="c-thumb">
              <img src={src} alt={`Ek ${i + 1}`} />
              <button type="button" aria-label={`Görseli kaldır ${i + 1}`} onClick={() => setImages((all) => all.filter((_, idx) => idx !== i))}><X /></button>
            </span>
          ))}
        </div>
      )}
      <textarea ref={ta} rows={2} value={text} name="prompt" aria-label={label} placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
      <input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={onPickImages} />
      <input ref={ocrInput} type="file" accept="image/*" hidden onChange={onPickOcr} />
      <div className="c-composer-bar">
        {!byokActive && models.length > 1 ? (
          <select className="c-composer-select" name="model" aria-label="Model" value={activeModel} onChange={(e) => onModelChange(e.target.value)}>
            {providerGroups.length > 1
              ? providerGroups.map((g) => (
                <optgroup key={g.provider} label={PROVIDER_LABEL[g.provider] ?? g.provider}>
                  {g.items.map((m) => <option key={m.id} value={m.id}>{m.label}{m.hint ? ` · ${m.hint}` : ''}</option>)}
                </optgroup>
              ))
              : models.map((m) => <option key={m.id} value={m.id}>{m.label}{m.hint ? ` · ${m.hint}` : ''}</option>)}
          </select>
        ) : (
          <span className="c-composer-model" title={modelLabel}>{modelLabel}</span>
        )}
        <div className="c-composer-tools">
          {supportsVision && (
            <button type="button" className="c-icon-btn" disabled={busy || images.length >= 4}
              aria-label="Görsel veya kroki ekle" title="Görsel / kroki ekle (en fazla 4)"
              onClick={() => imgInput.current?.click()}><ImagePlus /></button>
          )}
          {canOcr && (
            <button type="button" className="c-icon-btn" disabled={busy || ocring}
              aria-label="Teknik çizim oku (OCR)" title="Teknik çizim / belge oku (OCR)"
              onClick={() => ocrInput.current?.click()}>{ocring ? <span className="c-spin" /> : <ScanText />}</button>
          )}
          {canMic && (
            <button type="button" className={`c-icon-btn${recording ? ' rec' : ''}`} disabled={busy || transcribing}
              aria-label={recording ? 'Ses kaydını durdur' : 'Sesle tarif et'} title={recording ? 'Kaydı durdur' : 'Sesle tarif et (Türkçe)'}
              onClick={toggleVoice}>{transcribing ? <span className="c-spin" /> : recording ? <Square fill="currentColor" /> : <Mic />}</button>
          )}
        </div>
        <span className="c-composer-hint">Enter gönderir · Shift+Enter satır</span>
        {busy && onStop
          ? <button type="button" className="c-send stop" onClick={onStop} aria-label="Durdur" title="Durdur"><Square fill="currentColor" /></button>
          : <button type="button" className="c-send" onClick={send} disabled={!text.trim() || busy} aria-label="Gönder" title="Gönder (Enter)"><ArrowUp /></button>}
      </div>
    </div>
  );
}
