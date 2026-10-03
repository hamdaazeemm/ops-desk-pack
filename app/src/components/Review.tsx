import { useState } from 'react';
import type { ReviewEntry, StatePayload } from '../../shared/types.ts';
import type { Run } from '../App.tsx';
import MessageCard from './MessageCard.tsx';
import LiveTriage from './LiveTriage.tsx';

export default function Review({ data, run }: { data: StatePayload; run: Run }) {
  const { state } = data;
  return (
    <div className="page">
      <h2>Needs a look</h2>
      <p className="muted lead">
        The model was not confident enough to act (work below 0.6, noise below 0.85), or the call failed. These are not on the desk
        and not in noise until a person decides. Nothing is dropped.
      </p>
      {state.review.length === 0 && <div className="empty">Nothing waiting.</div>}
      {state.review.map((r) => <ReviewCard key={r.message_id} entry={r} data={data} run={run} />)}
    </div>
  );
}

function ReviewCard({ entry, data, run }: { entry: ReviewEntry; data: StatePayload; run: Run }) {
  const msg = data.messages.find((m) => m.id === entry.message_id)!;
  const proposal = entry.output?.asks[0];
  const [title, setTitle] = useState('');
  return (
    <div className="card">
      <div className="banner warn">{entry.reason}</div>
      <MessageCard msg={msg} defaultOpen />
      {proposal && (
        <div className="muted">
          Model proposal: "{proposal.title}" ({proposal.category}, {proposal.risk} risk)
        </div>
      )}
      <div className="row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={proposal ? 'Optional: a better title (creates a plain ask)' : 'Title for the ask'} />
        <button onClick={() => run({ type: 'review_confirm', message_id: msg.id, title: title || undefined })}>
          {proposal && !title ? 'Confirm model proposal' : 'Create ask'}
        </button>
        <button className="ghost" onClick={() => run({ type: 'review_noise', message_id: msg.id })}>File as noise</button>
      </div>
      <LiveTriage messageId={msg.id} live={data.live_model} />
    </div>
  );
}
