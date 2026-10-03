import { useCallback, useEffect, useState } from 'react';
import type { StatePayload } from '../shared/types.ts';
import { fmtDesk } from '../shared/time.ts';
import { act, getState, resetDesk } from './api.ts';
import Desk from './components/Desk.tsx';
import Review from './components/Review.tsx';
import Noise from './components/Noise.tsx';
import RequesterView from './components/RequesterView.tsx';
import AuditLog from './components/AuditLog.tsx';

export type Tab = 'desk' | 'review' | 'noise' | 'requester' | 'audit';
export type Run = (action: Record<string, unknown>) => Promise<boolean>;

export default function App() {
  const [data, setData] = useState<StatePayload | null>(null);
  const params = new URLSearchParams(location.search);
  const [user, setUser] = useState(() => params.get('user') ?? localStorage.getItem('desk-user') ?? 'Ayesha');
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) ?? 'desk');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(params.get('ask'));

  useEffect(() => {
    getState().then(setData);
  }, []);

  useEffect(() => {
    localStorage.setItem('desk-user', user);
    if (user === 'Junaid' && !params.get('tab')) setTab('requester');
  }, [user]);

  const run: Run = useCallback(
    async (action) => {
      try {
        setData(await act(user, action));
        setError(null);
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      }
    },
    [user],
  );

  if (!data) return <div className="loading">Loading the desk...</div>;

  const { state } = data;
  const tabs: [Tab, string][] = [
    ['desk', 'Desk'],
    ['review', `Needs a look (${state.review.length})`],
    ['noise', `Noise (${state.noise.length})`],
    ['requester', 'Requester view'],
    ['audit', 'Audit log'],
  ];

  const openAsk = (id: string) => {
    setSelected(id);
    setTab('desk');
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <strong>Pentland Ops Desk</strong>
          <span className="muted">ops@pentlandinfra.com</span>
        </div>
        <div className="clock" title="Demo clock. The pack is one day; the desk opens at the end of it.">
          <span>{fmtDesk(data.now)}</span>
          <button className="ghost small" onClick={() => run({ type: 'advance_clock', minutes: 60 })}>+1 hour</button>
          <button className="ghost small" onClick={() => run({ type: 'advance_clock', minutes: 24 * 60 })}>+1 day</button>
        </div>
        <label className="viewing">
          Viewing as
          <select value={user} onChange={(e) => setUser(e.target.value)}>
            {data.users.map((u) => (
              <option key={u.name} value={u.name}>{u.name} - {u.role}</option>
            ))}
          </select>
        </label>
      </header>

      <div className="subbar">
        <nav className="tabs">
          {tabs.map(([id, label]) => (
            <button key={id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
        <div className="source">
          <span className="pill" title={`Generated ${state.triage.generated_at}`}>
            Triage: {state.triage.provider} ({state.triage.model})
          </span>
          <span className={data.live_model.available ? 'pill ok' : 'pill'} title={data.live_model.reason}>
            Live model: {data.live_model.available ? data.live_model.provider : 'not configured (offline)'}
          </span>
          <button
            className="ghost small"
            onClick={async () => {
              if (confirm('Rebuild the desk from the triage output? All demo actions are cleared.')) {
                setData(await resetDesk());
                setSelected(null);
              }
            }}
          >
            Reset demo
          </button>
        </div>
      </div>

      {error && (
        <div className="error-bar" role="alert">
          <span>{error}</span>
          <button className="ghost small" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <main>
        {tab === 'desk' && <Desk data={data} user={user} run={run} selected={selected} setSelected={setSelected} />}
        {tab === 'review' && <Review data={data} run={run} />}
        {tab === 'noise' && <Noise data={data} run={run} />}
        {tab === 'requester' && <RequesterView data={data} user={user} />}
        {tab === 'audit' && <AuditLog data={data} openAsk={openAsk} />}
      </main>
    </div>
  );
}
