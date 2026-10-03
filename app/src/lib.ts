import type { Ask, Controlled, Exposure, Message, Status } from '../shared/types.ts';
import { daysUntil, fmtAge, fmtDay, fmtTime, fmtWorkingMins, workingMinutesBetween } from '../shared/time.ts';

export const CONTROLLED_LABEL: Record<Controlled, string> = {
  data_room: 'Data room access',
  bank_details: 'Bank details / payment instruction',
  new_vendor: 'New vendor',
  letterhead: 'Commitment on letterhead',
};

export const STATUS_LABEL: Record<Status, string> = {
  new: 'New', claimed: 'Claimed', waiting: 'Waiting', decided: 'Decided', told: 'Told', resolved: 'Resolved', redirected: 'Redirected',
};

export const STEPS: Status[] = ['new', 'claimed', 'waiting', 'decided', 'told', 'resolved'];

export const isOpen = (a: Ask) => a.status !== 'resolved' && a.status !== 'redirected';
export const heldKinds = (a: Ask) => a.controlled.filter((c) => !a.released.some((r) => r.kind === c));
export const isHeld = (a: Ask) => isOpen(a) && heldKinds(a).length > 0;
export const decidedNotTold = (a: Ask) => a.status === 'decided' && a.waiting.some((w) => !w.told_at);
export const collisions = (a: Ask) => a.repliers.filter((r) => a.owner && r.person !== a.owner);

/** DECISIONS D3: 30 working minutes for high-risk or controlled asks, 2 working hours otherwise. */
export const claimLimit = (a: Ask) => (a.risk === 'high' || a.controlled.length ? 30 : 120);
export const unclaimedMins = (a: Ask, now: string) => workingMinutesBetween(a.desk_arrival, now);
export const pastClaimLimit = (a: Ask, now: string) => isOpen(a) && !a.owner && unclaimedMins(a, now) > claimLimit(a);

export function exposureText(e: Exposure): string | null {
  if (!e) return null;
  const amt = e.amount >= 1_000_000 ? `${(e.amount / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}m` : e.amount.toLocaleString('en-US');
  return `${e.currency} ${amt}${e.per === 'day' ? '/day' : ''}${e.from ? ` from ${fmtDay(e.from)}` : ''}`;
}

export function dueText(due: string | null, now: string): { text: string; urgent: boolean } | null {
  if (!due) return null;
  const d = daysUntil(due, now);
  const label = d < 0 ? `${-d}d overdue` : d === 0 ? 'today' : d === 1 ? 'tomorrow' : fmtDay(due);
  return { text: label, urgent: d <= 1 };
}

export function sortAsks(asks: Ask[], now: string): Ask[] {
  const score = (a: Ask) => {
    let s = 0;
    if (!isOpen(a)) s -= 1000;
    if (pastClaimLimit(a, now)) s += 100;
    if (decidedNotTold(a)) s += 60;
    if (a.risk === 'high') s += 40;
    else if (a.risk === 'medium') s += 20;
    const due = a.due ? daysUntil(a.due, now) : null;
    if (due !== null && due <= 1) s += 50;
    if (a.chase_count) s += 10 * a.chase_count;
    if (a.messages.some((m) => m.role === 'escalation')) s += 30;
    return s;
  };
  return [...asks].sort((x, y) => score(y) - score(x) || x.received_at.localeCompare(y.received_at));
}

export function ownerText(a: Ask, now: string): string {
  if (a.owner) return `${a.owner}${a.owner_source === 'reply' ? ' (replied)' : ''}`;
  return `Unclaimed ${fmtWorkingMins(unclaimedMins(a, now))}`;
}

/** Junaid's view: plain words, no internal jargon (DECISIONS D10). */
export function requesterLine(a: Ask, now: string): string {
  if (a.status === 'redirected') return `Not handled by the ops desk: sent to ${a.redirected_to}.`;
  if (a.status === 'resolved') return 'Done. You were told.';
  if (a.status === 'told') return 'Done; closing it off.';
  if (a.status === 'decided') return `Decided by ${a.decision?.by.split(' ')[0]}. ${a.waiting.filter((w) => !w.told_at).map((w) => w.name).join(', ')} not told yet.`;
  if (!a.owner) return `Nobody has picked this up yet (${fmtAge(a.desk_arrival, now)} since it arrived).`;
  if (a.status === 'waiting') return `With ${a.owner}, waiting on ${a.waiting_on}.`;
  return `With ${a.owner} since ${a.owned_at ? fmtTime(a.owned_at) : 'today'}.`;
}

export function draftToldMessage(a: Ask, party: string, sender: string, msgs: Message[]): string {
  const src = msgs.find((m) => m.id === a.messages[0]?.message_id);
  const first = party.split(/\s+/)[0];
  const outcome = a.decision ? a.decision.text : '[outcome]';
  return `Dear ${first},\n\nFurther to your message${src ? ` "${src.subject.replace(/^((re|fwd?):\s*)+/i, '')}"` : ''}: ${outcome}\n\nThis is our written confirmation. Please let us know if you need anything further.\n\nRegards,\n${sender}\nOperations Desk, Pentland Infrastructure Partners`;
}
