/* ============================================================
   App.tsx - ana düzen ve üretim akışı orkestrasyonu
   Sol: sohbet + plan + kod + doğrulama. Sağ: 3D görüntüleyici
   ve parametrik kaydırıcılar. Üst: ayarlar ve dışa aktarma.
   ============================================================ */

import { useCallback, useMemo, useRef, useState } from 'react';
import { runPipeline } from './ai/pipeline';
import { executeIR } from './core/executor';
import { buildSliders, clampValue, defaultValues, type SliderSpec } from './core/parameters';
import { exportIR, exportSTL, exportGLTF } from './core/export';
import type { ExecutedPart, ModelIR, Plan } from './core/types';
import type { VerificationReport } from './core/verify';
import { useSettings } from './state';
import { Viewer } from './ui/Viewer';
import { Sliders } from './ui/Sliders';
import { SettingsDialog } from './ui/SettingsDialog';

interface ChatEntry {
  id: number;
  role: 'user' | 'assistant' | 'status';
  text: string;
  ok?: boolean;
}

const EXAMPLES = [
  '50mm çapında, 80mm yüksekliğinde, merkezinde 20mm delik olan silindir',
  '100mm çapında flanş, çevresinde 4 adet M6 cıvata deliği',
  'İçi boş dikdörtgen kutu, duvar kalınlığı 3mm, kapağı açık'
];

let nextId = 1;

