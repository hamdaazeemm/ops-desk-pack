# Decision log

One entry per judgement call. Message ids refer to `pack/inbox.json`; see `EVIDENCE.md` for the full table.

---

## D1. What is a unit of work?

- **Options:** the message; the thread; the ask.
- **Chose:** the **ask**. One message can hold several (msg-004 = 3). Several messages can hold the same one (004-1 and 008; 004-3 and 003). A thread can change asks halfway (014 inside `thr-008`).
- **Why:** By message, msg-004 becomes one item and the insurance question disappears, which is exactly what Junaid says happens today. By thread, the oil leak (014, 023) sits under a gate pass for hours; 023's "Who is handling this?" is the result.
- **Cost of drawing it wrong:** A wrong *split* creates an extra row someone closes in one click. A wrong *merge* hides an ask inside another, which is the expensive direction. So merges are shown on the item ("merged from msg-008") with a one-click **Detach**. Splitting is the model's job; merging requires a strong match (same invoice number, same people and date) and is always visible.
- **Would change my mind:** if more than ~1 in 10 merges are detached in the first month, merging becomes a suggestion a person accepts rather than automatic.

## D2. What happens to noise, and are the two errors equally expensive?

- **Options:** delete; hide; file with a reason and keep restorable.
- **Chose:** **file with a reason, restorable, never deleted.** Noise needs higher model confidence than work (0.85 vs 0.6). Below that, the message goes to *Needs a look*.
- **Why:** Discarding something real is far more expensive than keeping something worthless. A newsletter in the list costs a coordinator two seconds. A binned closure (msg-034, "we are all set now") or a binned password expiry (msg-035, desk locked out on 19 March) costs a missed fact. Ayesha: "we do not lose a message, we lose the fact that something finished."
- **Short acknowledgements** ("Noted with thanks", "all set now") are treated as possible updates to an existing ask, not as noise by default. If no tracked ask matches (034's thread is not in the export), the product records a closure for untracked work.
- **Would change my mind:** if the weekly sample shows restored-from-noise under 1 in 200 for three weeks, lower the noise threshold.

## D3. How does something become owned?

- **Options:** assigned by the model; assigned by a lead; claimed by a person.
- **Chose:** **claimed.** The model suggests an owner; that suggestion never counts as ownership. A person owns an ask by clicking **Claim** or by **replying from the mailbox** (detected, not typed).
- **Why:** Ayesha: "Suggest, yes. Assign, no… the item looks owned when it is not. That is worse than unowned." Omar will not accept work he did not pick up. Reply-as-claim matches how the desk already works ("an item is yours once you have touched it") and costs Omar nothing.
- **What happens to an unclaimed ask:** it shows as **Unclaimed** with its age, and rises to the top once it passes a limit: **30 minutes** for high-risk or controlled asks, **2 working hours** for everything else. The 2-hour figure is the desk's own logging rule (desk notes). Past the limit, the cover person for the day is named on the row (in the slice, the person viewing). The product never silently assigns.
- **Who decides:** whoever is covering; the desk lead for anything still unclaimed at end of day.
- **Would change my mind:** if unclaimed high-risk asks regularly pass 2 hours, add a named daily rota so "the cover person" is explicit rather than implied.

## D4. What does "done" mean?

- **Options:** replied; decided; the person waiting has been told.
- **Chose:** **Resolved = the waiting party has been told the outcome.** Statuses: *New → Claimed → Waiting → Decided → Told → Resolved*. There is no path from *Decided* to *Resolved* that skips *Told*.
- **Why:** msg-019: "Approved on our side. Closing this one out on the tracker." Zenith asked for approval *in writing* (msg-017), and standing time continues at PKR 85,000/day until they have it. This is the January failure that cost nine days (desk notes, Tariq).
- **Ayesha's objection** ("people will click Done at the point they usually do") is answered by not having a Done button. At *Decided*, the only forward action is **Record that [waiting party] was told**, prefilled with who and how. The product also drafts the message to send from Outlook. A Decided ask is listed as *Decided — not told* in its own filter, with its age.
- **Merged asks have more than one waiting party** (Delta and Junaid on the invoice). The ask is resolved when all of them have been told.
- **Would change my mind:** if *Told* records turn out to be clicked without the message actually going, detect the outbound email to the waiting party instead (roadmap R2).

## D5. Which date is an ask's age measured from?

- **Chose:** **the earliest date the content shows**, not when it reached the desk. Extracted dates are shown with the source text so they can be checked.
- **Why:** msg-010 reaches the desk on 12 March. The notice is dated 27 February and due 13 March. Ayesha: "it arrived on our desk looking brand new."
- **Would change my mind:** nothing in the pack argues for the arrival date; this is the cheapest correct choice.

## D6. What does the machine decide, and what may it only suggest?

| Model **decides** (applied, reversible) | Model **suggests** (a person accepts) | Model **never** |
|---|---|---|
| Noise vs work (above 0.85 for noise) | Owner | Sends any email |
| Splitting a message into asks | Priority and risk wording | Marks anything Decided, Told or Resolved |
| Category, including the four controlled ones | Redirect target (HR, IR, Finance) | Releases a controlled action |
| Linking a message to an existing ask | Draft "you have been told" message | Deletes a message |

- **Threshold:** work at confidence below **0.6** and noise below **0.85** go to *Needs a look* instead of the list. Every model output shows its confidence and a one-line reason.
- **Undo:** every model action has a one-click reversal (restore from noise, detach, override category, file as noise), and every reversal is written to the audit log with the person and the reason.
- **Why decide the category at all**, given Omar's "who decides which ones are complicated?": wrong categories are cheap here because nothing in Omar's reply path depends on them (D8), and the controlled-category consequence is reversible (D7).

## D7. Where do we deliberately slow things down? (Elena)

- **Options:** no friction; warning banners; hard gates on everything flagged; hard gates on the release action only, with an audited override of the category.
- **Chose:** **hard gate on the release action for four categories**: grant data room access, action a bank-detail change, add a vendor, release a letter on letterhead. The release button does not exist until the prerequisite is recorded with a name and a date (executed NDA; phone verification on a number already held; onboarding checks; authorised signatory).
- **Agree with Elena?** Yes on all four, including the hard gate rather than a banner ("those get clicked through in a fortnight"). Yes on her second point: the model may classify, but a wrong classification must be recoverable. Anyone can **override the category** with a reason; that override is the audit record she asked for ("who released what, on what basis").
- **What is not slowed:** seeing, claiming and replying. Replying "we are checking the NDA status" to Saeed & Co (msg-006) is still one action.
- **A deterministic check backs up the model on bank details:** a sender domain that differs from the domain on file for that vendor is flagged regardless of model output (msg-028 `deltacivilworks-pk.com` vs `deltacivilworks.com.pk`).
- **Would change my mind:** if overrides on bank-detail flags exceed ~1 in 3, the model is crying wolf and the flag will be ignored; move to rules-only detection for that category.

## D8. How does this survive Omar?

- **The answer to him, specifically:** nothing stands between you and the reply box, on any message, ever. You keep using Outlook. Your reply claims the ask, so the tracker fills behind you; that is the one thing you said you wanted. The only thing you see if you open the list is the light you asked for: *someone else already replied in this thread*, shown before you type.
- **On "who decides which ones are complicated?":** no one has to, for him. The four gated actions are not two-minute replies; nobody grants data room access or changes bank details in his 07:50 sweep. A gate pass never meets a gate.
- **Why not force him:** both previous tools died by putting a step before the reply (desk notes). Tariq: Omar is "a constraint to be solved, not a veto", and "invisible to him and useful to everyone else… is a legitimate answer". This is that answer.
- **Would change my mind:** if the reply-detection claim proves unreliable (wrong person, shared mailbox sender identity), Omar's work goes unowned on the list; then a one-key "mine" in Outlook is the next cheapest thing.

## D9. Does it survive partial adoption?

- **Yes, by construction.** The list is built from the mailbox, not from people logging. If half the desk never opens it in week one, every ask is still on the list, and replies from Outlook still record who touched what.
- **What degrades:** *Decided* and *Told* need someone to record them. Ignorers' asks will sit at *Claimed*. That is visible and honest (it shows as "claimed by Omar, 3 days, no update"), which is better than today's invisible.
- **Would change my mind:** if the list drifts from the mailbox (the 2024 board's failure), trust collapses. Measured weekly (METRICS: drift sample).

## D10. Junaid — in the first release or not?

- **Yes: a read-only status page in release 1.** It shows each of a requester's asks with owner, status and age in plain words. The list already exists, so this costs almost nothing.
- **Why:** Junaid: "If I could look at a screen and see 'site access — with Ayesha'… I would never send a chaser again." msg-036 is that chaser, and each chase is more desk work. Breaking the loop is the cheapest load reduction available.
- **Deferred:** email notifications on change (he prefers them) go to R2, because one bad notification ("Resolved" when it is not) does more damage than none.

## D11. What is this desk not for? Is redirection a feature?

- **Yes.** msg-024 (leave question) belongs to HR, msg-021 (investor reporting pack) to Investor Relations, msg-016 (bank signatory mandate) to Finance. The model suggests a redirect; a person confirms it. The ask closes as **Redirected to X**, and closing requires recording that the sender was told where it went (D4 applies).
- **Why:** processing someone else's work efficiently is still the wrong work. Redirect is the honest end state, and it shows on the list for weekly review ("what keeps arriving here that shouldn't?").

## D12. Same ask from two directions

- **Chose:** one ask, two requesters, two waiting parties. 004-1 (Junaid) + 008 (Rizwan) = **Kot Addu gate passes**. 003 (Delta AR) + 004-3 (Junaid) = **Delta invoice**.
- **Why:** two items means two people raise passes or each assumes the other did. One item with both names means one owner, and both people told.

## D13. The bank-detail email (msg-028)

- **Chose:** a separate ask, **linked** to the Delta invoice but not merged into it, held behind the bank-detail gate, with the domain mismatch shown.
- **Why:** merging would let "invoice paid" close the fraud question. Elena: fraud "arrives right after a genuine invoice chase… Someone is reading something." It arrives 5.5 hours after msg-003 and uses the same pressure point (the site-team hold).

## D14. Messages the model cannot read (msg-031)

- **Chose:** create the ask with low confidence and send it to *Needs a look*. Do not guess a category.
- **Why:** the content is in an attachment the product does not read (filenames only). A confident guess about the MD's document is worse than an honest "unknown". It is from Tariq and says "today", so it shows at the top of *Needs a look*.

## D15. What to trust when the pack disagrees with itself

- **Volume:** the desk notes say ~120 messages a day. The pack README calls this 36-message Thursday "typical". Omar's "thirty, thirty-five by nine" is not possible on this day (10 had arrived by 09:00).
- **Chose:** plan and cost at 120/day (the brief's figure) and at 240 (Tariq's "if volume doubles"). Design nothing that only works at 36.
- **Noise share:** I count 42%, not the notes' 53% (EVIDENCE.md). The design does not depend on the exact share.
- **The compliance rule** in the notes (regulator mail flagged to Compliance same day) is contradicted by msg-010. So regulator asks get the 30-minute unclaimed limit rather than relying on the rule.

## D16. The model layer and where the data goes

- **Options:** hosted API live; hosted API with saved results; local model; stub.
- **Chose:** a provider interface with three backends (**Anthropic, OpenAI, stub**), results saved to `data/triage-cache.json` so the demo runs offline. The repo currently ships stub output because no API key was available when it was built; one command (`npm run triage` with a key in `.env`) replaces it with real output and the app uses it unchanged.
- **The stub is not hand-picked answers.** It is a keyword-and-pattern classifier run over the messages, so its errors are its own: it bins msg-034 as an acknowledgement, files msg-035 as an automated notice, merges the auditors' visit (msg-033) into the gate passes because both mention site access at Kot Addu, and flags the ordinary invoice chase (msg-003) as a bank-detail change because it says "payment". Each of those has a recovery path in the UI (D2, D1, D7).
- **Data:** Tariq's line is a hard requirement. Production use needs an API under no-training, zero-retention terms, or a local model. The pack itself must not go to a consumer chat product (brief section 11).
- **Would change my mind:** if no provider can meet the retention terms, run a local model; COST_MODEL.md shows volume is small enough for that.

## D17. The second demo flow

- **Options:** controlled-category gates; Junaid's status page; done-means-told.
- **Chose:** **done-means-told**, with Junaid's status page at the end of it. Gates appear inside both flows rather than as their own.
- **Why:** it is the failure that caused this project (Tariq: "The process simply had a hole where 'tell the contractor' should have been") and it is happening again in today's mailbox (msg-019). It is also where the product's honesty is most visible: Bilal's "closing this one out" lands as *Decided — Zenith not told*, not as Done.

## D18. Scope cut, and what each cut costs

| Cut | What it would have given | Cost of cutting |
|---|---|---|
| Real Outlook connection (Graph API) | Live mail, real reply-as-claim | Replies are simulated with a button. The concept is shown; the connector risk (sender identity on a shared mailbox) is untested |
| Email notifications to requesters | Junaid's preferred channel | He has to open the page. Acceptable for R1 (D10) |
| Reading attachments | msg-031's contents | Attachment-only mail is always *Needs a look* |
| Roles and permissions on release | Only authorised people release controlled actions | The slice records *who* released; it does not stop the wrong person. Elena's audit need is met; her access need is not |
| Daily rota | Explicit cover person | "Cover" is whoever is viewing |
| Login | Real identity | A name picker. Fine for a local demo; not for production |
| Tests | Confidence when changing rules live | Accepted; the brief does not score them |
