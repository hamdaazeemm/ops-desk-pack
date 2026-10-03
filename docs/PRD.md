# PRD — Pentland Ops Desk

Context and evidence: `PRODUCT_BRIEF.md`, `EVIDENCE.md`. Reasoning behind each requirement: `DECISIONS.md` (Dn).

## Personas and jobs

| Persona | Job they are trying to do | What they will not accept |
|---|---|---|
| **Omar**, coordinator, clears the morning queue | Answer the two-minute mail and move on; not answer what someone else already answered | Any step before the reply box (two tools died of it) |
| **Ayesha**, coordinator, keeps the tracker | Know what is open, who has it, how old, what is about to go wrong; stop spending an hour a day reconstructing it | A list that drifts from the mailbox; assignments that look like ownership |
| **Bilal / Daniyal**, coordinators with other jobs | Pick up what is theirs, record the decision, hand back | Re-entering what the email already says |
| **Junaid**, internal requester | Know where each of his asks sits so he can tell the site or the contractor | Categorising his own requests; raising them one at a time |
| **Elena**, Head of Compliance | Four actions cannot happen without their prerequisite; see afterwards who released what and why | Banners; a misclassification that blocks ordinary work |
| **Tariq**, MD and sponsor | Once a week: what is outstanding, how old, what is about to cost money | Twelve charts; a system that is quietly wrong |

## Requirements

**P0 = needed to prove the bet (built in the slice). P1 = release 1, not in the slice. P2 = later.**

| # | Requirement | Pri | Why (evidence / decision) |
|---|---|---|---|
| R1 | Every message is turned into zero or more **asks**, or filed as noise with a reason | P0 | msg-004 is three asks (D1) |
| R2 | Same ask from two directions becomes one item with all requesters; merges visible and detachable | P0 | 004-1/008, 004-3/003 (D12, D1) |
| R3 | A message in an existing thread can create a new ask | P0 | msg-014 oil leak in the gate-pass thread |
| R4 | Updates (chaser, decision, escalation, closure) attach to the ask they refer to, and change it | P0 | 019, 023, 034, 036 |
| R5 | Age runs from the earliest date in the content; due dates shown with source text | P0 | msg-010 (D5) |
| R6 | One list: open, unclaimed, at risk, decided-not-told; sortable by age and risk; money at stake shown | P0 | Tariq, Ayesha |
| R7 | Ownership by **claim** or by **replying from the mailbox**; suggestion shown separately and never counts | P0 | Ayesha, Omar (D3, D8) |
| R8 | "Someone already replied" indicator on the ask | P0 | Omar's one wish |
| R9 | Statuses *New, Claimed, Waiting, Decided, Told, Resolved*; *Resolved* requires every waiting party *Told* | P0 | msg-019, January Zenith (D4) |
| R10 | Four controlled categories: release action unavailable until prerequisite recorded; category override with reason | P0 | Elena, msg-006/026/028/030 (D7) |
| R11 | Vendor-domain mismatch flagged deterministically | P0 | msg-028 (D13) |
| R12 | *Needs a look* pile for low confidence; every model action reversible and audited | P0 | Tariq: "wrong loudly" (D6) |
| R13 | Requester status page in plain words | P0 | Junaid, msg-036 (D10) |
| R14 | Redirect as an end state, with "sender told where" | P0 | 016, 021, 024 (D11) |
| R15 | Audit log of every model and human action | P0 | Elena |
| R16 | Live mailbox connection (read + detect replies) | P1 | Slice simulates it |
| R17 | Unclaimed nudge to the day's cover person; daily rota | P1 | D3 |
| R18 | Weekly one-screen digest for Tariq | P1 | Tariq |
| R19 | Detect outbound reply to the waiting party as a candidate *Told* | P2 | D4 |
| R20 | Requester email notifications on status change | P2 | D10 |
| R21 | Role-restricted release of controlled actions | P2 | D18 |
| — | Auto-replies, auto-assignment, department inboxes, attachment reading, charts | Won't | PRODUCT_BRIEF "not solving" |

