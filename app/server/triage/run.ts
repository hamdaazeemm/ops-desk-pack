/**
 * npm run triage                     -> uses Anthropic/OpenAI if a key is set, otherwise the stub
 * npm run triage -- --provider=stub  -> force a provider
 * npm run triage -- --only=msg-031   -> re-run one message, keep the rest of the cache
 *
 * Messages are processed in arrival order; each call sees the asks created so far so it can
 * merge duplicates and attach updates. Output: data/triage-cache.json (committed, so the demo is offline).
 */
import { writeFileSync } from 'node:fs';
import type { TriageCache } from '../../shared/types.ts';
import { CACHE_PATH, loadCache, loadEnv, loadInbox } from '../data.ts';
import { priorFromOutput, type PriorAsk } from './context.ts';
import { resolveProvider, triageMessage } from './providers.ts';

loadEnv();
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const { provider, model, reason } = resolveProvider(args.provider);
const messages = loadInbox();
const existing = args.only ? loadCache() : null;

console.log(`Triage with ${provider} (${model}) - ${reason}`);

const cache: TriageCache = existing ?? { generated_at: '', provider, model, results: {} };
const prior: PriorAsk[] = [];
let inTok = 0;
let outTok = 0;

for (const msg of messages) {
  const skip = args.only && args.only !== msg.id && cache.results[msg.id];
  const rec = skip ? cache.results[msg.id] : await triageMessage(msg, prior, provider, model);
  cache.results[msg.id] = rec;
  if (rec.output) prior.push(...priorFromOutput(rec.output, msg));
  inTok += rec.tokens?.input ?? 0;
  outTok += rec.tokens?.output ?? 0;
  if (skip) continue;
  const o = rec.output;
  const line = o
    ? `${o.kind.padEnd(6)} conf ${o.confidence.toFixed(2)}  ${o.kind === 'noise' ? o.noise_reason : [...o.asks.map((a) => `${a.title.slice(0, 50)}${a.same_as ? ` = ${a.same_as}` : ''}`), ...o.updates.map((u) => `${u.type} -> ${u.target}`)].join(' | ')}`
    : `FAILED  ${rec.error}`;
  console.log(`${msg.id}  ${line}`);
}

cache.generated_at = new Date().toISOString();
cache.provider = provider;
cache.model = model;
writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
console.log(`\nWrote ${CACHE_PATH}${inTok ? `  (tokens in ${inTok}, out ${outTok})` : ''}`);
