# Cost model

Tariq: "I want to know what that is per month before we start… and what happens to that number if the volume doubles."

## Assumptions

- **Volume:** 120 messages per working day (desk notes; see D15 on why I doubt it) x 22 working days = **2,640 messages/month**. Doubled: 5,280.
- **Tokens per message:** ~2,000 input (instructions and schema ~1,000; the message ~300 on average, up to ~1,500 for a forwarded chain like msg-010; open asks for matching ~700) and ~350 output.
- **One call per message.** Plus a second check on ~15% (controlled categories and low confidence).
- **Prices:** published list prices at time of writing, per million tokens. 
  - Mid-tier model (Claude Sonnet class): $3 input / $15 output.
  - Small model (Claude Haiku class): $1 input / $5 output.

## Monthly cost

| Scenario | Input tokens | Output tokens | Mid-tier | Small model |
|---|---|---|---|---|
| 120/day | 5.3M | 0.9M | **~$30** | ~$10 |
| + second check on 15% | +0.8M | +0.1M | ~$34 | ~$12 |
| 240/day (volume doubles) | 10.6M | 1.8M | **~$60–70** | ~$20–25 |

Open-ask context grows with the backlog. It is capped at the 50 most relevant open asks (~1,500 tokens), which keeps the per-message cost flat as the desk grows.

**Local model alternative:** an 8-core laptop CPU runs a 3–8B model at roughly 5–20 tokens/s, so ~20–70 s per message, about 1–2 hours of compute per 120-message day. Workable as a background job on a small office server; not interactive. No per-message cost, and no data leaves the building.

## Comparison that matters

Ayesha spends ~1 hour a day reconstructing the tracker: ~22 hours a month of one coordinator. One avoided week of Zenith-style standing time is PKR 595,000. At ~$30–70 a month, the model is not a meaningful cost at either volume.

## Does this change the design?

Yes, in three ways:

1. **Use the better model everywhere.** At this volume there is nothing to save by routing easy mail to a cheaper model, and a cheaper model's errors cost coordinator time, which is the expensive resource.
2. **Afford a second check** on the controlled categories and on low-confidence output. It adds ~$4 a month.
3. **Provider choice is decided by data terms, not price.** Tariq's line ("I want to be able to say clearly where the content goes and who retains it") rules out anything that retains or trains on content. That means an API with zero-retention / no-training terms, or the local option above. Cost does not distinguish them; retention does.

What it does not change: process per message as it arrives rather than in a nightly batch. Freshness is the product, and batching saves nothing material.
