import type {
  Ask, AuditEvent, Controlled, DeskState, Message, ModelAsk, Risk, TriageCache, TriageOutput,
} from '../shared/types.ts';
import { deskNow } from '../shared/time.ts';
import { registers } from './data.ts';

/** Below these, the model's output waits in "Needs a look" instead of being applied (DECISIONS D2, D6). */
export const WORK_MIN_CONFIDENCE = 0.6;
export const NOISE_MIN_CONFIDENCE = 0.85;

const RISK_ORDER: Risk[] = ['low', 'medium', 'high'];
const maxRisk = (a: Risk, b: Risk) => (RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b);
const minDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
const firstName = (name: string) => name.split(/\s+/)[0];
const internal = (email: string) => email.toLowerCase().endsWith('@pentlandinfra.com');

export const PREREQUISITE_LABEL: Record<Controlled, string> = {
  data_room: 'Executed NDA recorded against this counterparty',
  bank_details: 'Phone verification on a number already on file (not from the email)',
  new_vendor: 'Vendor onboarding checks completed (registration, tax, references, bank letter verified by phone)',
  letterhead: 'Approval from an authorised signatory',
};

export const RELEASE_LABEL: Record<Controlled, string> = {
  data_room: 'Grant data room access',
  bank_details: 'Action the bank-detail change',
  new_vendor: 'Add to vendor master',
  letterhead: 'Release the signed letter',
};

type Ctx = { state: DeskState; messages: Message[]; cache: TriageCache };

function audit(state: DeskState, e: Omit<AuditEvent, 'id'>) {
  state.audit.push({ id: state.next_event++, ...e });
}

const modelActor = (state: DeskState) => `Model (${state.triage.provider}: ${state.triage.model})`;

/* ---------------- Building the desk from the model's output ---------------- */

function applyRules(state: DeskState, ask: Ask, msg: Message, at: string) {
  const text = `${msg.from.name} ${msg.subject} ${msg.body}`.toLowerCase();
  const domain = msg.from.email.split('@')[1]?.toLowerCase() ?? '';
  if (!internal(msg.from.email)) {
    const vendor = registers.vendors.find((v) => v.match.some((m) => text.includes(m)));
    if (vendor && !vendor.domains.includes(domain)) {
      const flag = `Sender domain ${domain} does not match ${vendor.domains.join(', ')} on file for ${vendor.name}`;
      if (!ask.flags.includes(flag)) {
        ask.flags.push(flag);
        ask.risk = 'high';
        audit(state, { at, actor: 'Rule: vendor domain check', actor_type: 'rule', action: 'flagged', ask_id: ask.id, message_id: msg.id, detail: flag });
      }
    }
  }
  if (ask.controlled.includes('data_room')) {
    const nda = registers.ndas.find((n) => n.match.some((m) => text.includes(m)));
    const flag = nda
      ? `NDA register: ${nda.counterparty} - ${nda.executed ? `executed ${nda.executed}` : `circulated ${nda.circulated}, NOT executed`}`
      : 'NDA register: no NDA found for this counterparty';
    if (!ask.flags.includes(flag)) {
      ask.flags.push(flag);
      audit(state, { at, actor: 'Rule: NDA register', actor_type: 'rule', action: 'flagged', ask_id: ask.id, message_id: msg.id, detail: flag });
    }
  }
  if (/\.gov\.pk/.test(text)) {
    const flag = 'Regulator correspondence: Compliance must be told the same day';
    if (!ask.flags.includes(flag)) {
      ask.flags.push(flag);
      ask.risk = 'high';
      audit(state, { at, actor: 'Rule: regulator sender', actor_type: 'rule', action: 'flagged', ask_id: ask.id, message_id: msg.id, detail: flag });
    }
  }
}

function receivedFrom(a: ModelAsk, msg: Message): { at: string; source: string } {
  if (a.original_date && `${a.original_date}T00:00:00+05:00` < msg.timestamp) {
    return { at: `${a.original_date}T09:00:00+05:00`, source: a.original_date_source ?? 'date in the message' };
  }
  return { at: msg.timestamp, source: `arrived on the desk (${msg.id})` };
}

