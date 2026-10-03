import type { Controlled, Exposure, Message, ModelAsk, ModelUpdate, Risk, TriageOutput } from '../../shared/types.ts';
import { addWorkingDays, nextWeekday, parseLooseDate } from '../../shared/time.ts';
import { entityKeys, findOrg, type PriorAsk } from './context.ts';

/**
 * Offline stand-in for the model: keyword and pattern rules, run over each message in arrival order.
 * It returns the same JSON as the real model and goes through the same validator. Its mistakes are
 * whatever these rules get wrong; nothing here is keyed to a message id.
 */
export const STUB_MODEL = 'keyword-rules-v1';

const NOISE_RULES: [RegExp, string, number, 'subject' | 'from' | 'text' | 'to'][] = [
  [/^automatic reply:/i, 'Out-of-office auto-reply', 0.97, 'subject'],
  [/^read:/i, 'Read receipt', 0.97, 'subject'],
  [/^(accepted|declined|tentative):/i, 'Calendar response', 0.96, 'subject'],
  [/^(no-?reply|do-?not-?reply)@/i, 'Automated system notice', 0.9, 'from'],
  [/unsubscribe|manage preferences|register now|start the survey|view insights|read the full alert/i, 'Newsletter or marketing', 0.93, 'text'],
  [/all-staff@/i, 'Broadcast to all staff', 0.9, 'to'],
  [/(fifteen|ten) minutes this week|free pilot|candidates currently available/i, 'Unsolicited sales or recruiting', 0.9, 'text'],
];

const CATEGORY_RULES: [RegExp, string][] = [
  [/data room/i, 'data_room'],
  [/bank(ing)? details[^.]*chang|updated bank details|new account details/i, 'bank_change'],
  [/vendor registration|registration pack/i, 'vendor_registration'],
  [/regulation \d|licen[cs]e no|the authority requires/i, 'regulatory'],
  [/variation order|\bvo-\d+/i, 'variation'],
  [/leak|seepage|spill|incident/i, 'hse_incident'],
  [/consignment|customs|demurrage|clearing agent/i, 'customs'],
  [/mandate|signator/i, 'banking_admin'],
  [/reporting pack|investment committee/i, 'investor_reporting'],
  [/annual leave|carry-forward|hr portal/i, 'hr'],
  [/\baudit/i, 'audit'],
  [/invoice|unpaid|overdue/i, 'invoice'],
  [/insurance|policy|certificate/i, 'insurance'],
  [/site access|gate pass/i, 'site_access'],
  [/password|mailbox storage/i, 'it'],
];

const CONTROLLED_RULES: [RegExp, Controlled][] = [
  [/data room/i, 'data_room'],
  [/\b(iban|account no|bank details|banking details|remit\w*|payment)\b/i, 'bank_details'],
  [/vendor registration|registration pack|be considered for/i, 'new_vendor'],
  [/on (your|our) letterhead|signed and stamped/i, 'letterhead'],
];

const OWNER_BY_CATEGORY: Record<string, string> = {
  site_access: 'Omar', it: 'Omar', invoice: 'Bilal', variation: 'Bilal', customs: 'Bilal',
  insurance: 'Ayesha', regulatory: 'Ayesha', hse_incident: 'Ayesha', data_room: 'Ayesha',
  bank_change: 'Bilal', vendor_registration: 'Daniyal', audit: 'Daniyal',
};

const REDIRECT_BY_CATEGORY: Record<string, string> = {
  banking_admin: 'Finance', investor_reporting: 'Investor Relations', hr: 'HR',
};

const HIGH_RISK = /enforcement|standing time|demurrage|expired|leak|seepage|overdue|hold further/i;
const MEDIUM_RISK = /lapse|expires|deadline|audit|investment committee|by \w+day \d+ march|until \d+ march|today/i;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function firstSentence(text: string): string {
  const s = clean(text).split(/(?<=[.?!])\s| — /)[0];
  return cap(s.replace(/^(i need|can someone|please)\s+/i, '')).slice(0, 90);
}

