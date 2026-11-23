/* AICADBridge Cloud istemcisi: Supabase oturumu + API çağrıları + SSE üretim akışı. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

/** Sign-in methods enabled on the auth server (GoTrue /settings); null when unreachable. */
export async function authProviders(): Promise<{ google: boolean; email: boolean } | null> {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(`${SB_URL.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: SB_KEY } });
    if (!r.ok) return null;
    const j = await r.json();
    return { google: !!j.external?.google, email: !!j.external?.email };
  } catch { return null; }
}

export const supabase: SupabaseClient | null = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;
export const cloudConfigured = !!supabase;

export interface Me {
  id: string; email: string; name?: string; avatar_url?: string | null; provider?: string | null; plan: 'free' | 'pro' | 'team';
  credits: number; credits_period: 'day' | 'month'; credits_reset_at: string;
  billing_enabled: boolean; llm: { provider: string; model: string };
  team: { id: string; name: string; role: 'owner' | 'member' } | null;
}
export interface Task { id: string; title: string; project_id: string | null; created_at: string; updated_at: string; mine?: boolean }
export interface Project { id: string; name: string; created_at: string; team_id?: string | null; user_id?: string }
export interface Team {
  id: string; name: string; role: 'owner' | 'member';
  members: { user_id: string; role: string; email: string; name?: string; joined_at: string }[];
  invites: { email: string; created_at: string }[];
}
export interface AuditRow { id: number; action: string; target: string | null; meta: Record<string, unknown>; email: string | null; created_at: string }
export interface IRParam { name: string; value: number | string; min?: number; max?: number; step?: number; unit?: string; label?: string; group?: string }
export interface IRDoc { meta?: { title?: string }; parameters?: IRParam[]; features: unknown[]; [k: string]: unknown }
export interface BodyReport { name: string; volume?: number; bbox?: { size: number[] }; valid?: boolean }
export interface Report { ok?: boolean; bodies?: BodyReport[]; features?: { id: string; status: string; error?: string }[]; expect?: { passed: boolean; issues: string[] }; parameters?: Record<string, number> }
export interface Msg {
  id: string; task_id: string; parent_id: string | null; role: 'user' | 'assistant';
  content: string; ir: IRDoc | null; report: Report | null; steps: { text: string; detail?: string[] }[];
  files: Record<string, string>; params: Record<string, number> | null; status: 'running' | 'done' | 'error'; created_at: string;
}
export interface Device { id: string; host: 'fusion' | 'blender' | 'solidworks' | 'other'; name: string; last_seen: string | null; created_at: string; online?: boolean }
export interface FileRow { message_id: string; task_id: string; task_title: string; title: string; created_at: string; files: Record<string, string> }
export interface Plan { id: string; name: string; price_usd: number; period: string; credits: number; credits_period: string; features: string[] }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function token(): Promise<string> {
  const { data } = await supabase!.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new ApiError(401, 'Oturum yok');
  return t;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown; anon?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (!init.anon) headers.Authorization = `Bearer ${await token()}`;
  let body = init.body;
  if (init.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(init.json); }
  let r: Response;
  try {
    r = await fetch(API_URL + path, { ...init, headers, body });
  } catch {
    throw new ApiError(0, `Sunucuya ulaşılamıyor (${API_URL})`);
  }
  if (!r.ok) {
    let detail = r.statusText;
    try { const j = await r.json(); detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail); } catch { /* boş gövde */ }
    throw new ApiError(r.status, detail);
  }
  return (r.status === 204 ? undefined : await r.json()) as T;
}

export type GenEvent =
  | { type: 'start'; user_message: Msg; assistant_id: string }
  | { type: 'step'; text: string; detail?: string[] }
  | { type: 'done'; message: Msg; task_title?: string }
  | { type: 'error'; message: string };

export interface LLMOverride { provider: string; model: string; api_key: string; base_url?: string }

export async function generate(taskId: string, body: { prompt: string; parent_id?: string | null; llm?: LLMOverride },
  onEvent: (e: GenEvent) => void, signal?: AbortSignal): Promise<void> {
  const r = await fetch(`${API_URL}/v1/tasks/${taskId}/generate`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) {
    let detail = r.statusText;
    try { detail = (await r.json()).detail ?? detail; } catch { /* yok */ }
    throw new ApiError(r.status, detail);
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data: '));
      if (line) onEvent(JSON.parse(line.slice(6)) as GenEvent);
    }
  }
}

/* BYOK ayarı yalnızca bu tarayıcıda saklanır. */
const BYOK_KEY = 'aicad.byok';
export interface ByokSettings { enabled: boolean; provider: string; model: string; api_key: string; base_url: string }
export function loadByok(): ByokSettings {
  try {
    const raw = localStorage.getItem(BYOK_KEY);
    if (raw) return JSON.parse(raw) as ByokSettings;
  } catch { /* gizli pencere vb. */ }
  return { enabled: false, provider: 'anthropic', model: 'claude-opus-5-5', api_key: '', base_url: '' };
}
export function saveByok(s: ByokSettings) {
  try { localStorage.setItem(BYOK_KEY, JSON.stringify(s)); } catch { /* yok say */ }
}
