# Event packs: adding or updating an event

An event pack describes the event a camp goes to: its dates, its yearly deadlines, its rules for
camps, and the words the app uses for it. Each pack is one plain data file,
`camp-events/<event>/pack.ts`. `camp.config.ts` → `event.pack` picks one. The repo has two:
`burning-man` (the default) and `afrikaburn`.

The fields are typed in `src/lib/event-packs.ts`. That file's comments are the reference; this
page is the how-to.

## Every year: update the Burning Man pack

1. When Burning Man posts the new event dates, set `year` and `event` (`start`, `end`, `source`)
   and mark `event.status` `"official"`.
2. Go through `calendar`. Entries marked `"pattern"` are last year's date moved to the same
   weekday. When the event posts a date, fix it if it moved, set `status: "official"` and point
   `source` at the page that says so.
3. Check `water`, `fuel`, `rules` and `projects` against their `source` links. Change only what
   the source changed.
4. Run `pnpm typecheck` and open `/year`, `/countdown`, `/camp`, `/water` and `/fuel` locally.

## Adding a new event (a regional burn, for example)

1. Copy `camp-events/afrikaburn/pack.ts` (the smaller pack) to `camp-events/<your-event>/pack.ts`.
2. Add your key to `EventPack["key"]` in `src/lib/event-packs.ts`, and to `EVENT_PACKS` in
   `camp-events/index.ts`.
3. Fill in the fields below. Leave out the optional ones you don't have a source for. Without
   `water`, `/water` uses 1.5 gallons a person a day; without `fuel`, `/fuel` plans fuel with no
   storage limit and an 80% fill; without `firstTimer` or `projects`, those parts of `/camp`
   don't show.
4. Set `event.pack` in `camp.config.ts` to your key.

| Field | What it's for | Where it shows |
|---|---|---|
| `label`, `place` | The event's name and where it happens | Camp info, applications |
| `coords` | The site, for sunrise and sunset | Day/night theme |
| `timezone`, `timezoneLabel` | Every date and deadline is in this zone (IANA name, plus a short label like "PT") | Everywhere times show |
| `dateStyle` | `"us"` (Aug 29, 9:00 AM) or `"day-first"` (29 Aug, 09:00) | Everywhere dates show |
| `currency` | ISO 4217 code for tickets and fees | Money |
| `year`, `event` | The event's first and last day | Countdown, `/year` |
| `calendar` | The camp-lead year: one entry per deadline or window, each with a `source`. `placedOnly` hides it for open camping | `/year`, countdown |
| `rules` | The event's rules for camps, each one sentence plus a source | `/camp`, playa binder |
| `words` | The event's own words: name, site, principles, ticket wording, early-arrival pass, directions link | Applications, member guide |
| `water` | Water per person per day, in the event's usual unit | `/water` |
| `fuel` | Stored-fuel limit and how full a can may be | `/fuel` |
| `firstTimer` | Reading for first-timers, in order | `/camp` |
| `projects` | Steps to license or register a project (mutant vehicle, art), shown to camps with that camp pack | `/camp` |
| `obligations`, `sections` | Tracked deadlines the event switches on, and renamed section labels | `/obligations` |

## Rules for pack data

- **Every date, number and rule needs a `source`**: the event's own page, not a blog or a forum.
  If the event hasn't posted it yet, use last year's date marked `"pattern"`, or leave the
  field out.
- **Plain data only.** No logic in pack files. Code that reads a pack belongs in `src/lib/`.
- **Tracked deadlines (`obligations`) need more than a pack edit.** Their keys point into the
  obligations module's seed (`src/modules/obligations/seed.ts`), and each definition names an
  authority from a database enum. A new authority needs a migration, which is a protected path
  and needs the `allow-protected-change` label (see `docs/label-queue.md`, #18).
- New tests for a pack go under a `tests/` folder or in a `*.test.ts` file. Both are protected
  paths, so they also need the label.
