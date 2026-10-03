import express from 'express';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DeskState, StatePayload, TriageCache, User } from '../shared/types.ts';
import { deskNow } from '../shared/time.ts';
import { APP_DIR, STATE_PATH, loadCache, loadEnv, loadInbox, registers } from './data.ts';
import { ActionError, applyAction, buildState, type Action } from './desk.ts';
import { priorFromOutput, type PriorAsk } from './triage/context.ts';
import { resolveProvider, triageMessage } from './triage/providers.ts';
import { stubTriage, STUB_MODEL } from './triage/stub.ts';

loadEnv();

const USERS: User[] = [
  { name: 'Omar', role: 'coordinator', note: 'Clears the morning queue in Outlook' },
  { name: 'Ayesha', role: 'coordinator', note: 'Keeps the tracker' },
  { name: 'Bilal', role: 'coordinator' },
  { name: 'Daniyal', role: 'coordinator', note: 'On leave from tomorrow' },
  { name: 'Junaid', role: 'requester', note: 'Asset Manager, internal requester' },
  { name: 'Elena', role: 'compliance', note: 'Head of Compliance' },
  { name: 'Tariq', role: 'md', note: 'Managing Director' },
];

const messages = loadInbox();

function freshCache(): TriageCache {
  const cache = loadCache();
  if (cache) return cache;
  // No cache on disk: triage with the stub in memory so the app still starts.
  const results: TriageCache['results'] = {};
  const prior: PriorAsk[] = [];
  for (const m of messages) {
    const output = stubTriage(m, prior);
    results[m.id] = { output, provider: 'stub', model: STUB_MODEL };
    prior.push(...priorFromOutput(output, m));
  }
  return { generated_at: new Date().toISOString(), provider: 'stub', model: STUB_MODEL, results };
}

let cache = freshCache();
let state: DeskState = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, 'utf8')) : buildState(messages, cache);

const save = () => writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));

function payload(): StatePayload {
  const p = resolveProvider();
  return {
    state,
    messages,
    users: USERS,
    now: deskNow(state.clock_offset_min),
    live_model: {
      available: p.provider !== 'stub',
      provider: p.provider === 'stub' ? 'none' : `${p.provider} (${p.model})`,
      reason: p.reason,
    },
    vendors: registers.vendors,
  };
}

const app = express();
app.use(express.json());

app.get('/api/state', (_req, res) => res.json(payload()));

app.post('/api/action', (req, res) => {
  const actor = String(req.header('x-user') || 'Unknown');
  try {
    applyAction({ state, messages, cache }, req.body as Action, actor);
    save();
    res.json(payload());
  } catch (e) {
    const status = e instanceof ActionError ? 409 : 500;
    res.status(status).json({ error: (e as Error).message });
  }
});

app.post('/api/reset', (_req, res) => {
  cache = freshCache();
  state = buildState(messages, cache);
  save();
  res.json(payload());
});

/** Live model call for one message. Shown beside the cached output; never silently replaces it. */
app.post('/api/live-triage', async (req, res) => {
  const id = String(req.body?.message_id ?? '');
  const idx = messages.findIndex((m) => m.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Unknown message' });
  const p = resolveProvider();
  if (p.provider === 'stub') {
    return res.json({ ok: false, error: `No live model: ${p.reason}. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to app/.env. The cached output is unchanged.` });
  }
  const prior: PriorAsk[] = [];
  for (const m of messages.slice(0, idx)) {
    const out = cache.results[m.id]?.output;
    if (out) prior.push(...priorFromOutput(out, m));
  }
  const rec = await triageMessage(messages[idx], prior, p.provider, p.model);
  res.json(rec.output ? { ok: true, record: rec } : { ok: false, error: `Model call failed: ${rec.error}. The cached output is unchanged; in production this message would go to Needs a look.`, record: rec });
});

const dist = join(APP_DIR, 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

const port = Number(process.env.PORT ?? 4310);
app.listen(port, () => {
  console.log(`Pentland Ops Desk running at http://localhost:${port}`);
  console.log(`Triage source: ${cache.provider} (${cache.model}), generated ${cache.generated_at}`);
});