function newAsk(state: DeskState, msg: Message, a: ModelAsk, ref: string | null, out: TriageOutput | null, by: string): Ask {
  const rec = receivedFrom(a, msg);
  const ask: Ask = {
    id: `A-${String(state.next_ask++).padStart(2, '0')}`,
    title: a.title,
    summary: a.summary,
    category: a.category,
    controlled: [...a.controlled],
    overrides: [],
    risk: a.risk,
    risk_reason: a.risk_reason,
    exposure: a.exposure,
    due: a.due,
    due_source: a.due_source,
    received_at: rec.at,
    received_source: rec.source,
    desk_arrival: msg.timestamp,
    requesters: [a.requester],
    waiting: [{ name: a.waiting_party.name, email: a.waiting_party.email, told_at: null, told_by: null, channel: null, from_message: msg.id }],
    owner: null,
    owner_source: null,
    owned_at: null,
    suggested_owner: a.suggested_owner,
    status: 'new',
    waiting_on: null,
    decision: null,
    redirect_suggested: a.redirect_to,
    redirected_to: null,
    messages: [{ message_id: msg.id, role: 'source', ask_ref: ref }],
    repliers: [],
    outbound: [],
    chase_count: 0,
    prerequisites: [],
    released: [],
    flags: [],
    linked: [],
    model: { confidence: out?.confidence ?? 1, rationale: out?.rationale ?? '', provider: by },
    created_at: msg.timestamp,
  };
  state.asks.push(ask);
  if (ref) state.ref_map[ref] = ask.id;
  return ask;
}

function mergeInto(state: DeskState, ask: Ask, msg: Message, a: ModelAsk, ref: string) {
  ask.messages.push({ message_id: msg.id, role: 'duplicate', ask_ref: ref });
  if (!ask.requesters.some((r) => r.email === a.requester.email)) ask.requesters.push(a.requester);
  if (!ask.waiting.some((w) => w.name === a.waiting_party.name)) {
    ask.waiting.push({ name: a.waiting_party.name, email: a.waiting_party.email, told_at: null, told_by: null, channel: null, from_message: msg.id });
  }
  const rec = receivedFrom(a, msg);
  if (rec.at < ask.received_at) {
    ask.received_at = rec.at;
    ask.received_source = rec.source;
  }
  const due = minDate(ask.due, a.due);
  if (due !== ask.due) {
    ask.due = due;
    ask.due_source = a.due_source;
  }
  ask.risk = maxRisk(ask.risk, a.risk);
  for (const c of a.controlled) if (!ask.controlled.includes(c)) ask.controlled.push(c);
  ask.exposure = ask.exposure ?? a.exposure;
  state.ref_map[ref] = ask.id;
}

