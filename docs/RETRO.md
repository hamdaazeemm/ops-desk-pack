# Retrospective and what I would want to learn next

## What the slice proves, and what it does not

**Proves:** a model's first pass plus a small rules engine is enough to turn this mailbox into an honest list: 36 messages become 14 asks, with bundles split, duplicates merged, the leak split out of the gate-pass thread, the regulator clock restored to 27 February, and Bilal's "closing this one out" held at *Decided*. Every model error in the slice has a one-click recovery and an audit entry.

**Does not prove:**
- **That a real model does better than the stub.** The committed run is the stub, because no API key was available while building. The real path is wired and validated (prompt, schema, retry, failure records) but has not been run against the pack. The first thing to do with a key is `npm run triage` and diff it against the stub on the four known failure cases (034, 035, 033, 003).
- **That reply-as-claim works on a real shared mailbox.** Outlook is simulated. On Exchange, replies "send as" the shared mailbox can hide which person sent them; if so, the claim cannot be attributed and Omar's work goes unowned (DECISIONS D8). This is the riskiest assumption in the design.
- **That anyone will record *Told*.** It is one click, but it is a click. If coordinators skip it, items pile up at *Decided*. That is visible, but it is still a step Omar would not take. R2's outbound-reply detection is the real answer.

## What I would do next, in order

1. Run the real model over the pack and publish its error list next to the stub's (`docs/EVIDENCE.md` gets a column).
2. Spike the Graph API for one day of shadow reading, to test sender attribution on shared-mailbox replies before building anything else on it.
3. Put the list in front of Ayesha for a week in shadow mode with the 20-message daily sample (METRICS, days 1–7).
4. Only then: notifications, rota, and role-restricted release.

## User test

**Not done.** I did not get 20 minutes with someone who works a shared inbox before submitting, and I would rather say so than write notes for a session that did not happen. The script I would use:

1. (5 min) "Walk me through the last time something in your shared inbox got dropped or answered twice." Listen for: who noticed, how long it took, what status they believed it had.
2. (10 min) Show the desk as the person closest to their role. Tasks: *find what is about to cost money*; *find what nobody has picked up*; *close the Zenith item*. Watch where they hesitate. Do not explain the statuses first.
3. (5 min) "What would make you stop using this by Wednesday?" (Omar's test) and "What would you want to see that is not here?"

**What I would change my mind on:** whether *Told* as a separate click survives contact (if two of three people skip it, move straight to outbound detection), and whether the 30-minute claim limit for high-risk asks feels like help or like nagging.

## Questions I would want answered by the desk before committing further

- How often does a request arrive both by email and by phone? The product only sees email (Junaid says Delta "called me twice").
- What volume is real: 36 a day or 120? (DECISIONS D15.) It changes nothing in the design but a lot in the pitch.
- Who is allowed to approve a VO, sign an authority letter, or record an executed NDA today? The gates record *who*; the business has to say *who may*.
