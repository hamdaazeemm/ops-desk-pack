import type { StatePayload } from '../../shared/types.ts';
import { fmtTime } from '../../shared/time.ts';
import type { Run } from '../App.tsx';
import MessageCard from './MessageCard.tsx';

export default function Noise({ data, run }: { data: StatePayload; run: Run }) {
  const { state, messages } = data;
  const groups = new Map<string, typeof state.noise>();
  for (const n of state.noise) groups.set(n.reason, [...(groups.get(n.reason) ?? []), n]);

  return (
    <div className="page">
      <h2>Noise</h2>
      <p className="muted lead">
        Filed, never deleted. Throwing away real work costs far more than keeping a newsletter, so every filing has a reason and a
        restore. Short acknowledgements are where the model is most likely to be wrong: "all set now" can be the end of a job.
      </p>

      {state.untracked_closures.length > 0 && (
        <div className="card">
          <h4>Closures for work never tracked here</h4>
          {state.untracked_closures.map((c) => (
            <div key={c.message_id}>{c.message_id}: "{c.note}" <span className="muted">recorded by {c.by} at {fmtTime(c.at)}</span></div>
          ))}
        </div>
      )}

      {[...groups.entries()].map(([reason, items]) => (
        <div key={reason} className="noise-group">
          <h4>{reason} <span className="muted">({items.length})</span></h4>
          {items.map((n) => {
            const msg = messages.find((m) => m.id === n.message_id)!;
            const short = msg.body.length < 120;
            return (
              <MessageCard
                key={n.message_id}
                msg={msg}
                note={`${n.confidence !== null ? `confidence ${n.confidence.toFixed(2)}` : 'filed by a person'} - ${n.by}`}
                action={
                  <div className="row">
                    <button className="ghost small" onClick={() => run({ type: 'restore_noise', message_id: msg.id, as: 'ask' })}>Restore as an ask</button>
                    {short && (
                      <button className="ghost small" onClick={() => run({ type: 'restore_noise', message_id: msg.id, as: 'closure' })}>
                        It closes something: record closure
                      </button>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
