# Roadmap

Ordering principle: **trust before control.** The list has to be right before anyone relies on it, and people have to rely on it before a hard gate on it is tolerated. Both previous tools died by asking for effort before they had earned it (desk notes).

## Release 1 — "What is outstanding?" (weeks 1–4)

What ships: the slice in this repo, connected to the real mailbox.

- Read-only mailbox connection (Microsoft Graph). Messages in; replies sent from the shared mailbox detected as claims (R16).
- Ask extraction, splitting, merging, noise filing, *Needs a look* (R1–R4, R12).
- The list: owner, age from earliest date, due, risk, money at stake (R5, R6).
- Claim and reply-as-claim, collision light (R7, R8).
- Statuses with *Decided → Told → Resolved* (R9).
- Junaid's read-only status page (R13).
- Redirect as an end state (R14). Audit log (R15).
- Controlled-category gates are **built but switched on in week 4** (METRICS, 30-day plan).

Why first: it answers Tariq's question and Ayesha's hour a day with no change to how Omar replies. It is also the base every later release reads from.

## Release 2 — close the loops (weeks 5–10)

- Detect an outbound reply to the waiting party and offer it as *Told* (R19). Removes the one manual step D4 adds.
- Requester notifications on status change, opt-in (R20). Only after R1 shows statuses are accurate, because a wrong "Resolved" email is worse than none.
- Unclaimed nudges to a named daily cover person; a simple rota (R17).
- Friday one-screen digest for Tariq: oldest asks, decided-not-told, money at stake (R18).

Why second: these act on the status data, so they are only safe once that data has been trusted for a month.

## Release 3 — make the controls real (weeks 11–16)

- Role-restricted release for the four categories (R21). The slice records *who*; this enforces *who may*.
- Connect gates to their sources of truth: the NDA register, the vendor master with phone numbers on file, the signatory list.
- Elena's override review queue and monthly report.

Why third: until the desk uses the list daily, a role system is administration with nothing to protect.

## Later, if the numbers justify it

- Reading attachments (msg-031), only if *Needs a look* volume from attachment-only mail is material.
- Auto-forwarding of confirmed redirects (HR, IR, Finance).
- Patterns review: what keeps arriving that belongs elsewhere (feeds a fix upstream, e.g. msg-024's bounced HR inbox).

## Deliberately cut

| Cut | Why |
|---|---|
| Auto-replies / AI-drafted replies sent without a person | External communication on a regulated, live-transaction mailbox; Elena; Tariq's "wrong loudly" |
| Automatic assignment | Ayesha: ignored assignments look like ownership (D3) |
| Mandatory fields before replying | The 2023 ticketing system's cause of death |
| Department inboxes | Recreates msg-010's forwarding loop; the desk has no rota |
| Analytics dashboard | Tariq: "I do not need a dashboard with twelve charts" |
| Replacing Outlook | Not the problem; would fail Omar on day one |
| SLA targets per category | No evidence yet of what the right numbers are; measure first (METRICS) |
