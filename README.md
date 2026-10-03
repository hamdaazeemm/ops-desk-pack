# Pentland Ops Desk — shared-inbox triage

A work list behind `ops@pentlandinfra.com`. A model turns each email into **asks**: it splits bundled requests, merges the same ask arriving twice, and files noise. People keep replying in Outlook, and a reply claims the ask. An ask is resolved only when the person waiting has been told. Four controlled categories cannot be released until their prerequisite is recorded.

Start with `docs/`: the documents carry the argument, and the app demonstrates it.

| Document | What it answers |
|---|---|
| [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md) | The problem, who is hurt, evidence, success numbers, what is not being solved |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Every judgement call, with options, evidence, and what would change my mind |
| [docs/PRD.md](docs/PRD.md) | Personas, prioritised requirements, flows, AI behaviour specification |
| [docs/METRICS.md](docs/METRICS.md) | North star, guardrails, instrumentation, first 30 days |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What ships first, what follows, what is cut |
| [docs/EVIDENCE.md](docs/EVIDENCE.md) | All 36 messages: what each is, and what it exposes |
| [docs/COST_MODEL.md](docs/COST_MODEL.md) | Monthly model cost at 120 and 240 messages/day |
| [docs/RETRO.md](docs/RETRO.md) | What I would do next, and what I would want to learn from users |

The provided material is in `pack/`, unchanged.

## Run it

**Prerequisites:** Node.js 18 or later (built and tested on Node 20) and npm. No database, no Docker, no network needed at runtime.

```bash
cd app
npm install
npm start
```

Open **http://localhost:4310**. (`npm start` builds the UI, then serves it and the API on one port. Set `PORT=xxxx` to change it.)

- **Reset the demo:** the "Reset demo" button (top right), or stop the server and run `npm run reset`.
- **Dev mode with hot reload:** `npm run dev`, then open http://localhost:5173.

### The model layer

The desk is built from `app/data/triage-cache.json`, which is committed so the demo runs offline. The header shows which provider produced it.

- **As committed, it is stub output** (`keyword-rules-v1`): no API key was available when I built this. The stub is a rules-based classifier that goes through the same schema validator as the real model. Its mistakes are its own (see "Where it goes wrong" below).
- **To use a real model:** copy `app/.env.example` to `app/.env`, add `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, then:

  ```bash
  npm run triage            # all 36 messages, in arrival order, each call sees the asks so far
  npm run triage -- --only=msg-031    # re-run one message
  ```

  Click "Reset demo" to rebuild the desk from the new output. With a key set, every item also gets a **Re-run on the live model** button that shows the raw result beside the cached one.
- Prompt: `app/server/triage/prompt.ts`. Schema and validator: `app/server/triage/schema.ts`. Providers, timeout, retry-on-invalid-JSON and failure records: `app/server/triage/providers.ts`. A failed call never drops a message; it lands in **Needs a look**.
- With no key, the live button shows the failure path: *"No live model: No API key found... The cached output is unchanged."*

## Demo script (about 15 minutes)

Use **Viewing as** (top right) to switch people. The clock starts at 17:30 on the pack's day; **+1 hour** and **+1 day** move it.

**Flow 1 — from mailbox to an owned item** (as Ayesha)
1. Desk: 14 open asks from 36 messages, 13 with nobody's name on them. Sorted by what is about to go wrong: the regulator letter (A-05) is due **tomorrow** and is **13 days old**, measured from the 27 February notice, not from when it reached the desk.
2. Junaid's msg-004 ("three things, sorry to bundle them") is three rows: A-01, A-02, A-03. A-02 (gate passes) shows **3 sources merged**: Junaid's ask, Rizwan's msg-008, and one wrong merge (below). A-01 (Delta invoice) merges Delta's own chase (msg-003) with Junaid's.
3. A-07: the oil leak, split out of the gate-pass thread (msg-014), shown as **Escalated** (msg-023, "Who is handling this?").
4. Open A-02. Under Owner, set Outlook to Omar and click **replies from the shared mailbox**. Omar now owns it without opening the app. Then make Ayesha reply: the **"Someone else is already in this thread"** banner appears, which is Omar's one wish.
5. Open A-13 (bank-detail change). Note the domain mismatch flag and the purple gate. There is no release button. Record a phone verification against the number on file; the release appears. Everything is in the **Audit log**.

**Flow 2 — done means told** (as Bilal)
6. Open A-09 (Zenith VO-14). Bilal's "Approved on our side. Closing this one out on the tracker." landed as **Decided, but not done**, because Zenith has not been told and PKR 85,000/day is still running. This is the January failure, recurring in today's mailbox.
7. Copy the draft, click **Record that Adeel Butt was told**, then **Mark resolved**.
8. Switch to **Junaid**. His page shows each of his three asks in plain words. This page replaces msg-036 ("Any update? ... just tell me who").

**Where it goes wrong, live** (as Ayesha)
9. **Noise tab:** msg-034, "Thanks — received, we are all set now", was binned as an acknowledgement. Click **It closes something: record closure**. msg-035 (mailbox password expires 19 March) was filed as an automated notice; **Restore as an ask**.
10. **A-02:** the auditors' visit (msg-033) was merged into the gate passes because both mention site access at Kot Addu. Click **Wrong merge? Detach**: it becomes its own ask, and A-02's risk and due date recalculate.
11. **A-01:** the ordinary invoice chase is held as a *bank-detail change* because it says "payment date". Click **Model wrong? This is not a bank details case**, give a reason, and the gate lifts. The override is in the audit log, which is how Elena's control stays on without blocking normal work.
12. **Needs a look:** Tariq's msg-031 is a scanned attachment the model cannot read (confidence 0.30). It is not guessed at; a person names it.

## Project layout

```
pack/                       provided material, unchanged
docs/                       product documents (+ screens/)
app/
  server/triage/            model layer: prompt, schema, providers, stub, CLI
  server/desk.ts            rules engine: merge, split, done-means-told, gates, audit
  server/index.ts           HTTP API + static UI
  shared/                   types and desk-time maths (working hours, due dates)
  src/                      React UI
  data/triage-cache.json    model output the desk is built from (committed)
  data/registers.json       mock vendor master and NDA register (fabricated)
```

Confidential: this repository must stay private (brief, section 11).
