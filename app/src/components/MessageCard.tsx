import { useState, type ReactNode } from 'react';
import type { Message } from '../../shared/types.ts';
import { fmtDesk } from '../../shared/time.ts';

const ROLE_LABEL: Record<string, string> = {
  source: 'source', duplicate: 'same ask, merged', chaser: 'chaser', decision: 'decision',
  escalation: 'escalation', closure: 'closure', info: 'info',
};

export default function MessageCard({ msg, role, note, action, defaultOpen = false }: {
  msg: Message; role?: string; note?: string; action?: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="msg">
      <div className="msg-head" onClick={() => setOpen(!open)}>
        <span className="id">{msg.id}</span>
        {role && <span className={`chip role-${role}`}>{ROLE_LABEL[role] ?? role}</span>}
        <span className="from">{msg.from.name}</span>
        <span className="muted">{fmtDesk(msg.timestamp)}</span>
        <span className="toggle">{open ? 'hide' : 'show'}</span>
      </div>
      <div className="msg-subject">{msg.subject}</div>
      {note && !open && <div className="muted small-text">{note}</div>}
      {open && (
        <div className="msg-body">
          <div className="muted small-text">From {msg.from.email} to {msg.to.join(', ')}{msg.cc.length ? `, cc ${msg.cc.join(', ')}` : ''}</div>
          <pre>{msg.body}</pre>
          {msg.attachments.length > 0 && <div className="muted small-text">Attachments (not readable): {msg.attachments.join(', ')}</div>}
        </div>
      )}
      {action && <div className="msg-action">{action}</div>}
    </div>
  );
}
