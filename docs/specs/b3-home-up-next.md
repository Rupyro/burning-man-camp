# Spec B3.1: home redesign ("Up next" + category cards)

**Status:** decided by Ruchir (18 Oct 2026, ET; Decisions log). Replaces the block list in
`b3-home.md` §3–4 for `/`. Theme, tab bar, sidebar and permissions from B3 are unchanged.
**Design:** `design/home-up-next` mockups. North star (Sage): make responsibility visible and
problems manageable before they become someone else's emergency; contributing should feel easy.

## 1. Member home (top to bottom)
1. **Header** (phone): smaller sunset header, wordmark, "Welcome home, <first name>", one-line
   countdown "N days to build · M to gates" (a missing date hides its half), avatar to `/me`.
2. **Up next:** at most 5 rows, sorted by urgency tier then soonest date:
   tier 0 *overdue* (late tasks, module items marked overdue, offers to help waiting on me),
   tier 1 *soon* (due within a week, approvals waiting on me), tier 2 *coming*. Each row has an
   action (Open / Review / Check / Accept–Decline). Header link **See all (N)** to `/up-next`.
   Empty: "You're all set. Nothing needs you right now."
   - Sources: my open tasks (base task engine), helper offers I may decide (B3 §3), and every
     visible module's `myItems` (finance, procurement, logistics, obligations…). Nothing else.
   - **No "my next shift" row.** There is no signal at the Burn, so only shift *decisions and
     actions* belong here, and those come from the Shifts module once it exists. Until then the
     queue has no shift rows at all (no sample data in the queue).
3. **Everything else:** a grid of category cards with count badges from the module tiles:
   Shifts (tag **New**, opens a placeholder `/shifts` until the module exists), Money (finance),
   Kit and stock (procurement), Travel and loads (logistics), Obligations, Camp info. A card for a
   module the caller can't see is not shown. Any other visible module appears under
   **Other modules** (existing tiles), so new modules never disappear from home.

## 2. Lead home (`readiness.view`)
Same layout. The queue is titled **Needs you · your teams** and adds, for each team I may view
(camp leads: all teams):
- **One summary row per team** with late work: "Kitchen: 3 late" (tier 0), with how many are
  blocked and the oldest lateness. A team with only blocked work shows "Kitchen: 2 blocked"
  (tier 1). Tapping the row opens that team's individual late and blocked tasks (each links to
  the task). My own tasks already counted in a team row are not repeated.
- **Team readiness panel:** per team, done / live tasks as a percentage and the late count.
  On laptop (`lg` and up) it sits beside the queue. Below `lg` it collapses into a tappable icon
  next to the queue title that opens the panel in a dialog.
- **(deny)** members get neither; the data is never loaded for them.
- **(wrong record)** a team lead sees only their own teams.

## 3. See all (`/up-next`)
The full ranked queue (no cap). Leads also get the existing My team board below it.

## 4. Camp info (`/camp`)
Member guide, packing list, camp rules (short draft text the leads will replace), key dates
(the edition's anchor dates), and lead contacts: the leads and co-leads from the directory the
caller may already see, each linking to their profile (which applies the contact rules). No
phone numbers or emails are copied onto this page.

## 5. Shifts placeholder (`/shifts`)
"Coming soon" page that says what Shifts will do (sign up, my shifts, swaps, shift freeze,
Burn pack). Any example is labelled sample. No data.

## 6. Not in this slice
The Shifts module itself, the Burn pack, notifications in the queue (they stay in Alerts),
editing Camp info content in the app.

## B3.2 Sage's first-look fixes (decided by Ruchir, 21 Oct 2026 ET)
Sage (camp member) found the home overwhelming: no clear "what do I do next". Changes:
- **My to-do:** the queue is titled **My to-do** (leads: **My to-do · waiting on you**), still at
  most 5 rows, each one tap to where you do it. A **Fill in your details** row (to `/me`) shows
  while your phone, an emergency contact (name and phone) or your arrival date is missing.
  **Everything else** stays below, smaller and quieter.
- **My profile** is only the avatar top right (labelled "My profile"); the bottom tab bar is
  Home, Tasks, Alerts.
- **Alerts** (`/notifications`) are things waiting for you: each unread one has **Open** (to where
  you deal with it) and **Mark done**; done ones fold away. **Alert settings** (how you hear about
  each kind) moved to My profile as one compact list with one **Save alert settings** button.

## B3.3 Shifts first look (decided by Ruchir, 21 Oct 2026 ET)
- Before the roster exists, `/shifts` says **"Shift sign-ups open on <date>. We'll send you an
  alert when they do."** using the edition anchor date `shift_signups_open` (seeded 1 Feb 2027,
  placeholder). With no date: "Shift sign-ups haven't opened yet…". Never "not set up".
- Until then My to-do shows **Pick your shifts (sign-ups open <date>)** for confirmed members.
- A module nav bar whose only link is the module home is not shown (it repeated "Shifts Shifts"
  above the "Shifts" heading).