## Key flows

### Flow 1 — from mailbox to an owned item

```
Mailbox (Outlook)           Model pass                Rules                    List
msg-004 "Three things" ──>  3 asks, owner hints ──>  004-1 merges with 008 ─> "Kot Addu gate passes"  Unclaimed  (Junaid, Rizwan)
                                                      004-2 new             ─> "Zenith insurance cert" Unclaimed  HIGH
                                                      004-3 merges with 003 ─> "Delta invoice"         Unclaimed  HIGH
Omar replies in Outlook ─────────────────────────────────────────────────────> gate passes: Claimed by Omar (via reply)
Ayesha opens the list ───> sees "Omar replied 08:40" on gate passes, claims Zenith insurance herself
```

Desk list:

```
+---------------------------------------------------------------------------------------------+
| Pentland Ops Desk            Thu 12 Mar 17:30           Viewing as [Ayesha v]               |
| Desk (14)   Needs a look (1)   Noise (17)   Requester view   Audit                          |
+---------------------------------------------------------------------------------------------+
|  14 open    13 unclaimed    5 held by a control    1 decided, not told   PKR 85k/day at stake |
|  [All] [Mine] [Unclaimed] [Held] [Decided, not told]                                         |
+---------------------------------------------------------------------------------------------+
| ASK                              WHO'S WAITING      OWNER                AGE   DUE     STATUS   |
| ! Regulator RFI, Kot Addu licence  Licensing Dir.   Unclaimed 13d (!)    13d   Fri 13  New      |
| ! T3 bund oil leak                 Rizwan           Unclaimed 8h (!)     8h    -       New  x1 chased |
|   Zenith VO-14 approval            Zenith           Bilal                7h    Fri 13  Decided, NOT TOLD |
| # Delta bank-detail change         "Delta" (?)      Unclaimed            4h    -       Held: verify by phone |
|   Kot Addu gate passes             Junaid, Rizwan   Omar (replied)       10h   Wed 18  Claimed  x1 chased |
+---------------------------------------------------------------------------------------------+
  !  past unclaimed limit    #  controlled category    xN  chased N times
```

As built: [screens/01-desk.png](screens/01-desk.png).

Item detail (right panel): title and summary; status steps; who is waiting; owner and suggestion; the one next action for the current status; gate panel if controlled; source messages, expandable; model output with confidence, reason and the reverse actions; the item's audit trail.

### Flow 2 — done means told (Zenith VO-14)

```
msg-017 Zenith asks for written approval  ->  ask "Zenith VO-14 approval", waiting party: Zenith
msg-019 Bilal: "Approved... closing out"  ->  status DECIDED, flag "Zenith not told", age keeps running
Bilal opens the item                     ->  only forward action: "Record that Zenith was told"
                                              + draft approval note to copy into Outlook
Bilal sends from Outlook, records it     ->  TOLD (who, how, when) -> RESOLVED
Junaid's status page                     ->  "Zenith VO-14 — approved, Zenith told 17:42"
```

As built: [screens/02-zenith-decided-not-told.png](screens/02-zenith-decided-not-told.png).

Junaid's status page (as built: [screens/04-requester-junaid.png](screens/04-requester-junaid.png)):

```
+------------------------------------------------------------+
| Your requests to the ops desk — Junaid Aslam               |
| Kot Addu gate passes     With Omar since 08:40. Due Wed 18. |
| Zenith insurance cert    With Ayesha since 17:35.           |
| Delta invoice INV-2291   Nobody has picked this up (10h).   |
+------------------------------------------------------------+
```

### Flow 3 (inside both) — a controlled ask

msg-028 opens with the gate panel: *Bank-detail change. Release unavailable until a phone verification is recorded on a number already on file (not from this email). Sender domain deltacivilworks-pk.com does not match deltacivilworks.com.pk on file.* Recording a verification needs the number called, who answered, and the outcome. *Override: this is not a bank-detail change* requires a reason and is audited. As built: [screens/03-bank-change-gate.png](screens/03-bank-change-gate.png).

