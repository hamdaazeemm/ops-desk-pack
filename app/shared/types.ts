export type Person = { name: string; email: string };

export type Message = {
  id: string;
  thread_id: string;
  timestamp: string;
  from: Person;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  attachments: string[];
};

export type Controlled = 'data_room' | 'bank_details' | 'new_vendor' | 'letterhead';
export type Risk = 'low' | 'medium' | 'high';

export type Exposure = {
  amount: number;
  currency: 'PKR' | 'USD';
  per: 'day' | 'once';
  from: string | null;
  note: string;
} | null;

/* ---------- What the model returns, per message ---------- */

export type ModelAsk = {
  title: string;
  summary: string;
  category: string;
  controlled: Controlled[];
  risk: Risk;
  risk_reason: string;
  exposure: Exposure;
  due: string | null;
  due_source: string | null;
  original_date: string | null;
  original_date_source: string | null;
  requester: Person;
  waiting_party: { name: string; email: string | null };
  suggested_owner: string | null;
  redirect_to: string | null;
  /** "msg-003#0": this ask is the same ask as an earlier one */
  same_as: string | null;
  /** "msg-003#0": related but distinct (e.g. bank change vs invoice) */
  related_to: string | null;
};

export type UpdateType = 'chaser' | 'decision' | 'escalation' | 'closure' | 'info';

export type ModelUpdate = {
  target: string | null;
  type: UpdateType;
  note: string;
};

export type TriageOutput = {
  message_id: string;
  kind: 'work' | 'update' | 'noise';
  noise_reason: string | null;
  asks: ModelAsk[];
  updates: ModelUpdate[];
  confidence: number;
  rationale: string;
};

export type TriageRecord = {
  output: TriageOutput | null;
  provider: string;
  model: string;
  error?: string;
  latency_ms?: number;
  tokens?: { input: number; output: number };
};

export type TriageCache = {
  generated_at: string;
  provider: string;
  model: string;
  results: Record<string, TriageRecord>;
};

/* ---------- Desk state ---------- */

export type Status = 'new' | 'claimed' | 'waiting' | 'decided' | 'told' | 'resolved' | 'redirected';

export type MsgRole = 'source' | 'duplicate' | 'chaser' | 'decision' | 'escalation' | 'closure' | 'info';

export type WaitingParty = {
  name: string;
  email: string | null;
  told_at: string | null;
  told_by: string | null;
  channel: string | null;
  from_message: string;
};

export type Prerequisite = { kind: Controlled; by: string; at: string; detail: string };

export type Ask = {
  id: string;
  title: string;
  summary: string;
  category: string;
  controlled: Controlled[];
  overrides: { kind: Controlled; by: string; at: string; reason: string }[];
  risk: Risk;
  risk_reason: string;
  exposure: Exposure;
  due: string | null;
  due_source: string | null;
  received_at: string;
  received_source: string;
  desk_arrival: string;
  requesters: Person[];
  waiting: WaitingParty[];
  owner: string | null;
  owner_source: 'claim' | 'reply' | null;
  owned_at: string | null;
  suggested_owner: string | null;
  status: Status;
  waiting_on: string | null;
  decision: { text: string; by: string; at: string } | null;
  redirect_suggested: string | null;
  redirected_to: string | null;
  messages: { message_id: string; role: MsgRole; ask_ref: string | null; note?: string }[];
  repliers: { person: string; at: string }[];
  chase_count: number;
  prerequisites: Prerequisite[];
  released: { kind: Controlled; by: string; at: string }[];
  flags: string[];
  linked: string[];
  model: { confidence: number; rationale: string; provider: string };
  created_at: string;
};

export type NoiseEntry = { message_id: string; reason: string; confidence: number | null; by: string; at: string };

export type ReviewEntry = { message_id: string; reason: string; output: TriageOutput | null };

export type UntrackedClosure = { message_id: string; note: string; at: string; by: string };

export type AuditEvent = {
  id: number;
  at: string;
  actor: string;
  actor_type: 'person' | 'model' | 'rule';
  action: string;
  ask_id?: string;
  message_id?: string;
  detail: string;
};

export type DeskState = {
  clock_offset_min: number;
  asks: Ask[];
  noise: NoiseEntry[];
  review: ReviewEntry[];
  untracked_closures: UntrackedClosure[];
  audit: AuditEvent[];
  ref_map: Record<string, string>;
  next_ask: number;
  next_event: number;
  triage: { provider: string; model: string; generated_at: string };
};

export type User = { name: string; role: 'coordinator' | 'requester' | 'compliance' | 'md'; note?: string };

export type StatePayload = {
  state: DeskState;
  messages: Message[];
  users: User[];
  now: string;
  live_model: { available: boolean; provider: string; reason: string };
  vendors: { name: string; match: string[]; domains: string[]; phone_on_file: string }[];
};