function stripSubject(subject: string): string {
  let s = subject;
  while (/^(re|fwd?|urgent|fw):\s*/i.test(s)) s = s.replace(/^(re|fwd?|urgent|fw):\s*/i, '');
  return s;
}

function extractDue(text: string, ts: string): { due: string | null; source: string | null; original: string | null; originalSource: string | null } {
  const found: { d: string; src: string }[] = [];
  let original: string | null = null;
  let originalSource: string | null = null;
  const t = text;
  const wd = t.match(/within \w+ \((\d+)\) working days[^.]*?being (\d{1,2} \w+ \d{4})/i);
  if (wd) {
    const base = parseLooseDate(wd[2]);
    if (base) {
      found.push({ d: addWorkingDays(base, Number(wd[1])), src: clean(wd[0]) });
      original = base;
      originalSource = `notice dated ${wd[2]}`;
    }
  }
  for (const m of t.matchAll(/(by|until|on|expires on) (?:\w+day )?(\d{1,2}) (march|april)/gi)) {
    const d = parseLooseDate(`${m[2]} ${m[3]}`);
    if (d) found.push({ d, src: m[0] });
  }
  const thu = t.match(/thursday (\d{1,2})(?:st|nd|rd|th)/i);
  if (thu) found.push({ d: `2026-03-${thu[1].padStart(2, '0')}`, src: thu[0] });
  const wed = t.match(/by wednesday close/i);
  if (wed) found.push({ d: nextWeekday(ts, 3), src: wed[0] });
  const mon = t.match(/before monday/i);
  if (mon) found.push({ d: nextWeekday(ts, 1), src: mon[0] });
  const btw = t.match(/between (\d{1,2}) and \d{1,2} (march)/i);
  if (btw) {
    const d = parseLooseDate(`${btw[1]} ${btw[2]}`);
    if (d) found.push({ d, src: btw[0] });
  }
  const dated = t.match(/dated (\d{1,2} [A-Z][a-z]+)/);
  if (dated && !original) {
    original = parseLooseDate(dated[1]);
    originalSource = clean(dated[0]);
  }
  found.sort((a, b) => a.d.localeCompare(b.d));
  return { due: found[0]?.d ?? null, source: found[0]?.src ?? null, original, originalSource };
}

function extractExposure(text: string, category: string): Exposure {
  const perDay = text.match(/accruing at (PKR|USD) ([\d,]+) per day/i);
  if (perDay) {
    return { amount: Number(perDay[2].replace(/,/g, '')), currency: perDay[1].toUpperCase() as 'PKR', per: 'day', from: null, note: clean(perDay[0]) };
  }
  const dem = text.match(/demurrage[^.]*?from (?:\w+day )?(\d{1,2} \w+)[^.]*?(USD|PKR) (\d[\d,]*) per day/i);
  if (dem) {
    return { amount: Number(dem[3].replace(/,/g, '')), currency: dem[2].toUpperCase() as 'USD', per: 'day', from: parseLooseDate(dem[1]), note: clean(dem[0]) };
  }
  if (category === 'invoice') {
    const inv = text.match(/for (PKR) ([\d,]+)/i);
    if (inv) return { amount: Number(inv[2].replace(/,/g, '')), currency: 'PKR', per: 'once', from: null, note: 'Unpaid invoice amount' };
  }
  return null;
}

function riskOf(text: string, controlled: Controlled[]): { risk: Risk; reason: string } {
  const hi = text.match(HIGH_RISK);
  if (hi) return { risk: 'high', reason: `Mentions "${hi[0]}"` };
  if (controlled.length) return { risk: 'high', reason: `Controlled category: ${controlled.join(', ')}` };
  const med = text.match(MEDIUM_RISK);
  if (med) return { risk: 'medium', reason: `Mentions "${med[0]}"` };
  return { risk: 'low', reason: 'No deadline or cost language found' };
}