/** Applies one message's model output. Shared by the initial build and "confirm" in Needs a look. */
function applyOutput(ctx: Ctx, msg: Message, out: TriageOutput, actor: string, at: string, actorType: 'model' | 'person') {
  const { state } = ctx;
  out.asks.forEach((a, i) => {
    const ref = `${msg.id}#${i}`;
    const target = a.same_as ? state.ref_map[a.same_as] : undefined;
    const existing = target && state.asks.find((x) => x.id === target);
    if (existing) {
      mergeInto(state, existing, msg, a, ref);
      applyRules(state, existing, msg, at);
      audit(state, { at, actor, actor_type: actorType, action: 'merged', ask_id: existing.id, message_id: msg.id, detail: `Same ask as ${a.same_as}: "${a.title}" merged into "${existing.title}". ${out.rationale}` });
      return;
    }
    const ask = newAsk(state, msg, a, ref, out, actor);
    applyRules(state, ask, msg, at);
    audit(state, { at, actor, actor_type: actorType, action: 'created', ask_id: ask.id, message_id: msg.id, detail: `"${ask.title}" (${ask.category}${ask.controlled.length ? `; controlled: ${ask.controlled.join(', ')}` : ''}; confidence ${out.confidence.toFixed(2)}). ${out.rationale}` });
    const rel = a.related_to ? state.ref_map[a.related_to] : undefined;
    const relAsk = rel && state.asks.find((x) => x.id === rel);
    if (relAsk) {
      ask.linked.push(relAsk.id);
      relAsk.linked.push(ask.id);
      audit(state, { at, actor, actor_type: actorType, action: 'linked', ask_id: ask.id, detail: `Linked to ${relAsk.id} "${relAsk.title}" (related, not the same ask)` });
    }
  });

  for (const u of out.updates) {
    const id = u.target ? state.ref_map[u.target] : undefined;
    const ask = id ? state.asks.find((x) => x.id === id) : undefined;
    if (!ask) {
      if (u.type === 'closure') {
        state.untracked_closures.push({ message_id: msg.id, note: u.note || msg.body.slice(0, 120), at, by: actor });
        audit(state, { at, actor, actor_type: actorType, action: 'closure (untracked)', message_id: msg.id, detail: `Closure for work that was never tracked here: "${u.note}"` });
      } else {
        audit(state, { at, actor, actor_type: actorType, action: `${u.type} (no match)`, message_id: msg.id, detail: `No tracked ask matches ${u.target}; message not attached` });
      }
      continue;
    }
    ask.messages.push({ message_id: msg.id, role: u.type, ask_ref: null, note: u.note });
    if (u.type === 'chaser') {
      ask.chase_count++;
      audit(state, { at, actor, actor_type: actorType, action: 'chaser', ask_id: ask.id, message_id: msg.id, detail: `${msg.from.name} chased (${ask.chase_count}x): ${u.note}` });
    } else if (u.type === 'decision') {
      ask.decision = { text: u.note, by: msg.from.name, at: msg.timestamp };
      ask.status = 'decided';
      if (!ask.owner && internal(msg.from.email)) {
        ask.owner = firstName(msg.from.name);
        ask.owner_source = 'reply';
        ask.owned_at = msg.timestamp;
        ask.repliers.push({ person: ask.owner, at: msg.timestamp });
      }
      audit(state, { at, actor, actor_type: actorType, action: 'decision', ask_id: ask.id, message_id: msg.id, detail: `${msg.from.name}: "${u.note}"` });
      const untold = ask.waiting.filter((w) => !w.told_at).map((w) => w.name);
      if (untold.length) {
        audit(state, { at, actor: 'Rule: done means told', actor_type: 'rule', action: 'held at Decided', ask_id: ask.id, message_id: msg.id, detail: `Decision recorded, but ${untold.join(', ')} ${untold.length > 1 ? 'have' : 'has'} not been told. The ask stays open until they are.` });
      }
    } else if (u.type === 'escalation') {
      ask.risk = 'high';
      audit(state, { at, actor, actor_type: actorType, action: 'escalation', ask_id: ask.id, message_id: msg.id, detail: u.note });
    } else if (u.type === 'closure') {
      ask.flags.push(`Closure signal from ${msg.from.name}: "${u.note}"`);
      audit(state, { at, actor, actor_type: actorType, action: 'closure signal', ask_id: ask.id, message_id: msg.id, detail: u.note });
    } else {
      audit(state, { at, actor, actor_type: actorType, action: 'info', ask_id: ask.id, message_id: msg.id, detail: u.note });
    }
  }
}

