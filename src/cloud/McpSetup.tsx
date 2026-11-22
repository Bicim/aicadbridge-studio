/* MCP: Claude, Cursor, VS Code gibi yapay zekâ asistanlarından AICADBridge ile modelleme (kişisel API anahtarı). */
import { useEffect, useState } from 'react';
import { api, API_URL } from './api';

interface ApiKey { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null; key?: string }

const CLIENTS = ['Claude Code', 'Claude Desktop', 'Cursor', 'VS Code'] as const;
type Client = (typeof CLIENTS)[number];

export function mcpConfig(client: Client, url: string, key: string): string {
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
  const copy = async () => { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <section className="c-box" id="mcp">
      <h3>Yapay zekâ asistanından modelle (MCP)</h3>
      <p className="c-dim">
        Claude, Cursor veya VS Code'a "Ø80 flanş çiz ve Fusion'a gönder" de: asistan AICADBridge araçlarıyla modeli kurar,
        ölçüleri doğrular ve bağlı programına aktarır. Kullanım kredin bu hesaptan düşer.
      </p>
      <ol className="c-howto">
        <li>Asistanını seç ve <b>anahtar oluştur</b>. Anahtar yalnızca bir kez gösterilir.</li>
        <li>Aşağıdaki yapılandırmayı asistanına ekle.</li>
        <li>Modeli programda açmak için yukarıdan Fusion 360, Blender veya SolidWorks eklentisini bağla.</li>
      </ol>
      <div className="c-tabs" role="tablist">
        {CLIENTS.map((c) => (
          <button key={c} role="tab" aria-selected={client === c} className={client === c ? 'active' : ''} onClick={() => setClient(c)}>{c}</button>
        ))}
      </div>
      <p className="c-fine">{WHERE[client]}</p>
      <pre className="c-code c-mono">{snippet}</pre>
      <div className="c-inline">
        <button className="c-btn primary" onClick={create}>Anahtar oluştur</button>
        <button className="c-btn" onClick={copy} disabled={!fresh}>{copied ? 'Kopyalandı' : 'Kopyala'}</button>
        <span className="c-dim c-mono">{url}</span>
      </div>
      {fresh && <div className="c-note">Yeni anahtar oluşturuldu. Şimdi kopyala; sayfadan çıkınca tekrar gösterilmez.</div>}
      {err && <div className="c-error">{err}</div>}
      <h4>Etkin anahtarlar</h4>
      <ul className="c-list">
        {keys.map((k) => (
          <li key={k.id}>
            <span className="c-mono">{k.prefix}…</span>
            <span>{k.name}</span>
            <span className="c-dim c-mono">{k.last_used_at ? `son kullanım ${new Date(k.last_used_at).toLocaleString('tr-TR')}` : 'henüz kullanılmadı'}</span>
            <button className="c-x" title="Anahtarı iptal et" onClick={() => revoke(k.id)}>×</button>
          </li>
        ))}
        {!keys.length && <li className="c-dim">Anahtar yok.</li>}
      </ul>
      <details>
        <summary>Asistanın kullanabildiği araçlar</summary>
        <ul className="c-fine">
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