function findSameAs(category: string, text: string, org: string | null, keys: string[], prior: PriorAsk[], why: string[]): { same: string | null; related: string | null } {
  const idKeys = keys.filter((k) => !k.startsWith('site:'));
  const byKey = prior.find((p) => p.keys.some((k) => idKeys.includes(k)));
  if (byKey) {
    if (category === 'bank_change') {
      why.push(`Shares ${idKeys.join(', ')} with ${byKey.ref} but is a bank change, so linked rather than merged.`);
      return { same: null, related: byKey.ref };
    }
    if (byKey.category === category) {
      why.push(`Same reference (${idKeys.join(', ')}) as ${byKey.ref}.`);
      return { same: byKey.ref, related: null };
    }
  }
  if (org && category === 'invoice') {
    const p = prior.find((p) => p.category === 'invoice' && p.org === org);
    if (p) {
      why.push(`Invoice from the same organisation (${org}) as ${p.ref}.`);
      return { same: p.ref, related: null };
    }
  }
  if (/access/i.test(text)) {
    const site = keys.find((k) => k.startsWith('site:'));
    const p = site && prior.find((p) => p.category === 'site_access' && p.keys.includes(site));
    if (p) {
      why.push(`Site access at the same site (${site!.slice(5)}) as ${p.ref}.`);
      return { same: p.ref, related: null };
    }
  }
  return { same: null, related: null };
}

