# Spec B3: home screen (landing page) and camp theme

**Status:** draft for Ruchir's review (13 Oct 2026, ET). **Slice:** last base slice after B2.
**Design:** approved mockups `member-phone` (phone, members) and `lead-laptop` (laptop, leads).

## 1. What it delivers
- One home page at `/` for everyone, in the Oe-aa-sies look. Member screens are phone-first,
  lead screens laptop-first; every screen works on both.
- A shared theme (Tailwind 4 / shadcn tokens) so every screen uses the same colours and fonts.

## 2. Look (theme tokens)
| Token | Value | Use |
|---|---|---|
| sunset gradient | `#7A3E52 → #C0645A → #E8955A → #F0D2B0` | header, countdown |
| ink | `#3A1F2A` | text, primary buttons, phone tab bar |
| sand / card | `#F0E4CC` page, `#FFF8EC` cards, `#D8C4A0` borders and tiles | |
| night | `#0B1530` page, `#111D42` cards, neon magenta `#E0309A`, cyan `#22D3EE`, blue `#2F6BFF` | lead laptop view (`.theme-night`) |
Fonts are self-hosted with `next/font` (no Google CSS at runtime): Fraunces (wordmark and big
numbers), Syne (bold wide caps headings), Special Elite (typewriter accent), Inter (body).
The wordmark "oe / aa / sieS" is styled text, not an image. Ox-wagon and art-car illustrations are
simple original line-art SVGs.

## 3. Home blocks (member order, top to bottom)
1. **Header:** wordmark, "Welcome home, <first name>", avatar initial linking to `/me`.
2. **My next things:** my open tasks (owned or helping), overdue first then by due date, max 5,
   each with a chip "N days late" / "Due <day>" / "Due <date>". Then helper requests waiting on
   me: pending offers to help on tasks I may manage (`task.manage` on that task), with Accept /
   Decline (the existing `decideClaim` action, which re-checks permission). Module "my stuff"
   items join this list.
3. **Countdown:** whole days from today (camp time, Africa/Johannesburg) to `build_start` and to
   `event_start` ("gates"). A missing date hides its half; a past date shows 0.
4. **New for you:** my unread notifications, newest first, max 3, link to `/notifications`.
5. **Modules:** permission-filtered tiles from the module registry (unchanged server logic).
6. **Phone tab bar** (below the `md` breakpoint): Home, Tasks, Alerts (unread count), Me.

## 4. Leads (`readiness.view`)
Same home plus **My team**: late or blocked open tasks in the teams I lead (camp leads: all
teams), max 8, with owner, project, due and status; and **Readiness by project**: per project in
those teams, done tasks / live tasks as a percentage. On a laptop (`lg` and up) the app shows a
left sidebar (Home, My tasks, Projects, Notifications, modules, admin links I'm allowed) and the
night theme; the home becomes a dashboard grid.
- **(deny)** a plain member gets no My team block and the data is never loaded for them.
- **(wrong record)** a team lead sees only their own teams' tasks and projects.

## 5. Not in this slice
Real module tiles beyond the example module, search, theme switcher, custom illustrations
beyond the two SVGs, per-person "member home" settings.

## 6. FLAG FOR HUMAN
- Leads always get the night theme on laptop, members always sand. No toggle yet.
