import type { Message, TriageRecord } from '../../shared/types.ts';
import { SYSTEM_PROMPT, userPrompt } from './prompt.ts';
import { extractJson, SchemaError, validateOutput } from './schema.ts';
import { STUB_MODEL, stubTriage } from './stub.ts';
import type { PriorAsk } from './context.ts';

export type ProviderName = 'anthropic' | 'openai' | 'stub';

const TIMEOUT_MS = 45_000;

export function resolveProvider(requested?: string): { provider: ProviderName; model: string; reason: string } {
  const want = (requested ?? process.env.TRIAGE_PROVIDER ?? '').toLowerCase();
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  if (want === 'stub') return { provider: 'stub', model: STUB_MODEL, reason: 'Stub requested' };
  if ((want === 'anthropic' || !want) && hasAnthropic)
    return { provider: 'anthropic', model: process.env.TRIAGE_MODEL ?? 'claude-sonnet-4-5', reason: 'ANTHROPIC_API_KEY set' };
  if ((want === 'openai' || !want) && hasOpenAI)
    return { provider: 'openai', model: process.env.TRIAGE_MODEL ?? 'gpt-4.1-mini', reason: 'OPENAI_API_KEY set' };
  return { provider: 'stub', model: STUB_MODEL, reason: want ? `${want} requested but no API key found` : 'No API key found' };
}

async function callAnthropic(model: string, system: string, user: string, signal: AbortSignal) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 2000, temperature: 0, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json: any = await res.json();
  if (json.stop_reason === 'refusal') throw new Error('Model refused');
  const text = (json.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
  return { text, tokens: { input: json.usage?.input_tokens ?? 0, output: json.usage?.output_tokens ?? 0 } };
}

async function callOpenAI(model: string, system: string, user: string, signal: AbortSignal) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json: any = await res.json();
  const choice = json.choices?.[0];
  if (choice?.message?.refusal) throw new Error(`Model refused: ${choice.message.refusal}`);
  return { text: choice?.message?.content ?? '', tokens: { input: json.usage?.prompt_tokens ?? 0, output: json.usage?.completion_tokens ?? 0 } };
}

/**
 * One message through one provider. Never throws: failures come back as a record with `output: null`
 * and an `error`, which the desk turns into a "Needs a look" entry instead of dropping the message.
 * Invalid output gets one retry with the validation error fed back to the model.
 */
export async function triageMessage(msg: Message, prior: PriorAsk[], provider: ProviderName, model: string): Promise<TriageRecord> {
  const started = Date.now();
  if (provider === 'stub') {
    const raw = stubTriage(msg, prior);
    return { output: validateOutput(raw, msg.id), provider, model, latency_ms: Date.now() - started };
  }

  const call = provider === 'anthropic' ? callAnthropic : callOpenAI;
  let user = userPrompt(msg, prior);
  const tokens = { input: 0, output: 0 };
  let lastError = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await call(model, SYSTEM_PROMPT, user, ctrl.signal);
      tokens.input += r.tokens.input;
      tokens.output += r.tokens.output;
      const output = validateOutput(extractJson(r.text), msg.id);
      return { output, provider, model, latency_ms: Date.now() - started, tokens };
    } catch (e) {
      const err = e as Error;
      lastError = err.name === 'AbortError' ? `timed out after ${TIMEOUT_MS / 1000}s` : err.message;
      if (!(err instanceof SchemaError)) break;
      user = `${userPrompt(msg, prior)}\n\nYour previous reply was rejected: ${err.message}. Return only the JSON object.`;
    } finally {
      clearTimeout(timer);
    }
  }
  return { output: null, provider, model, error: lastError, latency_ms: Date.now() - started, tokens };
}
