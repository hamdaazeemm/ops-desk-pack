import { useState } from 'react';
import type { Ask, Controlled, StatePayload } from '../../shared/types.ts';
import { fmtDay, fmtDesk, fmtTime, fmtWorkingMins } from '../../shared/time.ts';
import type { Run } from '../App.tsx';
import {
  claimLimit, collisions, CONTROLLED_LABEL, decidedNotTold, draftToldMessage, dueText, exposureText, heldKinds, isOpen,
  pastClaimLimit, STATUS_LABEL, STEPS, unclaimedMins,
} from '../lib.ts';
import MessageCard from './MessageCard.tsx';
import LiveTriage from './LiveTriage.tsx';

const PREREQ: Record<Controlled, { label: string; placeholder: string; release: string }> = {
  data_room: {
    label: 'Executed NDA recorded against this counterparty',
    placeholder: 'e.g. NDA executed by both sides 13 Mar, countersigned copy filed: Legal/Meridian/NDA-final.pdf',
    release: 'Grant data room access',
  },
  bank_details: {
    label: 'Phone verification on a number already on file - never one from the email',
    placeholder: 'e.g. Called +92 42 3577 1100 (vendor master), spoke to [name], Accounts. Confirmed / denied the change.',
    release: 'Action the bank-detail change',
  },
  new_vendor: {
    label: 'Vendor onboarding checks completed',
    placeholder: 'e.g. Registration and NTN checked on FBR portal; 2 references called; bank letter verified by phone',
    release: 'Add to vendor master',
  },
  letterhead: {
    label: 'Approval from an authorised signatory',
    placeholder: 'e.g. Tariq Mehmood approved the authority letter for KHI-88190 by phone 17:40',
    release: 'Release the signed letter',
  },
};

const COORDINATORS = ['Omar', 'Ayesha', 'Bilal', 'Daniyal'];

