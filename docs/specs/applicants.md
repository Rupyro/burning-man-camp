# Spec: Applicant module (sign-in first, applications, Open applications)

**Status:** decided by Ruchir (18 Oct 2026, ET; Decisions log), built for his review. **Rulebook:**
`MODULE_RULEBOOK.md`. **Replaces** PLAN.md decision 1 ("leave the pipeline out of V1"): Ruchir
decided statuses are set in the app. Demo data only; no real money moves.

## 1. What it is
- The site opens on the **sign-in page**, with a smaller **Sign up** link underneath.
- After sign-in people are routed by who they are: **applicants** to the applicant home
  (`/apply`), **joined members** to the member home, **leads** to the lead home, **admins** to
  theirs (the home shows their admin links). The demo role picker stays and gains an
  **Applicant** persona.
- An **applicant** is a signed-in person whose membership for the current edition is
  `prospect` or `waitlisted` and who is not an admin (`Actor.isApplicant`).
- Applicants see **only** the applicant screens until they have **paid and met every
  requirement, including the interview**. Then the app switches them to the member home by
  itself. **Joined = paid + all requirements done.**
- **Statuses are set in the app.** Leads and admins review applicants in **Open applications**
  and update each person's status and interview date.

**Not (yet):** the real application form (Ruchir will send it; the form is a clearly marked
PLACEHOLDER), file uploads (no file storage yet: required documents are read-and-confirm),
self-booked interview slots, capacity cap and automatic waitlisting, payment collection (Howler
stays outside the app; Finance records that a fee was paid, demo only).

## 2. Applicant journey and tracker
Tracker steps: **Not applied → Applied → Interview (date) → Accepted → Joined**.
Application status (`applicant_status`): `draft` (started, not sent = "Not applied"), `applied`,
`interview_scheduled` (with `interview_at`), `accepted`, `joined`, `declined`.

Lead transitions (rules/journey.ts):
| From | To |
|---|---|
| applied | interview_scheduled (date required), declined |
| interview_scheduled | interview_scheduled (re-schedule, date required), accepted (= interview held), declined |
| accepted | declined |
| declined | applied (re-open) |
| draft, joined | nothing (joined is final; drafts belong to the applicant) |

Requirements to join (all of them): form sent, interview held (accepted), every required
document confirmed, camp fee paid. When the last one lands (from any side), the application
becomes `joined`, the base sets the edition membership to `confirmed` with payment
`paid_in_full` (audited), and the next page load shows the member home.

## 3. Applicant home (`/apply`)
Top to bottom: welcome + status tracker; **To do** (fill in the form, interview, each required
document, pay the camp fee) with what's done ticked; **Required documents and forms**
(read-and-confirm, PLACEHOLDER texts); **About Oe-aa-sies** (who we are, the art car, how we
work; text and drawings only, no photos of people). `/apply/form` is the PLACEHOLDER form;
editable until a decision (accepted / declined / joined), "Save draft" or "Send application".

## 4. Open applications (`/apply/review`, `/apply/review/<id>`)
Leads and admins: a list with counts per stage, filter by stage, each row showing name, stage,
interview date and what's still missing. The detail shows the answers, requirement checklist,
fee status, and a form to change status / interview date / private lead note. No email or phone
is shown (contacts stay behind `member.view_contacts`). Leads get an Up next item "N new
applications to review" and one per interview in the next 7 days.

## 5. Capabilities
| Capability | Who | Notes |
|---|---|---|
| `applicants.apply` | applicants (`isApplicant`) | With a record: only their own application |
| `applicants.review` | admins, camp leads, confirmed team leads/co-leads | See Open applications and details |
| `applicants.decide` | same as review, never on their own application | Change status, interview date, note |

## 6. Payment through Finance (event bus, demo only)
1. Lead accepts → applicants emits `applicants.application.accepted`.
2. Finance handles it: creates a `finance_camp_fees` row (PLACEHOLDER amount R3,500, status
   `due`, soft ref to the application) and emits `finance.fee.created`.
3. Applicants handles `finance.fee.created`: stores the amount and fee ref; the to-do shows it.
4. A finance approver or camp lead opens **Money → Camp fees** and taps **Record payment
   (demo)** (`finance.fees.manage`, never their own fee) → Finance emits `finance.fee.paid`.
5. Applicants handles `finance.fee.paid`: marks paid, and joins the applicant if nothing else is
   missing. All handlers are idempotent.

## 7. Access (server-side)
- `/`, `/up-next`, `/shifts` and every base screen redirect applicants to `/apply`; the shell
  shows no member tabs or sidebar. Module screens stay hidden (404) because module access needs a
  confirmed member. Applicants can't open Open applications or another person's application.
- Leads only see applications for the current edition (another edition's records are not listed
  and their URLs 404).

## 8. Seed (fake only)
14 applications at every stage from the seed's prospects, waitlisted and confirmed fake people,
plus the demo Applicant persona (Kai) with an interview booked. Accepted ones get their fee
through the event bus when the seed dispatches events.
