# Metrics

## North star

**Owned-and-honest rate: the share of real asks that, within 2 working hours of reaching the desk, are on the list with a person's name on them.**

Why this one: it is the product's whole claim in one number. It fails if the model misses an ask (not on the list), if the desk ignores the list (no name), or if the list drifts from reality. It cannot be gamed by speed: replying fast without claiming does not move it, and assignment does not count because the product does not assign (D3). The 2-hour window is the desk's own logging rule (desk notes).

Target: 90% by day 30. Today it cannot be measured, which is itself the problem (Ayesha: "handled and not logged" and "nobody has looked" look identical).

## Measures underneath it

| Measure | Definition | Target | Moves because of |
|---|---|---|---|
| Coverage | Real asks on the list ÷ real asks in a weekly 20-message mailbox sample, judged by a person | 95% | Model recall, noise threshold |
| Time to claim | Median time from arrival to claim or reply, by risk | High risk < 30 min; others < 2 h | Unclaimed limits (D3) |
| Decided, not told | Asks at *Decided* for more than 1 working day | 0 | D4. The Zenith number |
| Chaser rate | Inbound chasers ÷ inbound non-noise mail from internal requesters | Halve from week-1 baseline | Status page (D10) |
| Controlled releases with prerequisite | Releases in the four categories with a recorded prerequisite ÷ all such releases | 100% (by construction; measure for leaks around the tool) | D7 |
| Answer time for "what is outstanding?" | Self-reported by Farah/Tariq | < 1 minute | The list exists |

## Guardrails — signs the product is doing harm

| Guardrail | Harm it detects | Threshold that triggers a change |
|---|---|---|
| Routine reply time | Omar's warning: the tool slows two-minute mail | Any rise in median first-reply time for low-risk categories vs pre-launch |
| Restored from noise | Real work being binned | > 1 in 200 noise filings restored, or any restored item with money or a deadline |
| List-vs-mailbox drift | The 2024 board's death: list says something the mailbox contradicts | > 1 in 20 sampled asks wrong on status or owner |
| Category overrides | Gate crying wolf, so people stop trusting it | > 1 in 3 bank-detail flags overridden (D7) |
| Detached merges | Merges hiding asks | > 1 in 10 merges detached (D1) |
| Claimed and stale | Ownership that is only nominal | Asks claimed > 3 working days with no update |
| Model failure rate and cost | Silent outages; spend Tariq did not agree to | > 2% calls fail; monthly cost > 2x COST_MODEL estimate |

## What has to be instrumented

Every metric above comes from one append-only event stream (the audit log the slice already writes):

- `message.received`, `model.triaged` (kind, confidence, latency, tokens, cost, failure)
- `ask.created / merged / detached / split`, `noise.filed / restored`, `review.confirmed / dismissed`
- `ask.claimed` (source: click | reply), `ask.replied` (person), `ask.status_changed`, `ask.told` (party, channel)
- `gate.prerequisite_recorded`, `gate.released`, `category.overridden` (reason)
- `status_page.viewed` (requester), to connect views with fewer chasers
- Outside the product: first-reply time per message from the mailbox (for the Omar guardrail), so the baseline exists before launch.

Plus one manual measure: a **weekly 20-message sample** a coordinator marks by hand (is this ask on the list, correctly owned, correctly stated?). Coverage and drift have no automatic ground truth; pretending otherwise is how a tracker becomes wrong without anyone noticing.

## The first 30 days

| Days | What runs | Who sees it | Decision at the end |
|---|---|---|---|
| −14 to 0 | Mailbox baseline: first-reply times, chaser count, a manual "what is outstanding" count | — | Baselines exist |
| 1–7 | **Shadow mode.** Model runs on live mail; the list fills; nobody is asked to do anything. Ayesha and I check 20 messages a day against it | Ayesha, Farah | Is coverage ≥ 90% and noise-restore rare? If not, fix before anyone relies on it |
| 8–14 | List visible to the desk. Reply-as-claim on. Collision light on. No gates yet | Desk, Tariq | Is the Omar guardrail flat? Are claims happening without being asked? |
| 15–21 | Junaid's status page. Decided-not-told filter in the Friday review | + Junaid, requesters | Did his chasers drop? |
| 22–30 | Controlled-category gates on, with Elena reviewing every override | + Elena | Override rate per category; keep, tune, or move a category to rules-only |
| 30 | Review with Tariq: north star, guardrails, cost | | Continue, cut, or change the bet |

Gates come last on purpose: a hard gate on a list the desk does not trust yet would be the first thing switched off.
