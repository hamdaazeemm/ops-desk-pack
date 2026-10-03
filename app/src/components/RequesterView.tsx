import { useState } from 'react';
import type { StatePayload } from '../../shared/types.ts';
import { fmtDay, fmtTime } from '../../shared/time.ts';
import { isOpen, requesterLine } from '../lib.ts';

/** What a requester sees instead of sending "any update?" (msg-036). Read-only, plain words. */
export default function RequesterView({ data, user }: { data: StatePayload; user: string }) {
  const { state, now, messages } = data;
  const people = new Map<string, string>();
  for (const a of state.asks) for (const r of a.requesters) people.set(r.email, r.name);
  const junaid = [...people.entries()].find(([, n]) => n.startsWith('Junaid'))?.[0];
  const [email, setEmail] = useState(junaid ?? [...people.keys()][0]);

  const mine = state.asks.filter((a) => a.requesters.some((r) => r.email === email));
  const lastActivity = (id: string) => {
    const ev = state.audit.filter((e) => e.ask_id === id).at(-1);
    return ev ? `${ev.action} ${fmtTime(ev.at)}` : '';
  };

  return (
    <div className="page requester">
      <div className="row">
        <h2>Your requests to the ops desk</h2>
        <select value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Requester">
          {[...people.entries()].map(([e, n]) => <option key={e} value={e}>{n}</option>)}
        </select>
      </div>
      <p className="muted lead">
        {user === 'Junaid' ? 'This is all you need to check.' : `Shown as ${people.get(email)} would see it.`} No login to the desk, no categories to pick.
        You keep emailing ops@ in plain language; this page shows where each thing sits.
      </p>
      <div className="req-list">
        {mine.map((a) => {
          const fromMsgs = a.messages.filter((m) => messages.find((x) => x.id === m.message_id)?.from.email === email);
          return (
            <div key={a.id} className={`req ${isOpen(a) ? '' : 'closed'} ${!a.owner && isOpen(a) ? 'nobody' : ''}`}>
              <div className="req-title">{a.title}</div>
              <div className="req-line">{requesterLine(a, now)}</div>
              <div className="muted small-text">
                From your {fromMsgs.map((m) => m.message_id).join(', ')}
                {a.due && ` - due ${fmtDay(a.due)}`}
                {lastActivity(a.id) && ` - last movement: ${lastActivity(a.id)}`}
              </div>
            </div>
          );
        })}
        {mine.length === 0 && <div className="empty">No requests.</div>}
      </div>
    </div>
  );
}
