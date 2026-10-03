import type { Message, TriageOutput } from '../../shared/types.ts';
import { registers } from '../data.ts';

/** What the model is told about asks that already exist, so it can merge, link and attach updates. */
export type PriorAsk = {
  ref: string;
  message_id: string;
  thread_id: string;
  title: string;
  category: string;
  requester_email: string;
  org: string | null;
  keys: string[];
};

export function findOrg(text: string): string | null {
  const t = text.toLowerCase();
  const v = registers.vendors.find((v) => v.match.some((m) => t.includes(m)));
  return v ? v.name : null;
}

export function entityKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(/\b(INV-\d+|VO-\d+|KHI-\d+|MC-\d+|GEN-\d{4}-\d+)\b/gi)) keys.add(m[1].toUpperCase());
  const t = text.toLowerCase();
  if (t.includes('kot addu')) keys.add('site:kot-addu');
  if (/\bhub\b/.test(t)) keys.add('site:hub');
  return [...keys];
}

export function priorFromOutput(out: TriageOutput, msg: Message): PriorAsk[] {
  return out.asks.map((a, i) => ({
    ref: `${msg.id}#${i}`,
    message_id: msg.id,
    thread_id: msg.thread_id,
    title: a.title,
    category: a.category,
    requester_email: msg.from.email.toLowerCase(),
    org: findOrg(`${msg.from.name} ${a.title} ${a.summary}`),
    keys: entityKeys(`${a.title} ${a.summary} ${msg.subject}`),
  }));
}

export function describePrior(prior: PriorAsk[]): string {
  if (!prior.length) return '(none yet)';
  return prior
    .map((p) => `- ${p.ref} [${p.category}] "${p.title}" (thread ${p.thread_id}, from ${p.requester_email}${p.org ? `, org ${p.org}` : ''})`)
    .join('\n');
}
