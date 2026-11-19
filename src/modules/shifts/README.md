# Shifts

Build, strike and camp duties (plan: `docs/plan-shifts.md` in the Oe-aa-sies Platform docs).

**PR 1 (this):** tables, enums, editable settings and demo seed from the camp's Duties & Shifts guide,
posters and schedule. The page still says "coming soon".

## Tables
- `shifts_settings`: one row per edition. Freeze date, duty minimum (hours), build/strike minimum (days), pre-Burn
  credit cap (% of the duty minimum) and the silent no-show flag threshold.
- `shifts_duty_types`: duties with category, phase, specialist flag, required skill (base
  `skills`), lead and backup, handover flag and staffing.
- `shifts_checklist_items`: per-duty checklist, by section.
- `shifts_slots`: the actual shifts; close-out records unfilled places (unclaimed) apart from
  no-shows (signup status).
- `shifts_signups`: claims. One live signup per person per shift. Never auto-assigned.
- `shifts_cover_requests`: swap (always to one named, qualified member who must accept) / give away / ask for cover (screens on hold for a member review).
- `shifts_checklist_ticks`, `shifts_handovers`, `shifts_handover_items`, `shifts_precredits`.

## Alerts
Hour timings live in the shared `alert_rules` (`remind_hours_before`,
`remind_again_hours_before`, `escalate_lead_hours_before`), read with `loadAlertHours`.
Defaults for shifts: 48, 24 and 6 hours.

## Events
None yet.