export default function AskDetail({ ask, data, user, run, close, open }: {
  ask: Ask; data: StatePayload; user: string; run: Run; close: () => void; open: (id: string) => void;
}) {
  const { now, messages, state } = data;
  const due = dueText(ask.due, now);
  const coll = collisions(ask);
  const history = state.audit.filter((e) => e.ask_id === ask.id).slice().reverse();
  const stepIndex = ask.status === 'redirected' ? -1 : STEPS.indexOf(ask.status);
  const vendor = data.vendors.find((v) => v.match.some((m) => `${ask.title} ${ask.summary} ${ask.waiting.map((w) => w.name).join(' ')}`.toLowerCase().includes(m)));

  return (
    <aside className="detail">
      <div className="detail-head">
        <div>
          <span className="id">{ask.id}</span> <span className="muted">{ask.category.replace('_', ' ')}</span>
          <h2>{ask.title}</h2>
        </div>
        <button className="ghost" onClick={close} aria-label="Close">Close</button>
      </div>

      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''}>{STATUS_LABEL[s]}</li>
        ))}
        {ask.status === 'redirected' && <li className="current">Redirected to {ask.redirected_to}</li>}
      </ol>

      {decidedNotTold(ask) && (
        <div className="banner danger">
          <strong>Decided, but not done.</strong> {ask.decision!.by} decided at {fmtTime(ask.decision!.at)}: "{ask.decision!.text}".{' '}
          {ask.waiting.filter((w) => !w.told_at).map((w) => w.name).join(', ')} has not been told, so this stays open.
          {ask.exposure?.per === 'day' && ` ${exposureText(ask.exposure)} keeps running until they are.`}
        </div>
      )}
      {coll.length > 0 && (
        <div className="banner warn">
          <strong>Someone else is already in this thread.</strong>{' '}
          {coll.map((c) => `${c.person} replied ${fmtTime(c.at)}`).join('; ')} - {ask.owner} owns it. Check before replying.
        </div>
      )}
      {pastClaimLimit(ask, now) && (
        <div className="banner warn">
          <strong>Unclaimed for {fmtWorkingMins(unclaimedMins(ask, now))}</strong> of desk time (limit {fmtWorkingMins(claimLimit(ask))} for {ask.risk === 'high' || ask.controlled.length ? 'high-risk or controlled asks' : 'this ask'}). You are covering: claim it or hand it on.
        </div>
      )}

      <p className="summary">{ask.summary}</p>

      <dl className="facts">
        <dt>Waiting for an answer</dt>
        <dd>
          {ask.waiting.map((w, i) => (
            <div key={i}>
              {w.name}{' '}
              {w.told_at ? <span className="chip ok">told {fmtTime(w.told_at)} by {w.told_by}, {w.channel}</span> : <span className="chip">not told</span>}
            </div>
          ))}
        </dd>
        <dt>Age measured from</dt>
        <dd>{fmtDesk(ask.received_at).slice(0, -6)} <span className="muted">- {ask.received_source}</span></dd>
        {ask.due && (
          <>
            <dt>Due</dt>
            <dd className={due?.urgent ? 'urgent' : ''}>{fmtDay(ask.due)} ({due?.text}) {ask.due_source && <span className="muted">- "{ask.due_source}"</span>}</dd>
          </>
        )}
        <dt>Risk</dt>
        <dd><span className={`dot ${ask.risk}`} /> {ask.risk} <span className="muted">- {ask.risk_reason}</span></dd>
        {ask.exposure && (
          <>
            <dt>Money at stake</dt>
            <dd className="money-text">{exposureText(ask.exposure)} <span className="muted">- {ask.exposure.note}</span></dd>
          </>
        )}
      </dl>

      {ask.flags.length > 0 && (
        <ul className="flags">
          {ask.flags.map((f) => <li key={f}>{f}</li>)}
        </ul>
      )}
      {ask.linked.length > 0 && (
        <div className="linked">
          Linked:{' '}
          {ask.linked.map((id) => {
            const l = state.asks.find((a) => a.id === id);
            return l ? <button key={id} className="link" onClick={() => open(id)}>{id} {l.title}</button> : null;
          })}
        </div>
      )}

      <Owner ask={ask} user={user} run={run} now={now} />

      {ask.controlled.map((k) => <Gate key={k} ask={ask} kind={k} run={run} phone={k === 'bank_details' ? vendor?.phone_on_file : undefined} />)}
      {ask.overrides.map((o, i) => (
        <div key={i} className="override-note">
          Category "{CONTROLLED_LABEL[o.kind]}" removed by {o.by} at {fmtTime(o.at)}. Reason: {o.reason}
        </div>
      ))}

      {isOpen(ask) && <NextStep ask={ask} data={data} user={user} run={run} />}

      <h3>Messages</h3>
      {ask.messages.map((m) => {
        const msg = messages.find((x) => x.id === m.message_id)!;
        return (
          <MessageCard key={m.message_id + m.role} msg={msg} role={m.role} note={m.note}
            action={m.role === 'duplicate' ? (
              <button className="ghost small" onClick={() => run({ type: 'detach', ask_id: ask.id, message_id: m.message_id })} title="The model merged this wrongly: make it its own ask">
                Wrong merge? Detach
              </button>
            ) : undefined}
          />
        );
      })}

      {(ask.outbound ?? []).map((o, i) => (
        <div key={i} className="msg sent">
          <div className="msg-head">
            <span className="chip ok">sent by {o.by} (simulated)</span>
            <span className="from">{o.mode === 'reply' ? 'Reply' : 'New email'} to {o.to}</span>
            <span className="muted">{fmtDesk(o.at)}</span>
            {o.told && <span className="chip ok">told {o.told}</span>}
          </div>
          <div className="msg-subject">{o.subject}</div>
          <pre className="small-text">{o.body}</pre>
        </div>
      ))}

      <h3>Model</h3>
      <div className="model-box">
        <div>
          Confidence <strong>{ask.model.confidence.toFixed(2)}</strong> <span className="muted">by {ask.model.provider}</span>
        </div>
        <div className="muted">{ask.model.rationale}</div>
        <div className="row">
          {ask.suggested_owner && <span className="chip">Suggested owner: {ask.suggested_owner} (suggestion only)</span>}
          {ask.redirect_suggested && <span className="chip">Suggested redirect: {ask.redirect_suggested}</span>}
        </div>
        <FileAsNoise ask={ask} run={run} />
        <LiveTriage messageId={ask.messages[0].message_id} live={data.live_model} />
      </div>

      <h3>History</h3>
      <ul className="history">
        {history.map((e) => (
          <li key={e.id}>
            <span className="muted">{fmtDesk(e.at)}</span> <span className={`actor ${e.actor_type}`}>{e.actor}</span> <strong>{e.action}</strong> - {e.detail}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Owner({ ask, user, run, now }: { ask: Ask; user: string; run: Run; now: string }) {
  const [replier, setReplier] = useState(COORDINATORS.includes(user) ? user : 'Omar');
  return (
    <div className="block">
      <h3>Owner</h3>
      {ask.owner ? (
        <div className="row">
          <span>
            <strong>{ask.owner}</strong>{' '}
            <span className="muted">
              {ask.owner_source === 'reply' ? 'claimed by replying in Outlook' : 'claimed here'}
              {ask.owned_at && ` at ${fmtTime(ask.owned_at)}`}
            </span>
          </span>
          {isOpen(ask) && (ask.owner === user
            ? <button className="ghost small" onClick={() => run({ type: 'unclaim', ask_id: ask.id })}>Release</button>
            : <button className="small" onClick={() => run({ type: 'claim', ask_id: ask.id })}>Take over</button>)}
        </div>
      ) : (
        <div className="row">
          <span className="muted">
            Nobody owns this. {ask.suggested_owner && <>The model suggests <strong>{ask.suggested_owner}</strong>; that is not ownership.</>}
          </span>
          {isOpen(ask) && <button onClick={() => run({ type: 'claim', ask_id: ask.id })}>Claim</button>}
        </div>
      )}
      {isOpen(ask) && (
        <div className="row sim">
          <span className="muted" title="Omar's path: he replies in Outlook and never opens this screen. The mailbox connection would report it; this button stands in for that.">Replied in Outlook, not here:</span>
          <select value={replier} onChange={(e) => setReplier(e.target.value)}>
            {COORDINATORS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="ghost small" onClick={() => run({ type: 'reply', ask_id: ask.id, person: replier })}>
            replies from the shared mailbox
          </button>
        </div>
      )}
    </div>
  );
}

function Gate({ ask, kind, run, phone }: { ask: Ask; kind: Controlled; run: Run; phone?: string }) {
  const [detail, setDetail] = useState('');
  const [reason, setReason] = useState('');
  const [overriding, setOverriding] = useState(false);
  const p = PREREQ[kind];
  const prereqs = ask.prerequisites.filter((x) => x.kind === kind);
  const released = ask.released.find((r) => r.kind === kind);
  const held = heldKinds(ask).includes(kind);

  return (
    <div className={`gate ${held ? 'held' : 'clear'}`}>
      <div className="gate-head">
        <strong>Controlled: {CONTROLLED_LABEL[kind]}</strong>
        <span className={held ? 'chip lock' : 'chip ok'}>{released ? 'Released' : held ? 'Held' : ''}</span>
      </div>
      <div className="muted">Required first: {p.label}.</div>
      {phone && <div className="phone">Number on file: <strong>{phone}</strong></div>}

      {prereqs.map((x, i) => (
        <div key={i} className="prereq">Recorded by {x.by} at {fmtTime(x.at)}: {x.detail}</div>
      ))}

      {released ? (
        <div className="prereq ok-text">{p.release}: released by {released.by} at {fmtTime(released.at)}.</div>
      ) : prereqs.length ? (
        <button className="release" onClick={() => run({ type: 'release', ask_id: ask.id, kind })}>{p.release}</button>
      ) : (
        <>
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={p.placeholder} rows={2} />
          <div className="row">
            <button className="small" disabled={detail.trim().length < 10} onClick={async () => (await run({ type: 'prerequisite', ask_id: ask.id, kind, detail })) && setDetail('')}>
              Record prerequisite
            </button>
            <span className="unavailable">"{p.release}" is unavailable until this is recorded.</span>
          </div>
        </>
      )}

      {!released && (overriding ? (
        <div className="row">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this is not a controlled case (goes in the audit log)" />
          <button className="small danger" disabled={reason.trim().length < 5} onClick={() => run({ type: 'override', ask_id: ask.id, kind, reason })}>Remove category</button>
          <button className="ghost small" onClick={() => setOverriding(false)}>Cancel</button>
        </div>
      ) : (
        <button className="link small" onClick={() => setOverriding(true)}>Model wrong? This is not a {CONTROLLED_LABEL[kind].toLowerCase()} case</button>
      ))}
    </div>
  );
}

function NextStep({ ask, data, user, run }: { ask: Ask; data: StatePayload; user: string; run: Run }) {
  const [decision, setDecision] = useState('');
  const [waitingOn, setWaitingOn] = useState('');
  const [channel, setChannel] = useState('Email from ops@ in Outlook');
  const [redirectTo, setRedirectTo] = useState(ask.redirect_suggested ?? '');
  const [mode, setMode] = useState<'none' | 'decide' | 'wait' | 'redirect'>('none');
  const untold = ask.waiting.map((w, i) => ({ w, i })).filter(({ w }) => !w.told_at);
  const allTold = untold.length === 0;
  const held = heldKinds(ask);

  return (
    <div className="block next">
      <h3>Next step</h3>

      <Compose ask={ask} data={data} user={user} run={run} />

      {untold.length > 0 && (
        <div className="told">
          <div className="muted small-text">Told them another way (phone, in person, from Outlook)? Record it here.</div>
          <input value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="How they were told" />
          {untold.map(({ w, i }) => (
            <button key={i} className="ghost" onClick={() => run({ type: 'told', ask_id: ask.id, party: i, channel })}>
              Record that {w.name} was told
            </button>
          ))}
        </div>
      )}

      {allTold ? (
        held.length ? (
          <div className="unavailable">Resolve is unavailable: {held.map((k) => CONTROLLED_LABEL[k]).join(', ')} is still held.</div>
        ) : (
          <button className="resolve" onClick={() => run({ type: 'resolve', ask_id: ask.id })}>Mark resolved</button>
        )
      ) : (
        <div className="unavailable">Resolved becomes available once everyone waiting has been told ({untold.map((u) => u.w.name).join(', ')}).</div>
      )}

      {ask.status !== 'decided' && (
        <div className="row actions">
          <button className="ghost small" onClick={() => setMode(mode === 'wait' ? 'none' : 'wait')}>Waiting on...</button>
          <button className="ghost small" onClick={() => setMode(mode === 'decide' ? 'none' : 'decide')}>Record decision...</button>
          <button className="ghost small" onClick={() => setMode(mode === 'redirect' ? 'none' : 'redirect')}>Redirect...</button>
        </div>
      )}
      {mode === 'wait' && (
        <div className="row">
          <input value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} placeholder="e.g. Finance, payment run date" />
          <button className="small" onClick={async () => (await run({ type: 'set_waiting', ask_id: ask.id, on: waitingOn })) && setMode('none')}>Save</button>
        </div>
      )}
      {mode === 'decide' && (
        <div className="row">
          <input value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="The decision, in the words the waiting party should receive" />
          <button className="small" onClick={async () => (await run({ type: 'decide', ask_id: ask.id, text: decision })) && setMode('none')}>Record</button>
        </div>
      )}
      {mode === 'redirect' && (
        <div className="row">
          <select value={redirectTo} onChange={(e) => setRedirectTo(e.target.value)}>
            <option value="">Send to...</option>
            {['HR', 'Investor Relations', 'Finance', 'IT', 'Compliance', 'Legal'].map((t) => <option key={t}>{t}</option>)}
          </select>
          <button className="small" disabled={!redirectTo} onClick={() => run({ type: 'redirect', ask_id: ask.id, to: redirectTo, channel })}>
            Redirect and record sender told
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Write the email on the ask and send it through the shared mailbox. In the slice the send is simulated:
 * nothing leaves the laptop, but the desk records it exactly as a real send would (claim, reply, told).
 */
function Compose({ ask, data, user, run }: { ask: Ask; data: StatePayload; user: string; run: Run }) {
  const src = data.messages.find((m) => m.id === ask.messages[0]?.message_id);
  const untold = ask.waiting.map((w, i) => ({ w, i })).filter(({ w }) => !w.told_at);
  const first = untold[0] ?? (ask.waiting[0] ? { w: ask.waiting[0], i: 0 } : null);
  const [open, setOpen] = useState(ask.status === 'decided');
  const [mode, setMode] = useState<'reply' | 'new'>('reply');
  const [toIdx, setToIdx] = useState<number | 'other'>(first ? first.i : 'other');
  const [other, setOther] = useState('');
  const [subject, setSubject] = useState(src ? `RE: ${src.subject.replace(/^((re|fwd?):\s*)+/i, '')}` : '');
  const [body, setBody] = useState(ask.status === 'decided' && first ? draftToldMessage(ask, first.w.name, user, data.messages) : '');
  const [marksTold, setMarksTold] = useState(ask.status === 'decided');
  const held = heldKinds(ask);

  const party = toIdx === 'other' ? null : ask.waiting[toIdx];
  const to = party ? `${party.name}${party.email ? ` <${party.email}>` : ''}` : other;

  if (!open) {
    return (
      <div className="row">
        <button onClick={() => setOpen(true)}>Write a reply</button>
        <button className="ghost" onClick={() => { setMode('new'); setToIdx('other'); setSubject(''); setOpen(true); }}>New email</button>
        <span className="muted small-text">Sent through ops@ in Outlook. Simulated in this demo.</span>
      </div>
    );
  }

  return (
    <div className="compose">
      <div className="row">
        <button className={mode === 'reply' ? 'small' : 'ghost small'} onClick={() => { setMode('reply'); if (src) setSubject(`RE: ${src.subject.replace(/^((re|fwd?):\s*)+/i, '')}`); }}>Reply on the thread</button>
        <button className={mode === 'new' ? 'small' : 'ghost small'} onClick={() => { setMode('new'); setSubject(''); }}>New email</button>
        <span className="muted small-text">from ops@pentlandinfra.com as {user}</span>
      </div>
      <div className="row">
        <label className="lbl">To</label>
        <select value={String(toIdx)} onChange={(e) => setToIdx(e.target.value === 'other' ? 'other' : Number(e.target.value))}>
          {ask.waiting.map((w, i) => <option key={i} value={i}>{w.name}{w.email ? ` <${w.email}>` : ''}{w.told_at ? ' (already told)' : ''}</option>)}
          <option value="other">Someone else...</option>
        </select>
        {toIdx === 'other' && <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="name@company.com" />}
      </div>
      <div className="row">
        <label className="lbl">Subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write it in plain words. No category, no priority." />
      {party && !party.told_at && (
        <label className="check">
          <input type="checkbox" checked={marksTold} onChange={(e) => setMarksTold(e.target.checked)} />
          This email tells {party.name} the outcome (records "told"). Leave unticked for "we are looking into it".
        </label>
      )}
      {held.length > 0 && (
        <div className="banner warn small-text">
          Held: {held.map((k) => CONTROLLED_LABEL[k].toLowerCase()).join(', ')}. You can reply, but do not grant, confirm or commit anything in this email until the prerequisite is recorded above. The send is logged as "sent while held".
        </div>
      )}
      <div className="row">
        <button disabled={!body.trim() || !to.trim()} onClick={async () => {
          const ok = await run({ type: 'send', ask_id: ask.id, to, subject, body, mode, told_party: party && !party.told_at && marksTold ? toIdx : null });
          if (ok) { setOpen(false); setBody(''); }
        }}>
          Send via ops@ (simulated)
        </button>
        <button className="ghost small" onClick={() => setOpen(false)}>Cancel</button>
        <span className="muted small-text">Sending claims the ask for you if nobody owns it.</span>
      </div>
    </div>
  );
}

function FileAsNoise({ ask, run }: { ask: Ask; run: Run }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open) return <button className="link small" onClick={() => setOpen(true)}>Not real work? File as noise</button>;
  return (
    <div className="row">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (audited; restorable from Noise)" />
      <button className="small danger" onClick={() => run({ type: 'file_noise', ask_id: ask.id, reason })}>File as noise</button>
      <button className="ghost small" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}
