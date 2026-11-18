# Spec B1.12: edition settings screen (capacity, title, key dates)

**Status:** draft for Ruchir's review (13 Oct 2026, ET). **Builds on:** B1 spec §1 ("member
capacity as a setting", "editable anchor dates with a confirmed? flag") and §3 (`edition.manage`).
The server side already exists (`src/base/editions/settings.ts`); this adds the screen and a
read for it. **Plain markup only**: the landing page design is still open, so no styling work.

## 1. What it delivers
- A screen at **`/edition`** for people with `edition.manage` (camp lead; admins pass every base
  capability). Anyone else who types the URL gets "not found".
- It shows the edition title, year, **member capacity** and how many members are confirmed now.
- It lists the **key dates** (anchor dates) in date order, each with its key, label, start, optional
  end, source note and **Confirmed / TBC**.
- Forms to change the title and capacity, to add a key date, and to edit an existing one (same key =
  edit). Times are entered and shown in **camp time** (Africa/Johannesburg, "SAST").
- The landing page's "Camp" links get an **Edition settings** link for those allowed.

## 2. Behaviour (Given / When / Then)
- **E1** Given the camp lead, when they open `/edition`, then they see the title, capacity, the
  confirmed count, and every key date sorted by start, with "TBC" for unconfirmed ones.
- **E2 (deny)** Given a member or a team lead, when they load the settings (page or server read),
  then the server refuses (Forbidden → 404). Saving capacity or a key date is refused too, and
  nothing changes.
- **E3** Given the camp lead, when they add a key date with an end date and a source note, then it
  is saved with both, and audited (`edition.anchor_set`). Saving the same key again edits it
  (including flipping TBC → confirmed) rather than adding a second one.
- **E4** Given a key date whose end is before its start, when it's saved, then it's refused with a
  readable message and nothing changes.
- **E5** Camp-time conversion: "21 Apr 2027, 08:00" entered on the form is stored as 06:00 UTC, and
  shown back as 08:00.
- **E6** The "Edition settings" link shows for the camp lead and admins, and **not** for members,
  team leads, waitlisted people or alumni.

## 3. Not in this slice
Deleting a key date (not in B1; an unused key is harmless), the edition status / year rollover,
camp-wide settings (`camp_settings`), any landing page design.