export function stubTriage(msg: Message, prior: PriorAsk[]): TriageOutput {
  const text = `${msg.subject}\n${msg.body}`;
  const why: string[] = [];
  const base = { message_id: msg.id, noise_reason: null as string | null, asks: [] as ModelAsk[], updates: [] as ModelUpdate[] };

  for (const [re, reason, conf, field] of NOISE_RULES) {
    const target = field === 'subject' ? msg.subject : field === 'from' ? msg.from.email : field === 'to' ? msg.to.join(',') : text;
    if (re.test(target)) {
      return { ...base, kind: 'noise', noise_reason: reason, confidence: conf, rationale: `Matched ${field} pattern for "${reason}".` };
    }
  }
  const shortBody = clean(msg.body.split(/\n\s*\n/)[0]);
  if (msg.body.length < 70 && /thanks|noted|received/i.test(shortBody)) {
    return { ...base, kind: 'noise', noise_reason: 'Acknowledgement, no action', confidence: 0.86, rationale: `Short acknowledgement: "${shortBody}".` };
  }

  const internal = msg.from.email.toLowerCase().endsWith('@pentlandinfra.com');
  const inThread = prior.filter((p) => p.thread_id === msg.thread_id);
  let workText = msg.body;
  let splitFromThread = false;

  if (inThread.length && /^re:/i.test(msg.subject)) {
    if (/any update|not heard|still waiting|chasing/i.test(msg.body)) {
      const mine = inThread.filter((p) => p.requester_email === msg.from.email.toLowerCase());
      const targets = mine.length ? mine : inThread;
      return {
        ...base, kind: 'update', confidence: 0.88,
        updates: targets.map((p) => ({ target: p.ref, type: 'chaser', note: `Chased: "${firstSentence(msg.body)}"` })),
        rationale: `Reply in ${msg.thread_id} asking for an update; attached as a chaser to ${targets.map((t) => t.ref).join(', ')}.`,
      };
    }
    if (/\bapprov/i.test(msg.body) && internal) {
      const sentence = clean(msg.body).split(/(?<=[.!?])\s/).find((s) => /approv/i.test(s)) ?? firstSentence(msg.body);
      return {
        ...base, kind: 'update', confidence: 0.83,
        updates: [{ target: inThread[0].ref, type: 'decision', note: sentence }],
        rationale: `Internal reply in ${msg.thread_id} recording an approval; treated as a decision on ${inThread[0].ref}.`,
      };
    }
    if (/nothing to do with|separate matter|unrelated/i.test(msg.body)) {
      splitFromThread = true;
      workText = msg.body.replace(/^.*?(nothing to do with[^.]*\.)\s*/is, '');
      why.push(`Reply in ${msg.thread_id} says it is "nothing to do with" the thread, so it is a new ask.`);
    } else {
      const latest = inThread[inThread.length - 1];
      const esc = /no response|who is handling|urgent|reached|stop/i.test(msg.body);
      return {
        ...base, kind: 'update', confidence: 0.74,
        updates: [{ target: latest.ref, type: esc ? 'escalation' : 'info', note: firstSentence(msg.body.replace(/^photos attached\.\s*/i, '')) }],
        rationale: `Follow-up in ${msg.thread_id}; attached to the most recent ask in the thread (${latest.ref})${esc ? ' as an escalation' : ''}.`,
      };
    }
  }

  const forwarded = /-{5,} Forwarded message -{5,}/.test(msg.body);
  let innerFrom: { name: string; email: string | null } | null = null;
  let innerSubject: string | null = null;
  if (forwarded) {
    const froms = [...msg.body.matchAll(/From: (.+?) <(.+?)>/g)];
    const subs = [...msg.body.matchAll(/Subject: (.+)/g)];
    const last = froms[froms.length - 1];
    if (last) innerFrom = { name: last[1], email: last[2] };
    if (subs.length) innerSubject = subs[subs.length - 1][1].trim();
    why.push(`Forwarded ${froms.length} times; using the original sender (${innerFrom?.name}).`);
  }

  const items = [...workText.matchAll(/^\s*\d+\.\s+([\s\S]+?)(?=\n\s*\d+\.\s|\n\s*\n|$)/gm)].map((m) => m[1]);
  const multi = items.length >= 2;
  const texts = multi ? items : [workText];
  if (multi) why.push(`Numbered list: ${items.length} separate asks.`);

  const asks: ModelAsk[] = texts.map((t, i) => {
    const scope = multi || splitFromThread ? t : `${msg.subject}\n${t}`;
    const category = CATEGORY_RULES.find(([re]) => re.test(scope))?.[1] ?? 'general';
    const controlled: Controlled[] = [];
    for (const [re, c] of CONTROLLED_RULES) {
      const m = scope.match(re);
      if (m) {
        controlled.push(c);
        why.push(`${multi ? `Ask ${i + 1}: ` : ''}flagged ${c} (matched "${m[0]}").`);
      }
    }
    const { risk, reason } = riskOf(scope, controlled);
    const dates = extractDue(scope, msg.timestamp);
    const org = findOrg(`${msg.from.name} ${scope}`);
    const keys = entityKeys(scope);
    const { same, related } = findSameAs(category, scope, org, keys, prior, why);
    const title = forwarded && innerSubject ? innerSubject : multi || splitFromThread ? firstSentence(t) : cap(stripSubject(msg.subject));
    return {
      title,
      summary: clean(t).slice(0, 220),
      category,
      controlled,
      risk,
      risk_reason: reason,
      exposure: extractExposure(scope, category),
      due: dates.due,
      due_source: dates.source,
      original_date: dates.original,
      original_date_source: dates.originalSource,
      requester: msg.from,
      waiting_party: innerFrom ?? { name: msg.from.name, email: msg.from.email },
      suggested_owner: OWNER_BY_CATEGORY[category] ?? null,
      redirect_to: REDIRECT_BY_CATEGORY[category] ?? null,
      same_as: same,
      related_to: related,
    };
  });

  let confidence = multi ? 0.8 : splitFromThread ? 0.72 : 0.82;
  if (asks.every((a) => a.category === 'general')) {
    confidence = 0.45;
    why.push('No category matched.');
  }
  if (msg.attachments.length && msg.body.length < 120) {
    confidence -= 0.15;
    why.push(`Body is ${msg.body.length} characters; the content is in an attachment the model cannot read.`);
  }

  return { ...base, kind: 'work', asks, confidence: Math.round(confidence * 100) / 100, rationale: why.join(' ') || 'Single ask.' };
}
