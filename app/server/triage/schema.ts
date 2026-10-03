import type { Controlled, ModelAsk, ModelUpdate, TriageOutput } from '../../shared/types.ts';

export const CATEGORIES = [
  'site_access', 'invoice', 'insurance', 'data_room', 'regulatory', 'variation', 'hse_incident',
  'customs', 'bank_change', 'banking_admin', 'vendor_registration', 'investor_reporting', 'hr',
  'audit', 'it', 'general',
] as const;

export const CONTROLLED: Controlled[] = ['data_room', 'bank_details', 'new_vendor', 'letterhead'];

/** JSON shape the model is asked for. Kept next to the validator so they cannot drift. */
export const SCHEMA_TEXT = `{
  "kind": "work" | "update" | "noise",
  "noise_reason": string | null,            // required when kind = "noise"
  "asks": [{                                // new asks in this message; [] if none
    "title": string,                        // short, specific: "Kot Addu gate passes, Thu 19 Mar"
    "summary": string,                      // one sentence: what is being asked, by when
    "category": one of ${CATEGORIES.map((c) => `"${c}"`).join(' | ')},
    "controlled": array of "data_room" | "bank_details" | "new_vendor" | "letterhead",
    "risk": "low" | "medium" | "high",
    "risk_reason": string,
    "exposure": null | { "amount": number, "currency": "PKR" | "USD", "per": "day" | "once", "from": "YYYY-MM-DD" | null, "note": string },
    "due": "YYYY-MM-DD" | null,
    "due_source": string | null,            // exact words the due date came from
    "original_date": "YYYY-MM-DD" | null,   // earliest date this ask existed (forwarded chains, "submitted on")
    "original_date_source": string | null,
    "requester": { "name": string, "email": string },
    "waiting_party": { "name": string, "email": string | null },   // who must be told the outcome
    "suggested_owner": "Omar" | "Ayesha" | "Bilal" | "Daniyal" | null,
    "redirect_to": "HR" | "Investor Relations" | "Finance" | "IT" | null,
    "same_as": string | null,               // ref of an existing ask this is the SAME request as, e.g. "msg-003#0"
    "related_to": string | null             // ref of an existing ask this is related to but distinct from
  }],
  "updates": [{                             // effects on existing asks
    "target": string | null,                // existing ask ref, or null if no tracked ask matches
    "type": "chaser" | "decision" | "escalation" | "closure" | "info",
    "note": string
  }],
  "confidence": number,                     // 0..1, your confidence in this whole output
  "rationale": string                       // one or two sentences a coordinator can check
}`;

const isStr = (v: unknown): v is string => typeof v === 'string';
const strOrNull = (v: unknown) => (isStr(v) && v.trim() ? v : null);
const date = (v: unknown) => (isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export class SchemaError extends Error {}

/** Validates and normalises raw model JSON. Throws SchemaError with a reason the model can act on. */
export function validateOutput(raw: unknown, messageId: string): TriageOutput {
  if (!raw || typeof raw !== 'object') throw new SchemaError('output is not a JSON object');
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (kind !== 'work' && kind !== 'update' && kind !== 'noise') throw new SchemaError(`invalid kind: ${String(kind)}`);
  if (typeof o.confidence !== 'number' || Number.isNaN(o.confidence)) throw new SchemaError('confidence must be a number');
  if (!Array.isArray(o.asks ?? [])) throw new SchemaError('asks must be an array');
  if (!Array.isArray(o.updates ?? [])) throw new SchemaError('updates must be an array');

  const asks: ModelAsk[] = ((o.asks as unknown[]) ?? []).map((a, i) => {
    if (!a || typeof a !== 'object') throw new SchemaError(`asks[${i}] is not an object`);
    const x = a as Record<string, any>;
    if (!isStr(x.title) || !x.title.trim()) throw new SchemaError(`asks[${i}].title missing`);
    const category = (CATEGORIES as readonly string[]).includes(x.category) ? x.category : 'general';
    const controlled = Array.isArray(x.controlled) ? x.controlled.filter((c: unknown) => CONTROLLED.includes(c as Controlled)) : [];
    const risk = ['low', 'medium', 'high'].includes(x.risk) ? x.risk : 'medium';
    let exposure = null;
    if (x.exposure && typeof x.exposure === 'object' && typeof x.exposure.amount === 'number') {
      exposure = {
        amount: x.exposure.amount,
        currency: x.exposure.currency === 'USD' ? 'USD' : 'PKR',
        per: x.exposure.per === 'day' ? 'day' : 'once',
        from: date(x.exposure.from),
        note: isStr(x.exposure.note) ? x.exposure.note : '',
      } as const;
    }
    return {
      title: x.title.trim(),
      summary: isStr(x.summary) ? x.summary : '',
      category,
      controlled,
      risk,
      risk_reason: isStr(x.risk_reason) ? x.risk_reason : '',
      exposure,
      due: date(x.due),
      due_source: strOrNull(x.due_source),
      original_date: date(x.original_date),
      original_date_source: strOrNull(x.original_date_source),
      requester: { name: x.requester?.name ?? 'Unknown', email: x.requester?.email ?? '' },
      waiting_party: { name: x.waiting_party?.name ?? x.requester?.name ?? 'Unknown', email: strOrNull(x.waiting_party?.email) },
      suggested_owner: strOrNull(x.suggested_owner),
      redirect_to: strOrNull(x.redirect_to),
      same_as: strOrNull(x.same_as),
      related_to: strOrNull(x.related_to),
    };
  });

  const updates: ModelUpdate[] = ((o.updates as unknown[]) ?? []).map((u, i) => {
    const x = (u ?? {}) as Record<string, any>;
    if (!['chaser', 'decision', 'escalation', 'closure', 'info'].includes(x.type)) throw new SchemaError(`updates[${i}].type invalid`);
    return { target: strOrNull(x.target), type: x.type, note: isStr(x.note) ? x.note : '' };
  });

  if (kind === 'work' && asks.length === 0) throw new SchemaError('kind is "work" but asks is empty');

  return {
    message_id: messageId,
    kind,
    noise_reason: kind === 'noise' ? (strOrNull(o.noise_reason) ?? 'No reason given') : null,
    asks: kind === 'noise' ? [] : asks,
    updates: kind === 'noise' ? [] : updates,
    confidence: Math.max(0, Math.min(1, o.confidence)),
    rationale: isStr(o.rationale) ? o.rationale : '',
  };
}

/** Pulls the first JSON object out of a model reply (tolerates code fences and preamble). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new SchemaError('no JSON object in reply');
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch (e) {
    throw new SchemaError(`invalid JSON: ${(e as Error).message}`);
  }
}
