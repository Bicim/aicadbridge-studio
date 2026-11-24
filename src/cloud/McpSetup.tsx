/* MCP: Claude, Cursor, VS Code gibi yapay zekâ asistanlarından AICADBridge ile modelleme (kişisel API anahtarı). */
import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Trash2 } from 'lucide-react';
import { api, API_URL } from './api';

interface ApiKey { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null; key?: string }

const CLIENTS = ['Claude Code', 'Claude Desktop', 'Cursor', 'VS Code'] as const;
type Client = (typeof CLIENTS)[number];

function mcpConfig(client: Client, url: string, key: string): string {
  switch (client) {
    case 'Claude Code':
      return `claude mcp add --transport http aicadbridge ${url} --header "Authorization: Bearer ${key}"`;
    case 'Claude Desktop':
      return JSON.stringify({ mcpServers: { aicadbridge: { command: 'npx', args: ['-y', 'mcp-remote', url, '--header', `Authorization: Bearer ${key}`] } } }, null, 2);
    case 'Cursor':
      return JSON.stringify({ mcpServers: { aicadbridge: { url, headers: { Authorization: `Bearer ${key}` } } } }, null, 2);
    case 'VS Code':
      return JSON.stringify({ servers: { aicadbridge: { type: 'http', url, headers: { Authorization: `Bearer ${key}` } } } }, null, 2);
  }
}

const WHERE: Record<Client, string> = {
  'Claude Code': 'Terminalde çalıştır. Sonra Claude Code içinde /mcp ile bağlantıyı gör.',
  'Claude Desktop': 'Ayarlar → Geliştirici → Yapılandırmayı düzenle (claude_desktop_config.json) içine ekle, uygulamayı yeniden başlat. Node.js gerekir.',
  Cursor: 'Ayarlar → MCP → Yeni MCP sunucusu ekle (~/.cursor/mcp.json) içine yapıştır.',
  'VS Code': 'Komut paleti → "MCP: Open User Configuration" (mcp.json) içine yapıştır; Copilot Agent modunda araçlar görünür.',
};

export function McpSetup() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [fresh, setFresh] = useState<ApiKey | null>(null);
  const [client, setClient] = useState<Client>('Claude Code');
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = `${API_URL}/mcp`;

  const load = () => api<ApiKey[]>('/v1/api-keys').then(setKeys).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr(null);
    try {
      const k = await api<ApiKey>('/v1/api-keys', { method: 'POST', json: { name: client } });
      setFresh(k); load();
    } catch (e) { setErr((e as Error).message); }
  };
  const revoke = async (id: string) => {
    await api(`/v1/api-keys/${id}`, { method: 'DELETE' });
    if (fresh?.id === id) setFresh(null);
    load();
  };
  const snippet = mcpConfig(client, url, fresh?.key ?? 'aicad_sk_...');
  const copy = async () => {
    try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setErr('Panoya kopyalanamadı; metni seçip elle kopyala.'); }
  };

  return (
    <section className="c-card c-mcp" id="mcp" aria-labelledby="mcp-h">
      <div>
        <h2 id="mcp-h">Yapay zekâ asistanından modelle (MCP)</h2>
        <p className="c-muted c-mcp-lead">
          Claude, Cursor veya VS Code'a "Ø80 flanş çiz ve Fusion'a gönder" de: asistan AICADBridge araçlarıyla modeli kurar,
          ölçüleri doğrular ve bağlı programına aktarır. Kullanım kredin bu hesaptan düşer.
        </p>
      </div>
      <ol className="c-howto">
        <li>Asistanını seç ve <b>anahtar oluştur</b>. Anahtar yalnızca bir kez gösterilir.</li>
        <li>Aşağıdaki yapılandırmayı asistanına ekle.</li>
        <li>Modeli programda açmak için yukarıdan Fusion, Blender veya SolidWorks bağlantısını kur.</li>
      </ol>
      <div className="c-seg" role="tablist" aria-label="Asistan">
        {CLIENTS.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={client === c} onClick={() => setClient(c)}>{c}</button>
        ))}
      </div>
      <p className="c-fine">{WHERE[client]}</p>
      <div className="c-code-wrap">
        <pre className="c-code" role="tabpanel" aria-label={`${client} yapılandırması`}>{snippet}</pre>
        <button type="button" className="c-icon-btn c-code-copy" onClick={copy} disabled={!fresh}
          aria-label={copied ? 'Kopyalandı' : 'Kopyala'} title={fresh ? (copied ? 'Kopyalandı' : 'Kopyala') : 'Önce anahtar oluştur'}>
          {copied ? <Check /> : <Copy />}
        </button>
      </div>
      <div className="c-inline">
        <button type="button" className="c-btn primary" onClick={create}><KeyRound aria-hidden="true" />Anahtar oluştur</button>
        <span className="c-fine c-mono c-mcp-url">{url}</span>
      </div>
      {fresh && <div className="c-note ok" role="status">Yeni anahtar oluşturuldu. Şimdi kopyala; sayfadan çıkınca tekrar gösterilmez.</div>}
      {err && <div className="c-error" role="alert">{err}</div>}
      <div className="c-section">
        <h3 className="c-h3">Etkin anahtarlar</h3>
        <ul className="c-rows c-rows-bordered">
          {keys.map((k) => (
            <li key={k.id} className="c-row">
              <span className="c-row-main">
                <span className="c-row-title">{k.name} <span className="c-mono c-muted">{k.prefix}…</span></span>
                <span className="c-row-sub">{k.last_used_at ? `Son kullanım ${new Date(k.last_used_at).toLocaleString('tr-TR')}` : 'Henüz kullanılmadı'}</span>
              </span>
              <button type="button" className="c-icon-btn danger" aria-label={`${k.name} anahtarını iptal et`} title="Anahtarı iptal et" onClick={() => revoke(k.id)}><Trash2 /></button>
            </li>
          ))}
          {!keys.length && <li className="c-row-empty">Henüz anahtar yok.</li>}
        </ul>
      </div>
      <details className="c-details">
        <summary>Asistanın kullanabildiği araçlar</summary>
        <ul className="c-tools">
          <li><b>generate_model</b>: metinden model üretir (1 kredi, hata olursa iade).</li>
          <li><b>build_plan_ir</b>: asistanın yazdığı Plan IR'ı kurar ve doğrular (1 kredi).</li>
          <li><b>set_parameters</b>: ölçüleri değiştirip yeniden kurar (ücretsiz).</li>
          <li><b>list_connected_apps</b> · <b>send_to_app</b> · <b>get_job_status</b>: modeli CAD programına gönderir.</li>
          <li><b>list_models</b> · <b>get_plan_ir_spec</b>: geçmiş modeller ve model biçimi.</li>
        </ul>
      </details>
    </section>
  );
}
