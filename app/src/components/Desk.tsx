import { useState } from 'react';
import type { Ask, StatePayload } from '../../shared/types.ts';
import { fmtAge } from '../../shared/time.ts';
import type { Run } from '../App.tsx';
import {
  collisions, decidedNotTold, dueText, exposureText, isHeld, isOpen, ownerText, pastClaimLimit, sortAsks, STATUS_LABEL,
} from '../lib.ts';
import AskDetail from './AskDetail.tsx';

type Filter = 'open' | 'mine' | 'unclaimed' | 'held' | 'untold' | 'closed';

export default function Desk({ data, user, run, selected, setSelected }: {
  data: StatePayload; user: string; run: Run; selected: string | null; setSelected: (id: string | null) => void;
}) {
  const [filter, setFilter] = useState<Filter>('open');
  const { state, now } = data;
  const open = state.asks.filter(isOpen);

  const counts = {
    open: open.length,
    mine: open.filter((a) => a.owner === user).length,
    unclaimed: open.filter((a) => !a.owner).length,
    held: open.filter(isHeld).length,
    untold: open.filter(decidedNotTold).length,
    closed: state.asks.length - open.length,
  };
  const pastLimit = open.filter((a) => pastClaimLimit(a, now)).length;

  const filters: Record<Filter, (a: Ask) => boolean> = {
    open: isOpen,
    mine: (a) => isOpen(a) && a.owner === user,
    unclaimed: (a) => isOpen(a) && !a.owner,
    held: isHeld,
    untold: decidedNotTold,
    closed: (a) => !isOpen(a),
  };
  const rows = sortAsks(state.asks.filter(filters[filter]), now);
  const atStake = open.filter((a) => a.exposure).map((a) => ({ id: a.id, text: exposureText(a.exposure)!, title: a.title }));
  const ask = state.asks.find((a) => a.id === selected) ?? null;

  const stat = (f: Filter, n: number, label: string, tone = '') => (
    <button className={`stat ${tone} ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
      <span className="n">{n}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div className={ask ? 'desk split' : 'desk'}>
      <section className="list">
        <div className="stats">
          {stat('open', counts.open, 'open')}
          {stat('unclaimed', counts.unclaimed, `unclaimed${pastLimit ? `, ${pastLimit} past limit` : ''}`, pastLimit ? 'warn' : '')}
          {stat('held', counts.held, 'held by a control', counts.held ? 'lock' : '')}
          {stat('untold', counts.untold, 'decided, not told', counts.untold ? 'warn' : '')}
          {stat('mine', counts.mine, `mine (${user})`)}
          {stat('closed', counts.closed, 'closed')}
        </div>
        {atStake.length > 0 && (
          <div className="stake">
            <span className="muted">Money at stake:</span>
            {atStake.map((s) => (
              <button key={s.id} className="chip money" onClick={() => setSelected(s.id)} title={s.title}>{s.text}</button>
            ))}
          </div>
        )}

        <table className="asks">
          <thead>
            <tr>
              <th>Ask</th>
              <th>Who is waiting</th>
              <th>Owner</th>
              <th title="Measured from the earliest date in the content, not from when it reached the desk">Age</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const due = dueText(a.due, now);
              const past = pastClaimLimit(a, now);
              const coll = collisions(a);
              return (
                <tr key={a.id} className={`${a.id === selected ? 'sel' : ''} risk-${a.risk}`} onClick={() => setSelected(a.id === selected ? null : a.id)}>
                  <td className="title-cell">
                    <div className="t">
                      <span className={`dot ${a.risk}`} title={`${a.risk} risk: ${a.risk_reason}`} />
                      {a.title}
                    </div>
                    <div className="badges">
                      <span className="id">{a.id}</span>
                      {isHeld(a) && <span className="chip lock">Held: {a.controlled.length > 1 ? `${a.controlled.length} controls` : a.controlled[0].replace('_', ' ')}</span>}
                      {a.flags.some((f) => f.startsWith('Sender domain')) && <span className="chip danger">Domain mismatch</span>}
                      {a.messages.some((m) => m.role === 'escalation') && <span className="chip danger">Escalated</span>}
                      {a.chase_count > 0 && <span className="chip warn">Chased {a.chase_count}x</span>}
                      {a.messages.filter((m) => m.role === 'duplicate').length > 0 && <span className="chip">{a.messages.filter((m) => m.role === 'duplicate').length + 1} sources merged</span>}
                      {coll.length > 0 && <span className="chip collide">Also replied: {[...new Set(coll.map((c) => c.person))].join(', ')}</span>}
                      {a.redirect_suggested && isOpen(a) && <span className="chip">Suggest: redirect to {a.redirect_suggested}</span>}
                      {a.exposure && <span className="chip money">{exposureText(a.exposure)}</span>}
                    </div>
                  </td>
                  <td>{a.waiting.map((w) => w.name).join(', ')}</td>
                  <td className={past ? 'past' : a.owner ? '' : 'muted'}>
                    {ownerText(a, now)}
                    {!a.owner && a.suggested_owner && <div className="hint">suggested: {a.suggested_owner}</div>}
                  </td>
                  <td title={a.received_source}>{fmtAge(a.received_at, now)}</td>
                  <td className={due?.urgent ? 'urgent' : ''}>{due?.text ?? '-'}</td>
                  <td>
                    <span className={`status ${a.status}`}>{STATUS_LABEL[a.status]}</span>
                    {decidedNotTold(a) && <div className="hint danger-text">not told</div>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="empty">Nothing here.</td></tr>
            )}
          </tbody>
        </table>
        {state.untracked_closures.length > 0 && filter === 'closed' && (
          <div className="untracked">
            <h4>Closures for work never tracked here</h4>
            {state.untracked_closures.map((c) => (
              <div key={c.message_id} className="muted">{c.message_id}: "{c.note}" (recorded by {c.by})</div>
            ))}
          </div>
        )}
      </section>

      {ask && <AskDetail key={ask.id} ask={ask} data={data} user={user} run={run} close={() => setSelected(null)} open={setSelected} />}
    </div>
  );
}