export function buildState(messages: Message[], cache: TriageCache): DeskState {
  const state: DeskState = {
    clock_offset_min: 0,
    asks: [],
    noise: [],
    review: [],
    untracked_closures: [],
    audit: [],
    ref_map: {},
    next_ask: 1,
    next_event: 1,
    triage: { provider: cache.provider, model: cache.model, generated_at: cache.generated_at },
  };
  const ctx: Ctx = { state, messages, cache };
  const actor = modelActor(state);

  for (const msg of messages) {
    const rec = cache.results[msg.id];
    const at = msg.timestamp;
    if (!rec || !rec.output) {
      const reason = rec ? `Model call failed: ${rec.error}` : 'Not triaged yet';
      state.review.push({ message_id: msg.id, reason, output: null });
      audit(state, { at, actor, actor_type: 'model', action: 'failed', message_id: msg.id, detail: `${reason}. Sent to Needs a look; nothing dropped.` });
      continue;
    }
    const out = rec.output;
    if (out.kind === 'noise') {
      if (out.confidence >= NOISE_MIN_CONFIDENCE) {
        state.noise.push({ message_id: msg.id, reason: out.noise_reason ?? 'Noise', confidence: out.confidence, by: actor, at });
        audit(state, { at, actor, actor_type: 'model', action: 'filed as noise', message_id: msg.id, detail: `${out.noise_reason} (confidence ${out.confidence.toFixed(2)}). ${out.rationale}` });
      } else {
        state.review.push({ message_id: msg.id, reason: `Model thinks this is noise ("${out.noise_reason}") but confidence ${out.confidence.toFixed(2)} is below ${NOISE_MIN_CONFIDENCE}`, output: out });
        audit(state, { at, actor, actor_type: 'model', action: 'needs a look', message_id: msg.id, detail: 'Noise below threshold' });
      }
      continue;
    }
    if (out.confidence < WORK_MIN_CONFIDENCE) {
      state.review.push({ message_id: msg.id, reason: `Confidence ${out.confidence.toFixed(2)} is below ${WORK_MIN_CONFIDENCE}. ${out.rationale}`, output: out });
      audit(state, { at, actor, actor_type: 'model', action: 'needs a look', message_id: msg.id, detail: `Low confidence (${out.confidence.toFixed(2)}): ${out.rationale}` });
      continue;
    }
    applyOutput(ctx, msg, out, actor, at, 'model');
  }
  return state;
}

/* ---------------- Human actions ---------------- */

export type Action =
  | { type: 'claim'; ask_id: string }
  | { type: 'unclaim'; ask_id: string }
  | { type: 'reply'; ask_id: string; person: string }
  | { type: 'send'; ask_id: string; to: string; subject: string; body: string; mode: 'reply' | 'new'; told_party: number | null }
  | { type: 'set_waiting'; ask_id: string; on: string }
  | { type: 'decide'; ask_id: string; text: string }
  | { type: 'told'; ask_id: string; party: number; channel: string }
  | { type: 'resolve'; ask_id: string }
  | { type: 'redirect'; ask_id: string; to: string; channel: string }
  | { type: 'prerequisite'; ask_id: string; kind: Controlled; detail: string }
  | { type: 'release'; ask_id: string; kind: Controlled }
  | { type: 'override'; ask_id: string; kind: Controlled; reason: string }
  | { type: 'detach'; ask_id: string; message_id: string }
  | { type: 'file_noise'; ask_id: string; reason: string }
  | { type: 'restore_noise'; message_id: string; as: 'ask' | 'closure'; title?: string }
  | { type: 'review_confirm'; message_id: string; title?: string }
  | { type: 'review_noise'; message_id: string; reason?: string }
  | { type: 'advance_clock'; minutes: number };

export class ActionError extends Error {}

function basicAsk(msg: Message, title?: string): ModelAsk {
  return {
    title: title?.trim() || msg.subject.replace(/^((re|fwd?|fw):\s*)+/i, ''),
    summary: msg.body.replace(/\s+/g, ' ').slice(0, 220),
    category: 'general', controlled: [], risk: 'medium', risk_reason: 'Added by a person', exposure: null,
    due: null, due_source: null, original_date: null, original_date_source: null,
    requester: msg.from, waiting_party: { name: msg.from.name, email: msg.from.email },
    suggested_owner: null, redirect_to: null, same_as: null, related_to: null,
  };
}

