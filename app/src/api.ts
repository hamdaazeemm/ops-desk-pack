import type { StatePayload, TriageRecord } from '../shared/types.ts';

async function post<T>(url: string, body: unknown, user?: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

export const getState = async (): Promise<StatePayload> => (await fetch('/api/state')).json();
export const act = (user: string, action: Record<string, unknown>) => post<StatePayload>('/api/action', action, user);
export const resetDesk = () => post<StatePayload>('/api/reset', {});
export const liveTriage = (message_id: string) =>
  post<{ ok: boolean; error?: string; record?: TriageRecord }>('/api/live-triage', { message_id });
