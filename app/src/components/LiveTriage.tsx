import { useState } from 'react';
import type { TriageRecord } from '../../shared/types.ts';
import { liveTriage } from '../api.ts';

/** Calls the real model for one message and shows the raw result beside the cached one. Failures are shown, not hidden. */
export default function LiveTriage({ messageId, live }: { messageId: string; live: { available: boolean; provider: string; reason: string } }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string; record?: TriageRecord } | null>(null);

  return (
    <div className="live">
      <button
        className="ghost small"
        disabled={busy}
        title={live.available ? `Calls ${live.provider}` : live.reason}
        onClick={async () => {
          setBusy(true);
          try {
            setResult(await liveTriage(messageId));
          } catch (e) {
            setResult({ ok: false, error: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Calling model...' : `Re-run ${messageId} on the live model`}
      </button>
      {result && !result.ok && <div className="live-fail">{result.error}</div>}
      {result?.ok && result.record?.output && (
        <div className="live-ok">
          <div className="muted">
            {result.record.provider} ({result.record.model}), {result.record.latency_ms} ms
            {result.record.tokens && `, ${result.record.tokens.input} in / ${result.record.tokens.output} out tokens`}
          </div>
          <pre>{JSON.stringify(result.record.output, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