export function applyAction(ctx: Ctx, action: Action, actor: string): void {
  const { state, messages, cache } = ctx;
  const now = deskNow(state.clock_offset_min);
  const msgById = (id: string) => {
    const m = messages.find((x) => x.id === id);
    if (!m) throw new ActionError(`Unknown message ${id}`);
    return m;
  };
  const getAsk = (id: string) => {
    const a = state.asks.find((x) => x.id === id);
    if (!a) throw new ActionError(`Unknown ask ${id}`);
    return a;
  };
  const log = (action: string, detail: string, ask_id?: string, message_id?: string) =>
    audit(state, { at: now, actor, actor_type: 'person', action, ask_id, message_id, detail });

  switch (action.type) {
    case 'claim': {
      const ask = getAsk(action.ask_id);
      const prev = ask.owner;
      ask.owner = actor;
      ask.owner_source = 'claim';
      ask.owned_at = now;
      if (ask.status === 'new') ask.status = 'claimed';
      log('claimed', prev && prev !== actor ? `Took over from ${prev}` : 'Claimed', ask.id);
      return;
    }
    case 'unclaim': {
      const ask = getAsk(action.ask_id);
      log('unclaimed', `Released by ${actor} (was ${ask.owner})`, ask.id);
      ask.owner = null;
      ask.owner_source = null;
      ask.owned_at = null;
      if (ask.status === 'claimed') ask.status = 'new';
      return;
    }
    case 'reply': {
      const ask = getAsk(action.ask_id);
      ask.repliers.push({ person: action.person, at: now });
      if (!ask.owner) {
        ask.owner = action.person;
        ask.owner_source = 'reply';
        ask.owned_at = now;
        if (ask.status === 'new') ask.status = 'claimed';
        audit(state, { at: now, actor: action.person, actor_type: 'person', action: 'replied in Outlook', ask_id: ask.id, detail: `${action.person} replied from the shared mailbox (simulated). No owner yet, so the reply claims it.` });
      } else if (ask.owner !== action.person) {
        audit(state, { at: now, actor: action.person, actor_type: 'person', action: 'replied in Outlook', ask_id: ask.id, detail: `${action.person} replied, but ${ask.owner} owns this ask. Collision shown to both.` });
      } else {
        audit(state, { at: now, actor: action.person, actor_type: 'person', action: 'replied in Outlook', ask_id: ask.id, detail: `${action.person} replied (owner).` });
      }
      return;
    }
    case 'send': {
      const ask = getAsk(action.ask_id);
      ask.outbound ??= [];
      if (!action.to.trim()) throw new ActionError('Say who it goes to');
      if (!action.body.trim()) throw new ActionError('Write the email');
      const party = action.told_party !== null ? ask.waiting[action.told_party] : undefined;
      ask.outbound.push({ at: now, by: actor, to: action.to.trim(), subject: action.subject.trim(), body: action.body.trim(), mode: action.mode, told: party?.name ?? null });
      ask.repliers.push({ person: actor, at: now });
      if (!ask.owner) {
        ask.owner = actor;
        ask.owner_source = 'reply';
        ask.owned_at = now;
        if (ask.status === 'new') ask.status = 'claimed';
      }
      const held = ask.controlled.filter((c) => !ask.released.some((r) => r.kind === c));
      log('sent email (simulated)', `${action.mode === 'reply' ? 'Reply' : 'New email'} to ${action.to.trim()}: "${action.subject.trim()}" - ${action.body.trim().replace(/\s+/g, ' ').slice(0, 90)}${held.length ? ` [sent while held: ${held.join(', ')} not released]` : ''}`, ask.id);
      if (party && !party.told_at) {
        party.told_at = now;
        party.told_by = actor;
        party.channel = `Email from ops@ (sent from the desk)`;
        log('told', `${party.name} told by ${actor} via email sent from the desk`, ask.id);
        if (ask.waiting.every((w) => w.told_at) && ask.status !== 'redirected') ask.status = 'told';
      }
      return;
    }
    case 'set_waiting': {
      const ask = getAsk(action.ask_id);
      if (!action.on.trim()) throw new ActionError('Say who or what it is waiting on');
      ask.status = 'waiting';
      ask.waiting_on = action.on.trim();
      if (!ask.owner) {
        ask.owner = actor;
        ask.owner_source = 'claim';
        ask.owned_at = now;
      }
      log('waiting', `Waiting on ${ask.waiting_on}`, ask.id);
      return;
    }
    case 'decide': {
      const ask = getAsk(action.ask_id);
      if (!action.text.trim()) throw new ActionError('Write the decision');
      ask.decision = { text: action.text.trim(), by: actor, at: now };
      ask.status = 'decided';
      ask.owner = ask.owner ?? actor;
      log('decided', action.text.trim(), ask.id);
      return;
    }
    case 'told': {
      const ask = getAsk(action.ask_id);
      const p = ask.waiting[action.party];
      if (!p) throw new ActionError('Unknown waiting party');
      if (!action.channel.trim()) throw new ActionError('Say how they were told');
      p.told_at = now;
      p.told_by = actor;
      p.channel = action.channel.trim();
      log('told', `${p.name} told by ${actor} via ${p.channel}`, ask.id);
      if (ask.waiting.every((w) => w.told_at) && ask.status !== 'redirected') ask.status = 'told';
      return;
    }
    case 'resolve': {
      const ask = getAsk(action.ask_id);
      const untold = ask.waiting.filter((w) => !w.told_at).map((w) => w.name);
      if (untold.length) throw new ActionError(`Cannot resolve: ${untold.join(', ')} ${untold.length > 1 ? 'have' : 'has'} not been told.`);
      const open = ask.controlled.filter((c) => !ask.released.some((r) => r.kind === c));
      if (open.length) throw new ActionError(`Cannot resolve: ${open.map((c) => RELEASE_LABEL[c].toLowerCase()).join(', ')} has not been released, and its prerequisite is required first.`);
      ask.status = 'resolved';
      log('resolved', 'All waiting parties told', ask.id);
      return;
    }
    case 'redirect': {
      const ask = getAsk(action.ask_id);
      if (!action.to.trim() || !action.channel.trim()) throw new ActionError('Say where it went and how the sender was told');
      ask.redirected_to = action.to.trim();
      ask.status = 'redirected';
      for (const w of ask.waiting) {
        w.told_at = now;
        w.told_by = actor;
        w.channel = `${action.channel.trim()} (told it went to ${ask.redirected_to})`;
      }
      log('redirected', `Redirected to ${ask.redirected_to}; ${ask.waiting.map((w) => w.name).join(', ')} told`, ask.id);
      return;
    }
    case 'prerequisite': {
      const ask = getAsk(action.ask_id);
      if (!ask.controlled.includes(action.kind)) throw new ActionError('This ask is not in that controlled category');
      if (action.detail.trim().length < 10) throw new ActionError('Record the detail: who, what number or document, and the outcome');
      ask.prerequisites.push({ kind: action.kind, by: actor, at: now, detail: action.detail.trim() });
      log('prerequisite recorded', `${PREREQUISITE_LABEL[action.kind]}: ${action.detail.trim()}`, ask.id);
      return;
    }
    case 'release': {
      const ask = getAsk(action.ask_id);
      if (!ask.prerequisites.some((p) => p.kind === action.kind)) {
        throw new ActionError(`${RELEASE_LABEL[action.kind]} is unavailable until this is recorded: ${PREREQUISITE_LABEL[action.kind]}.`);
      }
      ask.released.push({ kind: action.kind, by: actor, at: now });
      log('released', `${RELEASE_LABEL[action.kind]} - basis: ${ask.prerequisites.filter((p) => p.kind === action.kind).map((p) => p.detail).join('; ')}`, ask.id);
      return;
    }
    case 'override': {
      const ask = getAsk(action.ask_id);
      if (action.reason.trim().length < 5) throw new ActionError('A reason is required; it goes in the audit log');
      ask.controlled = ask.controlled.filter((c) => c !== action.kind);
      ask.overrides.push({ kind: action.kind, by: actor, at: now, reason: action.reason.trim() });
      if (!ask.controlled.length && ask.risk_reason.startsWith('Controlled')) ask.risk = 'medium';
      log('category overridden', `Removed "${action.kind}" from "${ask.title}". Reason: ${action.reason.trim()}`, ask.id);
      return;
    }
    case 'detach': {
      const ask = getAsk(action.ask_id);
      const entry = ask.messages.find((m) => m.message_id === action.message_id);
      if (!entry || entry.role !== 'duplicate') throw new ActionError('Only a merged message can be detached');
      const msg = msgById(action.message_id);
      ask.messages = ask.messages.filter((m) => m !== entry);
      ask.waiting = ask.waiting.filter((w) => w.from_message !== msg.id);
      if (!ask.messages.some((m) => msgById(m.message_id).from.email === msg.from.email)) {
        ask.requesters = ask.requesters.filter((r) => r.email !== msg.from.email);
      }
      const remaining = ask.messages
        .map((m) => (m.ask_ref ? cache.results[m.ask_ref.split('#')[0]]?.output?.asks[Number(m.ask_ref.split('#')[1])] : undefined))
        .filter((x): x is ModelAsk => !!x);
      if (remaining.length) {
        ask.risk = remaining.map((r) => r.risk).reduce(maxRisk);
        ask.due = remaining.map((r) => r.due).reduce(minDate, null);
      }
      const [mid, idx] = (entry.ask_ref ?? '').split('#');
      const modelAsk = cache.results[mid]?.output?.asks[Number(idx)];
      const fresh = newAsk(state, msg, modelAsk ? { ...modelAsk, same_as: null } : basicAsk(msg), entry.ask_ref, cache.results[mid]?.output ?? null, actor);
      fresh.model.rationale = `Detached by ${actor} from ${ask.id}: the model merged it wrongly.`;
      applyRules(state, fresh, msg, now);
      log('detached', `${msg.id} was wrongly merged into ${ask.id} "${ask.title}"; now its own ask ${fresh.id} "${fresh.title}"`, ask.id, msg.id);
      return;
    }
    case 'file_noise': {
      const ask = getAsk(action.ask_id);
      state.asks = state.asks.filter((a) => a !== ask);
      for (const m of ask.messages.filter((m) => m.role === 'source' || m.role === 'duplicate')) {
        state.noise.push({ message_id: m.message_id, reason: action.reason || 'Filed as noise by a person', confidence: null, by: actor, at: now });
      }
      for (const [k, v] of Object.entries(state.ref_map)) if (v === ask.id) delete state.ref_map[k];
      log('filed as noise', `"${ask.title}" removed from the list. Reason: ${action.reason || 'none given'}`, ask.id);
      return;
    }
    case 'restore_noise': {
      const entry = state.noise.find((n) => n.message_id === action.message_id);
      if (!entry) throw new ActionError('Not in noise');
      const msg = msgById(action.message_id);
      state.noise = state.noise.filter((n) => n !== entry);
      if (action.as === 'closure') {
        state.untracked_closures.push({ message_id: msg.id, note: msg.body.split('\n')[0], at: now, by: actor });
        log('restored as closure', `${msg.from.name}: "${msg.body.split('\n')[0]}" - recorded as closure of work not tracked here (filed as "${entry.reason}")`, undefined, msg.id);
      } else {
        const ask = newAsk(state, msg, basicAsk(msg, action.title), null, null, actor);
        ask.model.rationale = `Restored from noise by ${actor}. The model had filed it as "${entry.reason}".`;
        applyRules(state, ask, msg, now);
        log('restored from noise', `"${ask.title}" restored as ${ask.id} (model filed it as "${entry.reason}")`, ask.id, msg.id);
      }
      return;
    }
    case 'review_confirm': {
      const entry = state.review.find((r) => r.message_id === action.message_id);
      if (!entry) throw new ActionError('Not in Needs a look');
      const msg = msgById(action.message_id);
      state.review = state.review.filter((r) => r !== entry);
      if (entry.output && entry.output.kind !== 'noise' && !action.title) {
        applyOutput(ctx, msg, entry.output, actor, now, 'person');
      } else {
        const ask = newAsk(state, msg, basicAsk(msg, action.title), null, null, actor);
        ask.model.rationale = `Created by ${actor} from Needs a look.`;
        applyRules(state, ask, msg, now);
        log('created from review', `"${ask.title}"`, ask.id, msg.id);
      }
      return;
    }
    case 'review_noise': {
      const entry = state.review.find((r) => r.message_id === action.message_id);
      if (!entry) throw new ActionError('Not in Needs a look');
      state.review = state.review.filter((r) => r !== entry);
      state.noise.push({ message_id: action.message_id, reason: action.reason || 'Filed as noise by a person', confidence: null, by: actor, at: now });
      log('filed as noise', action.reason || 'From Needs a look', undefined, action.message_id);
      return;
    }
    case 'advance_clock': {
      state.clock_offset_min += action.minutes;
      log('clock advanced', `Desk clock moved forward ${action.minutes} minutes to ${deskNow(state.clock_offset_min)} (demo control)`);
      return;
    }
  }
}
