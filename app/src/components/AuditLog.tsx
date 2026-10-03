import { useState } from 'react';
import type { StatePayload } from '../../shared/types.ts';
import { fmtDesk } from '../../shared/time.ts';

export default function AuditLog({ data, openAsk }: { data: StatePayload; openAsk: (id: string) => void }) {
  const [who, setWho] = useState<'all' | 'person' | 'model' | 'rule'>('all');
  const [q, setQ] = useState('');
  const events = data.state.audit
    .filter((e) => who === 'all' || e.actor_type === who)
    .filter((e) => !q || `${e.actor} ${e.action} ${e.detail} ${e.ask_id ?? ''} ${e.message_id ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .slice()
    .reverse();

  return (
    <div className="page">
      <h2>Audit log</h2>
      <p className="muted lead">Every model output, rule and human action, append-only. Elena's question - who released what, on what basis - is answered here.</p>
      <div className="row">
        {(['all', 'person', 'model', 'rule'] as const).map((w) => (
          <button key={w} className={who === w ? 'small' : 'ghost small'} onClick={() => setWho(w)}>{w === 'all' ? 'All' : w === 'person' ? 'People' : w === 'model' ? 'Model' : 'Rules'}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search (e.g. released, override, msg-028)" />
        <span className="muted">{events.length} events</span>
      </div>
      <table className="audit">
        <thead>
          <tr><th>When</th><th>Who</th><th>Action</th><th>Ask</th><th>Detail</th></tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td className="nowrap muted">{fmtDesk(e.at)}</td>
              <td><span className={`actor ${e.actor_type}`}>{e.actor}</span></td>
              <td className="nowrap"><strong>{e.action}</strong></td>
              <td className="nowrap">
                {e.ask_id && <button className="link" onClick={() => openAsk(e.ask_id!)}>{e.ask_id}</button>} {e.message_id && <span className="muted">{e.message_id}</span>}
              </td>
              <td>{e.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