## Worked hard cases

**Three asks in one email (msg-004).** The model returns three asks. Ask 1 (site access, Kot Addu, Thursday 19th) has the same site and the same people as Rizwan's msg-008, which arrives 47 minutes later, so 008 merges into it: one item (A-02), two people waiting (Junaid and Rizwan), due Wednesday 18 March (Rizwan's "pass numbers by Wednesday close" is earlier than Junaid's Thursday). Ask 2 (Zenith insurance) becomes its own high-risk item (A-03), with "expired" as the risk reason, so it cannot be the one that "disappears". Ask 3 (Delta invoice) merges into Delta's own chase, msg-003 (A-01), and takes its age from 9 February, the invoice date. When Junaid chases at 17:15 (msg-036), the chase attaches to **all three** and each shows *Chased 1x*. Resolution needs Junaid told on each one separately. *Cost of getting it wrong:* the stub also merges the auditors' visit (msg-033) into A-02, because it mentions site access at Kot Addu. The merge is visible ("3 sources merged") and is undone with one click.

**Forwarded chain with the deadline at the bottom (msg-010).** The message reaching the desk is "Fwd: Fwd: Fwd: FYI" from Daniyal, who goes on leave tomorrow. The model reads to the innermost forward and takes the title, the waiting party (Licensing Directorate, not Daniyal) and the dates from there: notice dated 27 February, "within ten (10) working days", so due **Friday 13 March**, computed as working days (Mon–Fri). The item's age runs from 27 February (13 days), not from 08:52 today. A rule flags any `.gov.pk` sender for same-day Compliance notification, and high risk puts it on the 30-minute claim limit. It is the top row on the desk.

## AI behaviour specification

**Input:** one message plus the open asks so far (id, title, category, requesters). **Output:** strict JSON (schema in `app/server/triage/schema.ts`): `kind` (work / update / noise), `asks[]` (title, summary, category, controlled[], risk, due, original date, waiting party, suggested owner, redirect, same-as reference), `updates[]` (target ask, type, note), `confidence`, `rationale`.

| Question | Behaviour |
|---|---|
| What does it decide? | Noise vs work; splitting; category; linking to an existing ask. Applied immediately, reversible (D6) |
| What may it only suggest? | Owner; redirect target; draft message to the waiting party |
| What may it never do? | Send, delete, set Decided/Told/Resolved, release a controlled action |
| Confidence threshold | Work below 0.6 or noise below 0.85 goes to *Needs a look* with the model's proposal pre-filled |
| What does the interface do below the threshold? | The message is not on the list and not in noise; it waits in *Needs a look*, newest-highest-risk first. One click confirms, files as noise, or edits |
| When it is unsure about a controlled category | Flag it. A false flag costs an override with a reason; a missed flag costs a fraud or an unprotected data room |
| When it is wrong | Every wrong output has a one-click reversal: restore from noise, detach a merge, override a category, file as noise. The reversal and its reason go to the audit log, and the model output stays visible beside the human correction |
| When the call fails | Timeout, invalid JSON or refusal: retry once, then the message goes to *Needs a look* as "model failed: reason". Nothing is silently dropped |
| What is checked without the model | Sender domain against vendor on file (R11); regulator sender; working-day due date maths |

## Data model

```
Message      id, thread_id, timestamp, from, to, cc, subject, body, attachments      (from inbox.json, never edited)
Ask          id, title, summary, category, controlled[], risk, exposure, due, received_at (earliest),
             requesters[], waiting_parties[{name, told_at, told_by, channel}],
             owner, owner_source (claim | reply), suggested_owner, status, decision,
             message_refs[{message_id, role: source | duplicate | chaser | decision | escalation | closure}],
             repliers[{person, at}], chase_count, prerequisites[{kind, by, at, detail}], overrides[]
NoiseEntry   message_id, reason, confidence
ReviewEntry  message_id, proposal, reason
AuditEvent   at, actor (person | model | rule), action, ask_id?, message_id?, detail
```