export function App() {
  const { settings, update } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [showPlan, setShowPlan] = useState(true);
  const [showCode, setShowCode] = useState(false);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [ir, setIr] = useState<ModelIR | null>(null);
  const [verification, setVerification] = useState<VerificationReport | null>(null);
  const [parts, setParts] = useState<ExecutedPart[]>([]);
  const [frameKey, setFrameKey] = useState('');
  const [sliderSpecs, setSliderSpecs] = useState<SliderSpec[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, number>>({});
  const irRef = useRef<ModelIR | null>(null);

  const push = useCallback((entry: Omit<ChatEntry, 'id'>) => {
    setMessages((prev) => [...prev, { ...entry, id: nextId++ }]);
  }, []);

  const applyModel = useCallback((nextIr: ModelIR, nextPlan: Plan | null, verify: VerificationReport | null) => {
    irRef.current = nextIr;
    setIr(nextIr);
    setPlan(nextPlan);
    setVerification(verify);
    const specs = buildSliders(nextIr);
    setSliderSpecs(specs);
    const values = defaultValues(nextIr);
    setParamValues(values);
    try {
      const result = executeIR(nextIr, { overrides: values });
      setParts(result.parts);
      setFrameKey(nextIr.name + '|' + Date.now());
      return result;
    } catch (e) {
      push({ role: 'status', text: 'Model kurulamadı: ' + (e as Error).message, ok: false });
      return null;
    }
  }, [push]);

  const send = useCallback(async (prompt: string) => {
    const text = prompt.trim();
    if (!text || running) return;
    if (!settings.apiKey && settings.provider !== 'custom') {
      setSettingsOpen(true);
      push({ role: 'status', text: 'Önce ayarları doldur: sağlayıcı, API anahtarı ve model.', ok: false });
      return;
    }
    setInput('');
    push({ role: 'user', text });
    setRunning(true);
    try {
      const result = await runPipeline(settings, text, (_stage, message, ok) => {
        push({ role: 'status', text: message, ok });
      });
      const applied = applyModel(result.ir, result.plan, result.verification);
      push({
        role: 'assistant',
        text: result.verification.ok
          ? `"${result.plan.name}" hazır. ${result.verification.summary}`
          : `"${result.plan.name}" uyarılarla tamamlandı. ${result.verification.summary}`,
        ok: result.verification.ok
      });
      if (!result.verification.ok && applied) {
        for (const issue of result.verification.issues) {
          push({ role: 'status', text: '⚠ ' + issue, ok: false });
        }
      }
    } catch (e) {
      push({ role: 'status', text: 'Hata: ' + (e as Error).message, ok: false });
    } finally {
      setRunning(false);
    }
  }, [running, settings, push, applyModel]);

  const handleSlider = useCallback((name: string, rawValue: number) => {
    const spec = sliderSpecs.find((s) => s.name === name);
    if (!spec || !irRef.current) return;
    const value = clampValue(spec, rawValue);
    setParamValues((prev) => {
      const next = { ...prev, [name]: value };
      try {
        const result = executeIR(irRef.current!, { overrides: next });
        setParts(result.parts);
      } catch {
        // Geçersiz ara değer: modeli olduğu gibi bırak
      }
      return next;
    });
  }, [sliderSpecs]);

  const resetSliders = useCallback(() => {
    if (!irRef.current) return;
    const values = defaultValues(irRef.current);
    setParamValues(values);
    try {
      const result = executeIR(irRef.current, { overrides: values });
      setParts(result.parts);
    } catch { /* yok */ }
  }, []);

  const hasModel = parts.length > 0 && ir !== null;
  const ready = settings.apiKey !== '' && settings.model !== '';

  const statsLine = useMemo(() => verification?.summary ?? null, [verification]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#141412" />
            <circle cx="16" cy="16" r="9" fill="none" stroke="#00b8d4" strokeWidth="2.6" />
            <circle cx="16" cy="16" r="3" fill="#00b8d4" />
          </svg>
          <span className="brand__name">AICADBridge <b>Web Studio</b></span>
        </div>
        <div className="topbar__right">
          {hasModel ? (
            <>
              <button className="btn btn--ghost btn--sm" onClick={() => exportSTL(parts, ir.name || 'model')}>STL</button>
              <button className="btn btn--ghost btn--sm" onClick={() => exportGLTF(parts, ir.name || 'model')}>GLTF</button>
              <button className="btn btn--ghost btn--sm" onClick={() => exportIR(ir)}>JSON</button>
            </>
          ) : null}
          <button
            className={'btn btn--sm ' + (ready ? 'btn--ghost' : 'btn--primary')}
            onClick={() => setSettingsOpen(true)}
          >
            {ready ? `⚙ ${settings.model}` : '⚙ Ayarlar'}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="chat">
          <div className="chat__scroll">
            {messages.length === 0 ? (
              <div className="chat__empty">
                <p className="chat__hint">Fusion 360 eklentisinin web kardeşi. Bir cümle yaz; plan yapıp geometriyi burada kurar.</p>
                <div className="chat__examples">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} className="example-chip" onClick={() => send(ex)} disabled={running}>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={'msg msg--' + m.role + (m.ok === false ? ' msg--bad' : '')}>
                  {m.role === 'user' ? <span className="msg__who">sen</span> : null}
                  <div className="msg__text">{m.text}</div>
                </div>
              ))
            )}
            {running ? (
              <div className="msg msg--status">
                <span className="spinner" aria-hidden="true" /> çalışıyor...
              </div>
            ) : null}
          </div>

          {plan ? (
            <div className="meta-panel">
              <button className="meta-panel__toggle" onClick={() => setShowPlan((v) => !v)}>
                {showPlan ? '▾' : '▸'} Plan · {plan.steps.length} adım
              </button>
              {showPlan ? (
                <ol className="plan-steps">
                  {plan.steps.map((s, i) => (
                    <li key={i}><b>{s.feature}</b> · {s.description}</li>
                  ))}
                </ol>
              ) : null}
              <button className="meta-panel__toggle" onClick={() => setShowCode((v) => !v)}>
                {showCode ? '▾' : '▸'} ModelIR (kod)
              </button>
              {showCode && ir ? (
                <pre className="code-block">{JSON.stringify(ir, null, 2)}</pre>
              ) : null}
            </div>
          ) : null}

          <form
            className="chat__input"
            onSubmit={(e) => { e.preventDefault(); send(input); }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Bir şey yaptır... örn: 60mm küp, üstünde 8mm delik"
              rows={2}
              disabled={running}
            />
            <button className="btn btn--primary" type="submit" disabled={running || !input.trim()}>
              Üret
            </button>
          </form>
        </aside>

        <main className="stage">
          <Viewer parts={parts} frameKey={frameKey} />
          {!hasModel ? (
            <div className="stage__hint">
              <span>3B önizleme</span>
              <small>model üretilince burada görünür</small>
            </div>
          ) : null}
          {statsLine ? <div className="stage__stats">{statsLine}</div> : null}
          <Sliders
            specs={sliderSpecs}
            values={paramValues}
            onChange={handleSlider}
            onReset={resetSliders}
          />
        </main>
      </div>

      {settingsOpen ? (
        <SettingsDialog settings={settings} onClose={() => setSettingsOpen(false)} onSave={update} />
      ) : null}
    </div>
  );
}
